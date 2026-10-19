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
  rating: { average: number; count: number };
  guestSlotsToday: number;
  nextSlotAt?: string | null;
  bookable?: boolean;
};
