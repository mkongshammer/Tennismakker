declare module "zipcodes" {
  export type ZipRow = { zip: string; latitude: number; longitude: number; city: string; state: string; country: string };
  export function lookup(zip: string | number): ZipRow | undefined;
  export function lookupByName(city: string, state: string): ZipRow[];
  export function lookupByState(state: string): ZipRow[];
  export const codes: Record<string, ZipRow>;
}
