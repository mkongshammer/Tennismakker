export type USState = { code: string; name: string };
export const US_STATES: readonly USState[];
export function normalizeUSState(value: unknown): string;
export function validUSState(value: unknown): boolean;
export function normalizeUSPostalCode(value: unknown): string;
export function validUSPostalCode(value: unknown): boolean;
export const US_STATE_TIME_ZONES: Readonly<Record<string,string>>;
export function usStateTimeZone(value: unknown): string;
export function formatUSAddress(street: unknown, city: unknown, state: unknown, postalCode: unknown): string;
