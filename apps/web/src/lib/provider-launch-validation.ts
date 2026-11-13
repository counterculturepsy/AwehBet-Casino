export type ProviderLaunchResponse = Readonly<{
  launchUrl: string;
  expiresAt?: string;
  mode: 'demo';
  presentation: 'iframe' | 'redirect';
}>;

export function validateProviderLaunch(
  response: ProviderLaunchResponse,
  approvedHosts: readonly string[],
  now = new Date(),
): ProviderLaunchResponse {
  if (response.mode !== 'demo' || !['iframe', 'redirect'].includes(response.presentation)) {
    throw new Error('Invalid provider launch mode.');
  }
  if (typeof response.launchUrl !== 'string' || response.launchUrl.length > 4096) {
    throw new Error('Invalid provider launch URL.');
  }

  let url: URL;
  try {
    url = new URL(response.launchUrl);
  } catch {
    throw new Error('Invalid provider launch URL.');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Provider launch must use standard HTTPS without embedded credentials.');
  }

  const allowed = new Set(approvedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean));
  if (!allowed.has(url.hostname.toLowerCase())) {
    throw new Error('Provider launch host is not approved.');
  }

  if (response.expiresAt !== undefined) {
    const expiry = Date.parse(response.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now.getTime()) {
      throw new Error('Provider launch session is expired or invalid.');
    }
  }

  return response;
}
