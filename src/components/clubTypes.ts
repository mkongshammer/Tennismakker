// The slice of a discovered club that the map and the list cards share.
export type MapClub = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state?: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMiles?: number | null;
  priceHour: number;
  currency: string;
  country: string;
  timeZone?: string;
  courtCount: number;
  indoorCount?: number;
  surfaces: string[];
  color: string;
  tagline?: string | null;
  /** Approved hero image id, when the club has uploaded one. */
  heroId?: string | null;
  rating: { average: number; count: number };
  /** Open court-hours left today; null when availability was not checked or could not be read. */
  guestSlotsToday: number | null;
  nextSlotAt?: string | null;
  bookable?: boolean;
};
