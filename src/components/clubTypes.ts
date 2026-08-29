export type MapClub = {
  id: string;
  slug: string;
  name: string;
  city: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  priceHour: number;
  courtCount: number;
  surfaces: string[];
  color: string;
  rating: { average: number; count: number };
  guestSlotsToday: number;
};
