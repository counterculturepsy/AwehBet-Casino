export type DemoLaunchRequest = {
  gameId: string;
  sessionId: string;
  locale: string;
  returnUrl: string;
};

export type DemoLaunchResult = {
  launchUrl: string;
  expiresAt?: string;
  mode: 'demo';
  presentation: 'iframe' | 'redirect';
};

export interface DemoGameProvider {
  readonly id: string;
  launchDemo(request: DemoLaunchRequest): Promise<DemoLaunchResult>;
}

export class ProviderUnavailableError extends Error {
  constructor(message = 'Professional demo provider access is not configured.') {
    super(message);
    this.name = 'ProviderUnavailableError';
  }
}
