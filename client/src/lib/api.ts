const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

// Avatar/upload paths returned by the API are relative (e.g. "/uploads/avatars/xyz.jpg")
// since they're served by the backend, not the Next.js app - this builds the full URL.
export function assetUrl(path?: string): string | undefined {
  if (!path) return undefined;
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    // Always send cookies (accessToken/refreshToken) - required since the API uses
    // httpOnly cookie auth, not Authorization headers.
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(data?.message ?? 'Request failed', res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  // Separate from the above: file uploads must NOT set Content-Type manually - the browser
  // needs to set it itself (multipart/form-data; boundary=...), which it can only do
  // correctly when we don't override it ourselves.
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      credentials: 'include',
      body: formData,
    });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : null;
    if (!res.ok) {
      throw new ApiError(data?.message ?? 'Upload failed', res.status);
    }
    return data as T;
  },
};
