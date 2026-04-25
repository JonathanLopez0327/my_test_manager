export const DEFAULT_AI_TOKEN_LIMIT_MONTHLY = 250_000;

export const AI_TOKEN_TIERS: Record<string, number> = {
  beta: 250_000,
  basic: 500_000,
  pro: 5_000_000,
  enterprise: 50_000_000,
};

export function resolveAiTokenLimit(tier?: string | null): number {
  if (!tier) return DEFAULT_AI_TOKEN_LIMIT_MONTHLY;
  const normalized = tier.trim().toLowerCase();
  return AI_TOKEN_TIERS[normalized] ?? DEFAULT_AI_TOKEN_LIMIT_MONTHLY;
}
