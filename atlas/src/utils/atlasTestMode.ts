/**
 * When enabled, Atlas skips git, gh, and Nx project graph reads and uses mock data.
 * Set via: ATLAS_TEST_MODE=1 (or true / yes, case-insensitive).
 */
export function isAtlasTestMode(): boolean {
  const raw = process.env.ATLAS_TEST_MODE;
  if (raw == null || raw === "") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
