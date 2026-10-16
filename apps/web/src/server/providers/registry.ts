import 'server-only';
import { ProviderUnavailableError, type DemoGameProvider, type DemoLaunchRequest, type DemoLaunchResult } from './contracts.js';

class UnconfiguredDemoProvider implements DemoGameProvider {
  readonly id = 'unconfigured';

  async launchDemo(_request: DemoLaunchRequest): Promise<DemoLaunchResult> {
    throw new ProviderUnavailableError();
  }
}

// Never accept launch URLs from browser input. Future providers must authenticate
// server-side and return allowlisted HTTPS URLs according to their agreements.
export function getDemoProvider(): DemoGameProvider {
  return new UnconfiguredDemoProvider();
}
