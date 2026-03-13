// Base-32 alphabet — no O, 0, I, 1 to avoid visual confusion
const BASE32_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBetaCode(): string {
  const part = () =>
    Array.from({ length: 4 }, () =>
      BASE32_ALPHABET[Math.floor(Math.random() * BASE32_ALPHABET.length)],
    ).join("");
  return `BETA-${part()}-${part()}`;
}
