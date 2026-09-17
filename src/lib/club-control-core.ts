/**
 * Ren tids- og kanalberegning for klubbens lys/adgang.
 *
 * Filen har bevidst ingen database- eller netværksafhængigheder, så de
 * sikkerhedskritiske grænser kan testes direkte.
 */

export type AccessWindowSettings = {
  accessBeforeMinutes: number;
  accessAfterMinutes: number;
};

export type LightWindowSettings = {
  lightsBeforeMinutes: number;
  lightsAfterMinutes: number;
};

export type BookingWindow = {
  startsAt: Date;
  endsAt: Date;
};

export type ControlChannelKind = "COURT_LIGHT" | "COMMON_LIGHT" | "DOOR";

const MINUTE_MS = 60_000;

export function accessWindow(
  booking: BookingWindow,
  settings: AccessWindowSettings
) {
  return {
    availableFrom: new Date(
      booking.startsAt.getTime() - settings.accessBeforeMinutes * MINUTE_MS
    ),
    availableUntil: new Date(
      booking.endsAt.getTime() + settings.accessAfterMinutes * MINUTE_MS
    ),
  };
}

export function canOpenDoor(
  booking: BookingWindow,
  settings: AccessWindowSettings,
  now = new Date()
) {
  const { availableFrom, availableUntil } = accessWindow(booking, settings);
  const time = now.getTime();
  return time >= availableFrom.getTime() && time <= availableUntil.getTime();
}

export function bookingNeedsLight(
  booking: BookingWindow,
  settings: LightWindowSettings,
  now = new Date()
) {
  const time = now.getTime();
  const onFrom = booking.startsAt.getTime() - settings.lightsBeforeMinutes * MINUTE_MS;
  const onUntil = booking.endsAt.getTime() + settings.lightsAfterMinutes * MINUTE_MS;
  return time >= onFrom && time <= onUntil;
}

export function desiredChannelState(
  channel: { kind: string; courtId: string | null },
  activeCourtIds: ReadonlySet<string>
): boolean | null {
  if (channel.kind === "COURT_LIGHT") {
    return Boolean(channel.courtId && activeCourtIds.has(channel.courtId));
  }
  if (channel.kind === "COMMON_LIGHT") {
    return activeCourtIds.size > 0;
  }
  // Døren styres kun af et aktivt brugertryk. Cron må aldrig holde den åben.
  return null;
}
