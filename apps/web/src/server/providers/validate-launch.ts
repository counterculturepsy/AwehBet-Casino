import type { DemoLaunchResult } from './contracts.ts';

/**
 * Provider responses are untrusted until validated. Configure hosts from the
 * provider's approved launch documentation, not from client requests.
 */
export function validateDemoLaunch(
  result: DemoLaunchResult,
  approvedHosts: readonly string[],
  now = new Date(),
): DemoLaunchResult {
  if (!result || result.mode !== 'demo' || !['iframe', 'redirect'].includes(result.presentation)) {
    throw new Error('Invalid provider launch mode');
  }
  if (typeof result.launchUrl !== 'string' || result.launchUrl.length > 4096) {
    throw new Error('Invalid provider launch URL');
  }
  let url: URL;
  try {
    url = new URL(result.launchUrl);
  } catch {
    throw new Error('Invalid provider launch URL');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('Provider launch must use standard HTTPS without embedded credentials');
  }
  const normalizedHosts = approvedHosts.map(host => host.toLowerCase());
  if (!normalizedHosts.includes(url.hostname.toLowerCase())) {
    throw new Error('Provider launch host not approved');
  }
  if (result.expiresAt !== undefined) {
    const expiry = Date.parse(result.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now.getTime()) {
      throw new Error('Provider launch session expired or invalid');
    }
  }
  return result;
}
