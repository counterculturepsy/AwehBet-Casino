export function isSameOriginRequest(headers: Headers, fallbackUrl: URL) {
  const origin = headers.get('origin');
  if (!origin) return false;

  try {
    const forwardedHost = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    const host = forwardedHost || headers.get('host');
    const forwardedProtocol = headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const protocol = forwardedProtocol || fallbackUrl.protocol.replace(':', '');
    const requestOrigin = host ? new URL(`${protocol}://${host}`).origin : fallbackUrl.origin;
    const fetchSite = headers.get('sec-fetch-site');
    return new URL(origin).origin === requestOrigin && (!fetchSite || fetchSite === 'same-origin');
  } catch {
    return false;
  }
}
