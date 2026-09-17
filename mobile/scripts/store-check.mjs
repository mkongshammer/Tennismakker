import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const app = readJson("app.json").expo;
const pkg = readJson("package.json");
const listing = fs.readFileSync(path.join(root, "STORE_LISTING.md"), "utf8");

const errors = [];
const warnings = [];
const check = (condition, message) => {
  if (!condition) errors.push(message);
};

check(app?.name === "RacketBuddy", "Expo app name must be RacketBuddy.");
check(/^\d+\.\d+\.\d+$/.test(app?.version ?? ""), "Expo version must use semantic x.y.z format.");
check(Boolean(app?.ios?.bundleIdentifier), "Missing iOS bundleIdentifier.");
check(Boolean(app?.android?.package), "Missing Android package name.");
check(app?.ios?.bundleIdentifier === app?.android?.package, "iOS and Android application IDs must match for this project.");
check(/^\d+$/.test(String(app?.ios?.buildNumber ?? "")), "iOS buildNumber must be numeric.");
check(Number.isInteger(app?.android?.versionCode) && app.android.versionCode >= 1, "Android versionCode must be a positive integer.");
check(app?.ios?.config?.usesNonExemptEncryption === false, "Declare usesNonExemptEncryption=false when the app only uses standard platform HTTPS/TLS.");
check(app?.extra?.apiUrl?.startsWith("https://"), "Production API URL must use HTTPS.");

for (const asset of [app?.icon, app?.splash?.image, app?.android?.adaptiveIcon?.foregroundImage]) {
  check(Boolean(asset) && fs.existsSync(path.join(root, asset)), `Missing referenced store asset: ${asset ?? "(undefined)"}`);
}

for (const url of [
  "https://racketbuddy.app/privatliv",
  "https://racketbuddy.app/vilkaar",
  "https://racketbuddy.app/slet-konto",
]) {
  check(listing.includes(url), `STORE_LISTING.md is missing required public URL: ${url}`);
}

check(listing.includes("rapport"), "Store review notes should mention in-app reporting/moderation.");
check(listing.toLowerCase().includes("blok"), "Store review notes should mention user blocking.");
check(listing.includes("Slet konto permanent"), "Store review notes should point reviewers to in-app account deletion.");

const expoVersion = String(pkg.dependencies?.expo ?? "");
const sdkMatch = expoVersion.match(/(\d+)/);
if (!sdkMatch || Number(sdkMatch[1]) < 54) {
  errors.push("Expo SDK 54 or newer is required for the current Android 16 target baseline.");
}

if (!app?.extra?.eas?.projectId) {
  warnings.push("EAS projectId is not set yet. Run `eas init` under the RacketBuddy Expo account before the first cloud build.");
}

if (app?.ios?.supportsTablet) {
  warnings.push("iPad support is enabled; App Store review will expect the app to work correctly on iPad and may require iPad screenshots.");
}

if (errors.length) {
  console.error("\nRacketBuddy store readiness check failed:\n");
  for (const error of errors) console.error(`  ✗ ${error}`);
  if (warnings.length) {
    console.error("\nWarnings:");
    for (const warning of warnings) console.error(`  ! ${warning}`);
  }
  process.exit(1);
}

console.log("RacketBuddy store readiness checks passed.");
for (const warning of warnings) console.log(`  ! ${warning}`);
