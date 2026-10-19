import type { Locale } from "../lib/sports";

// Retained so older pages can render the market label without allowing a country switch.
export function CountryPicker({ locale: _locale }: { active: string; locale: Locale }) {
  return <p className="text-sm font-medium text-slate">United States</p>;
}
