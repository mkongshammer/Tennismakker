import { db } from "./db";
import {
  accessWindow,
  canOpenDoor,
  desiredChannelState,
} from "./club-control-core";
import { commandGroup, inspectDevices, providerOf, refKey, type DeviceState, type GroupResult, type StoredControl, type SwitchRef } from "./control-providers";

type ChannelWithDevice = {
  manualOnUntil?: Date | null;
  id: string;
  channel: number;
  kind: string;
  label: string | null;
  courtId: string | null;
  lastState: boolean | null;
  device: {
    id: string;
    externalId: string;
    online: boolean | null;
  };
};

export class ClubControlError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ClubControlError";
    this.status = status;
  }
}

/** Status for the given devices, whatever the club's controller (Shelly, Tuya or webhook). */
export async function inspectShellyDevices(control: StoredControl, deviceIds: string[]): Promise<DeviceState[]> {
  return inspectDevices(control, deviceIds);
}
export const inspectControlDevices = inspectShellyDevices;

async function commandSwitches(
  control: StoredControl,
  refs: SwitchRef[],
  on: boolean,
  toggleAfterSeconds?: number,
  event?: "door" | "test"
): Promise<GroupResult> {
  return commandGroup(control, refs, on, toggleAfterSeconds, event);
}

/**
 * Det eneste adgangsobjekt, mobilappen får. Ingen controller-id'er eller
 * nøgler forlader serveren.
 */
export function bookingDoorAccess(booking: any, now = new Date()) {
  const control = booking?.court?.club?.control;
  if (!control?.enabled || booking.status !== "CONFIRMED") return null;

  const doors = (control.devices ?? []).flatMap((device: any) =>
    (device.channels ?? []).filter((channel: any) => channel.kind === "DOOR")
  );
  if (doors.length === 0) return null;

  const window = accessWindow(booking, control);
  return {
    doorEnabled: true,
    label: doors[0]?.label || "døren",
    availableFrom: window.availableFrom.toISOString(),
    availableUntil: window.availableUntil.toISOString(),
    canOpen: canOpenDoor(booking, control, now),
    unlockSeconds: control.doorPulseSeconds,
    instructions: booking.court.club.accessInstructions ?? null,
  };
}

export type ReconcileResult = {
  clubId: string;
  checked: number;
  changed: number;
  failed: number;
  skipped?: string;
};

/** Sørger for, at det fysiske lys matcher klubbens aktive bookinger nu. */
export async function reconcileClubControl(
  clubId: string,
  now = new Date()
): Promise<ReconcileResult> {
  const control = await db.clubControl.findUnique({
    where: { clubId },
    include: {
      club: { select: { name: true } },
      devices: {
        include: { channels: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!control?.enabled) {
    return { clubId, checked: 0, changed: 0, failed: 0, skipped: "ikke aktiv" };
  }
  if (control.devices.length === 0) {
    await db.clubControl.update({
      where: { id: control.id },
      data: { lastCheckedAt: now, lastError: "Ingen controllere er tilføjet." },
    });
    return { clubId, checked: 0, changed: 0, failed: 1, skipped: "ingen enheder" };
  }

  let states: DeviceState[];
  const webhook = providerOf(control) === "WEBHOOK";
  try {
    states = await inspectShellyDevices(
      control,
      control.devices.map((device: any) => device.externalId)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Controller status couldn't be read.";
    await db.clubControl.update({
      where: { id: control.id },
      data: { lastCheckedAt: now, lastError: message },
    });
    return { clubId, checked: 0, changed: 0, failed: 1 };
  }

  const stateById = new Map(states.map((state) => [state.id.toLowerCase(), state]));
  for (const device of control.devices as any[]) {
    const state = stateById.get(device.externalId.toLowerCase());
    await db.clubControlDevice.update({
      where: { id: device.id },
      data: {
        online: state ? state.online === 1 : false,
        lastSeenAt: state?.online === 1 ? now : device.lastSeenAt,
        model: state?.code ?? device.model,
      },
    });
  }

  const lightWindowEnd = new Date(
    now.getTime() + control.lightsBeforeMinutes * 60_000
  );
  const lightWindowStart = new Date(
    now.getTime() - control.lightsAfterMinutes * 60_000
  );
  const [activeBookings, importedBookings] = await Promise.all([
    db.booking.findMany({
      where: {
        kind: "COURT",
        status: "CONFIRMED",
        court: { clubId },
        startsAt: { lte: lightWindowEnd },
        endsAt: { gte: lightWindowStart },
      },
      select: { courtId: true },
    }),
    // Klubber med kalenderfeed skal have lys til deres egne bookinger, ikke
    // kun til bookinger solgt gennem RacketBuddy.
    db.externalBusy.findMany({
      where: {
        court: { clubId },
        startsAt: { lte: lightWindowEnd },
        endsAt: { gte: lightWindowStart },
      },
      select: { courtId: true },
    }),
  ]);
  const activeCourtIds = new Set(
    [...activeBookings, ...importedBookings]
      .map((booking: any) => booking.courtId)
      .filter(Boolean) as string[]
  );

  const lightChannels: ChannelWithDevice[] = (control.devices as any[]).flatMap(
    (device) =>
      device.channels
        .filter((channel: any) =>
          ["COURT_LIGHT", "COMMON_LIGHT"].includes(channel.kind)
        )
        .map((channel: any) => ({ ...channel, device }))
  );

  let failed = 0;
  const transitions = new Map<boolean, ChannelWithDevice[]>([
    [false, []],
    [true, []],
  ]);

  for (const channel of lightChannels) {
    const state = stateById.get(channel.device.externalId.toLowerCase());
    const desired = channel.manualOnUntil && channel.manualOnUntil > now ? true : desiredChannelState(channel, activeCourtIds);
    // A webhook can't report state; we trust the last command that succeeded.
    const actual = webhook ? (channel.lastState ?? (desired === null ? null : !desired)) : state?.output(channel.channel) ?? null;
    let error: string | null = null;

    if (!state || state.online !== 1) error = "Controlleren er offline.";
    else if (actual === null) error = "Relækanalen findes ikke på controlleren.";

    if (error) {
      failed++;
      await db.clubControlChannel.update({
        where: { id: channel.id },
        data: { lastError: error },
      });
      continue;
    }

    await db.clubControlChannel.update({
      where: { id: channel.id },
      data: { lastState: actual, lastError: null },
    });
    if (desired !== null && actual !== desired) transitions.get(desired)!.push(channel);
  }

  let changed = 0;
  const eventRows: any[] = [];

  // Sluk først og tænd bagefter. Det reducerer belastningen, når mange
  // bookinger skifter på samme klokkeslæt.
  for (const desired of [false, true]) {
    const channels = transitions.get(desired)!;
    if (channels.length === 0) continue;

    try {
      const result = await commandSwitches(
        control,
        channels.map((channel) => ({
          deviceId: channel.device.externalId,
          channel: channel.channel,
          label: channel.label,
        })),
        desired
      );

      for (const channel of channels) {
        const commandError = result.failed.get(refKey({ deviceId: channel.device.externalId, channel: channel.channel })) ?? null;
        if (commandError) failed++;
        else changed++;

        await db.clubControlChannel.update({
          where: { id: channel.id },
          data: {
            lastState: commandError ? channel.lastState : desired,
            lastCommandAt: now,
            lastError: commandError,
          },
        });
        eventRows.push({
          clubId,
          deviceExternalId: channel.device.externalId,
          channel: channel.channel,
          action: desired ? "LIGHT_ON" : "LIGHT_OFF",
          outcome: commandError ? "FAILED" : "OK",
          message: commandError,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The controller command failed.";
      failed += channels.length;
      for (const channel of channels) {
        await db.clubControlChannel.update({
          where: { id: channel.id },
          data: { lastCommandAt: now, lastError: message },
        });
        eventRows.push({
          clubId,
          deviceExternalId: channel.device.externalId,
          channel: channel.channel,
          action: desired ? "LIGHT_ON" : "LIGHT_OFF",
          outcome: "FAILED",
          message,
        });
      }
    }
  }

  if (eventRows.length > 0) await db.clubControlEvent.createMany({ data: eventRows });
  const lastError = failed > 0 ? `${failed} lyskommando(er) fejlede.` : null;
  await db.clubControl.update({
    where: { id: control.id },
    data: {
      lastCheckedAt: now,
      lastOkAt: failed === 0 ? now : control.lastOkAt,
      lastError,
    },
  });

  return { clubId, checked: lightChannels.length, changed, failed };
}

/** Kører alle aktive klubber. Kaldes af det minutlige, beskyttede cron-endpoint. */
export async function reconcileAllClubControls(now = new Date()) {
  const controls = await db.clubControl.findMany({
    where: { enabled: true },
    select: { clubId: true },
    orderBy: { createdAt: "asc" },
  });

  const results: ReconcileResult[] = [];
  for (const control of controls) {
    try {
      results.push(await reconcileClubControl(control.clubId, now));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ukendt fejl";
      console.error(`Lysstyring fejlede for klub ${control.clubId}:`, error);
      results.push({
        clubId: control.clubId,
        checked: 0,
        changed: 0,
        failed: 1,
        skipped: message,
      });
    }
  }
  return results;
}

/** Åbner klubbens dør, men kun for ejeren af en aktiv booking. */
export async function unlockDoorForBooking(
  userId: string,
  bookingId: string,
  now = new Date()
) {
  const booking = await db.booking.findFirst({
    where: {
      id: bookingId,
      userId,
      kind: "COURT",
      status: "CONFIRMED",
    },
    include: {
      court: {
        include: {
          club: {
            include: {
              control: {
                include: {
                  club: { select: { name: true } },
                  devices: {
                    include: { channels: { where: { kind: "DOOR" } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking?.court) {
    throw new ClubControlError("Bookingen findes ikke eller giver ikke adgang.", 404);
  }
  const control = booking.court.club.control;
  if (!control?.enabled) {
    throw new ClubControlError("Klubbens digitale dørlås er ikke aktiv.", 409);
  }
  if (!canOpenDoor(booking, control, now)) {
    const window = accessWindow(booking, control);
    throw new ClubControlError(
      `Døren kan åbnes fra ${window.availableFrom.toLocaleString("da-DK")} til ${window.availableUntil.toLocaleString("da-DK")}.`,
      403
    );
  }

  const doorChannels: ChannelWithDevice[] = (control.devices as any[]).flatMap(
    (device) => device.channels.map((channel: any) => ({ ...channel, device }))
  );
  if (doorChannels.length === 0) {
    throw new ClubControlError("Klubben har ikke knyttet en dør til systemet.", 409);
  }

  // Reservér døren atomisk i databasen. En almindelig "find og opret"
  // ville lade to samtidige appkald slippe igennem, før det første nåede at
  // skrive sin hændelse. Låsen varer mindst hele dørpulsen, så et dobbelttap
  // heller ikke kan forlænge oplåsningen.
  const cooldownMs = Math.max(3, control.doorPulseSeconds) * 1_000;
  const reservation = await db.clubControlChannel.updateMany({
    where: {
      id: doorChannels[0].id,
      OR: [
        { lastCommandAt: null },
        { lastCommandAt: { lt: new Date(now.getTime() - cooldownMs) } },
      ],
    },
    data: { lastCommandAt: now },
  });
  if (reservation.count === 0) {
    throw new ClubControlError("Døren er allerede aktiveret.", 429);
  }

  let result: GroupResult;
  try {
    result = await commandSwitches(
      control,
      doorChannels.map((channel) => ({
        deviceId: channel.device.externalId,
        channel: channel.channel,
        label: channel.label,
      })),
      true,
      control.doorPulseSeconds,
      "door"
    );

    const failures = doorChannels
      .map((channel) =>
        result.failed.get(refKey({ deviceId: channel.device.externalId, channel: channel.channel }))
      )
      .filter((value): value is string => Boolean(value));
    if (failures.length === doorChannels.length) {
      throw new Error(failures[0] ?? "Alle dørkommandoer fejlede.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Døren kunne ikke åbnes.";
    await db
      .$transaction([
        db.clubControlChannel.updateMany({
          where: { id: { in: doorChannels.map((channel) => channel.id) } },
          data: { lastState: null, lastCommandAt: now, lastError: message },
        }),
        db.clubControlEvent.create({
          data: {
            clubId: booking.court.clubId,
            bookingId,
            userId,
            action: "DOOR_OPEN",
            outcome: "FAILED",
            message,
          },
        }),
      ])
      .catch((auditError) => console.error("Dørfejl kunne ikke logges:", auditError));
    throw new ClubControlError(
      "Døren svarede ikke. Prøv igen, eller kontakt klubben.",
      502
    );
  }

  const events = doorChannels.map((channel) => {
    const failure = result.failed.get(refKey({ deviceId: channel.device.externalId, channel: channel.channel }));
    return {
      clubId: booking.court!.clubId,
      bookingId,
      userId,
      deviceExternalId: channel.device.externalId,
      channel: channel.channel,
      action: "DOOR_OPEN",
      outcome: failure ? "FAILED" : "OK",
      message: failure ?? null,
    };
  });
  await db
    .$transaction([
      db.clubControlEvent.createMany({ data: events }),
      ...doorChannels.map((channel) => {
        const failure = result.failed.get(refKey({ deviceId: channel.device.externalId, channel: channel.channel }));
        return db.clubControlChannel.update({
          where: { id: channel.id },
          data: {
            // Shelly slukker selv igen efter pulsen, så den vedvarende
            // tilstand skal læses på ny ved næste statuskontrol.
            lastState: null,
            lastCommandAt: now,
            lastError: failure ?? null,
          },
        });
      }),
    ])
    // Døren er allerede fysisk aktiveret. En isoleret auditfejl må derfor
    // ikke få appen til at fortælle brugeren, at åbningen mislykkedes.
    .catch((auditError) => console.error("Døråbning kunne ikke logges:", auditError));

  return {
    ok: true,
    label: doorChannels[0].label || "Døren",
    unlockSeconds: control.doorPulseSeconds,
  };
}

/** Kort testpuls fra klubadministrationen efter fysisk montering. */
export async function testClubControlChannel(clubId: string, channelId: string) {
  const channel = await db.clubControlChannel.findFirst({
    where: { id: channelId, device: { control: { clubId } } },
    include: { device: { include: { control: { include: { club: { select: { name: true } } } } } } },
  });
  if (!channel) throw new Error("Relækanalen findes ikke.");

  const control = channel.device.control;
  if (control.enabled) return { error: "Sæt styringen på pause før en fysisk test." };
  if (channel.kind === "UNUSED") return { error: "Vælg først hvad relæet styrer." };
  const now = new Date();
  const claimed = await db.$transaction(async tx => {
    const lock = await tx.clubControl.updateMany({
      where: { id: control.id, enabled: false, OR: [{ setupTestLockedUntil: null }, { setupTestLockedUntil: { lte: now } }] },
      data: { setupTestLockedUntil: new Date(now.getTime() + 15_000) },
    });
    if (!lock.count) return null;
    return tx.clubControlChannel.update({ where: { id: channel.id, updatedAt: channel.updatedAt }, data: { setupTestedAt: null, setupConfirmedAt: null } });
  });
  if (!claimed) return { error: "En test er i gang. Vent 15 sekunder, før du tester igen." };
  try {
    const result = await commandSwitches(
      control,
      [{ deviceId: channel.device.externalId, channel: channel.channel, label: channel.label }],
      true,
      3,
      "test"
    );
    const failure = result.failed.get(refKey({ deviceId: channel.device.externalId, channel: channel.channel }));
    if (failure) throw new Error(failure);

    await db.$transaction([
      db.clubControlChannel.update({
        where: { id: channel.id, updatedAt: claimed.updatedAt },
        // Null, fordi Shelly selv slukker igen efter tre sekunder.
        data: { lastState: null, lastCommandAt: new Date(), lastError: null, setupTestedAt: new Date(), setupConfirmedAt: null },
      }),
      db.clubControlEvent.create({
        data: {
          clubId,
          deviceExternalId: channel.device.externalId,
          channel: channel.channel,
          action: "ADMIN_TEST",
          outcome: "OK",
        },
      }),
    ]);
    return { ok: "Relæet blev aktiveret i 3 sekunder." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Testen fejlede.";
    await db.clubControlChannel.update({
      where: { id: channel.id },
      data: { lastCommandAt: new Date(), lastError: message, setupTestedAt: null, setupConfirmedAt: null },
    });
    await db.clubControlEvent.create({
      data: {
        clubId,
        deviceExternalId: channel.device.externalId,
        channel: channel.channel,
        action: "ADMIN_TEST",
        outcome: "FAILED",
        message,
      },
    });
    return { error: message };
  }
}
