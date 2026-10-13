export type DataRegion = "EU" | "US" | "GLOBAL";

export function dataRegionForCountry(country: unknown): Exclude<DataRegion, "GLOBAL"> {
  return String(country ?? "").toUpperCase() === "US" ? "US" : "EU";
}

export function deploymentRegion(): DataRegion {
  const value = String(process.env.RACKETBUDDY_REGION ?? "GLOBAL").toUpperCase();
  return value === "US" || value === "EU" ? value : "GLOBAL";
}

export function regionalShardingActive(): boolean {
  return String(process.env.REGIONAL_SHARDING_ACTIVE ?? "false").toLowerCase() === "true";
}

export function regionAllowsCountry(country: unknown): boolean {
  if (!regionalShardingActive()) return true;
  const deployed = deploymentRegion();
  return deployed === "GLOBAL" || deployed === dataRegionForCountry(country);
}

export function regionalOrigin(country: unknown): string | null {
  const region = dataRegionForCountry(country);
  const raw = region === "US" ? process.env.US_APP_URL : process.env.EU_APP_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function regionMismatch(country: unknown) {
  const expected = dataRegionForCountry(country);
  const actual = deploymentRegion();
  return {
    expected,
    actual,
    correctOrigin: regionalOrigin(country),
  };
}
