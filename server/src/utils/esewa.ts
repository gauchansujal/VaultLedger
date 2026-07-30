import crypto from 'crypto';
import { env } from '../config/env';

interface EsewaFormParams {
  amount: string;
  tax_amount: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  product_service_charge: string;
  product_delivery_charge: string;
  success_url: string;
  failure_url: string;
  signed_field_names: string;
  signature: string;
}

/**
 * eSewa requires an HMAC-SHA256 signature over specific fields (in a specific order,
 * joined as "key=value,key=value") so their server can verify the payment request
 * genuinely originated from us and wasn't tampered with in transit (e.g. amount changed
 * by a malicious browser extension or intercepting proxy before reaching eSewa).
 */
function signFields(fields: Record<string, string>, signedFieldNames: string): string {
  const message = signedFieldNames
    .split(',')
    .map((field) => `${field}=${fields[field]}`)
    .join(',');

  return crypto.createHmac('sha256', env.esewaSecretKey).update(message).digest('base64');
}

export function buildEsewaFormParams(amount: number, transactionUuid: string): EsewaFormParams {
  const amountStr = amount.toFixed(2);
  const signedFieldNames = 'total_amount,transaction_uuid,product_code';

  const fields = {
    total_amount: amountStr,
    transaction_uuid: transactionUuid,
    product_code: env.esewaMerchantCode,
  };

  return {
    amount: amountStr,
    tax_amount: '0',
    total_amount: amountStr,
    transaction_uuid: transactionUuid,
    product_code: env.esewaMerchantCode,
    product_service_charge: '0',
    product_delivery_charge: '0',
    success_url: `${env.clientOrigin}/payments/esewa/success`,
    failure_url: `${env.clientOrigin}/payments/esewa/failure`,
    signed_field_names: signedFieldNames,
    signature: signFields(fields, signedFieldNames),
  };
}

interface EsewaStatusResponse {
  product_code: string;
  transaction_uuid: string;
  total_amount: number;
  status: 'COMPLETE' | 'PENDING' | 'FULL_REFUND' | 'PARTIAL_REFUND' | 'AMBIGUOUS' | 'NOT_FOUND' | 'CANCELED';
  ref_id: string;
}

/**
 * Server-to-server verification, NOT trusting the browser redirect alone. eSewa
 * redirects the user's browser back to success_url after payment, but a browser
 * redirect is trivially forgeable (a user could just navigate to that URL directly
 * without ever paying). This function independently asks eSewa's own API "did this
 * transaction actually complete?" - that answer is what actually marks a transaction
 * as paid, never the redirect itself.
 */
export async function verifyEsewaPayment(
  transactionUuid: string,
  totalAmount: number
): Promise<EsewaStatusResponse> {
  const url = new URL(env.esewaStatusCheckUrl);
  url.searchParams.set('product_code', env.esewaMerchantCode);
  url.searchParams.set('total_amount', totalAmount.toFixed(2));
  url.searchParams.set('transaction_uuid', transactionUuid);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`eSewa status check failed with HTTP ${res.status}`);
  }

  return (await res.json()) as EsewaStatusResponse;
}
