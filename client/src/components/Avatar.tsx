import { assetUrl } from '@/lib/api';

export function Avatar({
  avatarUrl,
  email,
  size = 36,
}: {
  avatarUrl?: string;
  email: string;
  size?: number;
}) {
  const url = assetUrl(avatarUrl);
  const initial = email.charAt(0).toUpperCase();

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border border-vault-border"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-vault-surface2 border border-vault-border flex items-center justify-center text-vault-gold font-display font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
