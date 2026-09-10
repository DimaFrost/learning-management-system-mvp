export function getPublicAppUrl(): string {
  const configuredUrl = import.meta.env.VITE_PUBLIC_APP_URL;
  const fallbackUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const candidate = String(configuredUrl || fallbackUrl || '').trim();

  if (!candidate) return '';

  try {
    return new URL(candidate).origin;
  } catch {
    return fallbackUrl;
  }
}
