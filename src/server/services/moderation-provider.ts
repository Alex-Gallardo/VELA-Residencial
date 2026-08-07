import type { ModerationProviderResult } from "@/server/services/moderation-policy";

export interface ModerationProvider {
  readonly name: string;
  analyze(image: Uint8Array): Promise<ModerationProviderResult>;
}

/**
 * Safe default until an external image moderation provider is approved.
 * Every valid image is sent to the human queue; no content is auto-published.
 */
export class DeferredModerationProvider implements ModerationProvider {
  readonly name = "deferred";

  async analyze(image: Uint8Array): Promise<ModerationProviderResult> {
    void image;
    return {
      provider: this.name,
      riskScore: null,
      labels: [{ name: "provider_pending", confidence: null }],
    };
  }
}

export function getModerationProvider(): ModerationProvider {
  return new DeferredModerationProvider();
}
