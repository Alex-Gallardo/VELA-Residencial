import { ModerationStatus } from "@prisma/client";

export const AUTO_APPROVE_MAX_RISK = 0.15;
export const AUTO_REJECT_MIN_RISK = 0.85;

export type ModerationProviderResult = {
  provider: string;
  riskScore: number | null;
  labels: Array<{ name: string; confidence: number | null }>;
};

export function decideModerationStatus(result: ModerationProviderResult) {
  if (result.riskScore === null) return ModerationStatus.EN_REVISION_HUMANA;
  if (result.riskScore >= AUTO_REJECT_MIN_RISK)
    return ModerationStatus.RECHAZADO;
  if (result.riskScore <= AUTO_APPROVE_MAX_RISK)
    return ModerationStatus.APROBADO;
  return ModerationStatus.EN_REVISION_HUMANA;
}
