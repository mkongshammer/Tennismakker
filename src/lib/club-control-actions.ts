"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "./db";
import { seal } from "./crypto-box";
import { getCurrentUser } from "./session";
import {
  inspectShellyDevices,
  reconcileClubControl,
  testClubControlChannel,
} from "./club-control";
import {
  normaliseShellyDeviceId,
  normaliseShellyServerUrl,
  shellyChannelCount,
} from "./shelly-cloud";

type FormResult = { ok?: string; error?: string } | null;

async function requireClubAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CLUB_ADMIN" || !user.clubId) {
    throw new Error("Kun klub-administratorer har adgang til dette.");
  }
  return { user, clubId: user.clubId as string };
}

function integerField(
  formData: FormData,
  name: string,
  fallback: number,
  min: number,
  max: number
) {
  const value = Number(formData.get(name) ?? fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export async function saveControlConnection(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const existing = await db.clubControl.findUnique({
    where: { clubId },
    include: { devices: true, _count: { select: { devices: true } } },
  });

  let serverUrl: string;
  try {
    serverUrl = normaliseShellyServerUrl(String(formData.get("serverUrl") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Ugyldig Server URI." };
  }

  const rawAuthKey = String(formData.get("authKey") ?? "").trim();
  if (!existing && rawAuthKey.length < 16) {
    return { error: "Indsæt Authorization Cloud Key fra Shelly-appen." };
  }
  if (rawAuthKey && (rawAuthKey.length < 16 || rawAuthKey.length > 1_000)) {
    return { error: "Shelly-nøglen ser ikke gyldig ud." };
  }

  const enabled = formData.get("enabled") === "on";
  const mappingCount = existing
    ? await db.clubControlChannel.count({
        where: { device: { controlId: existing.id } },
      })
    : 0;
  if (enabled && mappingCount === 0) {
    return {
      error: "Tilføj controllerne og fordel mindst én relækanal, før styringen aktiveres.",
    };
  }

  const authKeyCipher = rawAuthKey ? seal(rawAuthKey) : existing?.authKeyCipher;
  if (!authKeyCipher) return { error: "Shelly-nøglen mangler." };

  // Når en eksisterende forbindelse ændres, testes de gemte enheder med de
  // nye værdier før vi overskriver en fungerende opsætning.
  if (existing?.devices.length) {
    try {
      await inspectShellyDevices(
        { id: existing.id, serverUrl, authKeyCipher },
        existing.devices.map((device: any) => device.externalId)
      );
    } catch (error) {
      return {
        error: `Forbindelsen blev ikke gemt: ${
          error instanceof Error ? error.message : "Shelly Cloud kunne ikke kontaktes."
        }`,
      };
    }
  }

  await db.clubControl.upsert({
    where: { clubId },
    create: {
      clubId,
      serverUrl,
      authKeyCipher,
      enabled,
      accessBeforeMinutes: integerField(formData, "accessBeforeMinutes", 15, 0, 120),
      accessAfterMinutes: integerField(formData, "accessAfterMinutes", 15, 0, 120),
      doorPulseSeconds: integerField(formData, "doorPulseSeconds", 5, 1, 30),
      lightsBeforeMinutes: integerField(formData, "lightsBeforeMinutes", 10, 0, 120),
      lightsAfterMinutes: integerField(formData, "lightsAfterMinutes", 5, 0, 120),
      lastError: null,
    },
    update: {
      serverUrl,
      authKeyCipher,
      enabled,
      accessBeforeMinutes: integerField(formData, "accessBeforeMinutes", 15, 0, 120),
      accessAfterMinutes: integerField(formData, "accessAfterMinutes", 15, 0, 120),
      doorPulseSeconds: integerField(formData, "doorPulseSeconds", 5, 1, 30),
      lightsBeforeMinutes: integerField(formData, "lightsBeforeMinutes", 10, 0, 120),
      lightsAfterMinutes: integerField(formData, "lightsAfterMinutes", 5, 0, 120),
      lastError: null,
    },
  });

  revalidatePath("/admin");
  return {
    ok: enabled
      ? "Lys og adgang er aktiveret."
      : "Shelly-forbindelsen er gemt, men endnu ikke aktiveret.",
  };
}
export async function addControlDevice(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const control = await db.clubControl.findUnique({ where: { clubId } });
  if (!control) return { error: "Gem Shelly-forbindelsen først." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "Giv controlleren et navn." };

  let externalId: string;
  try {
    externalId = normaliseShellyDeviceId(String(formData.get("externalId") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Ugyldigt Device ID." };
  }

  let state;
  try {
    [state] = await inspectShellyDevices(control, [externalId]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Controlleren kunne ikke testes." };
  }
  if (!state || state.id.toLowerCase() !== externalId) {
    return { error: "Device ID findes ikke på den forbundne Shelly-konto." };
  }

  const requestedChannels = integerField(formData, "channelCount", 3, 1, 8);
  const channelCount = shellyChannelCount(state) ?? requestedChannels;
  try {
    await db.clubControlDevice.create({
      data: {
        controlId: control.id,
        name,
        externalId,
        model: state.code ?? null,
        channelCount,
        online: state.online === 1,
        lastSeenAt: state.online === 1 ? new Date() : null,
      },
    });
  } catch {
    return { error: "Controlleren er allerede tilføjet til klubben." };
  }

  revalidatePath("/admin");
  return {
    ok: `${name} er tilføjet med ${channelCount} relækanal${channelCount === 1 ? "" : "er"}.`,
  };
}

export async function refreshControlDevice(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const id = String(formData.get("deviceId") ?? "");
  const device = await db.clubControlDevice.findFirst({
    where: { id, control: { clubId } },
    include: { control: true },
  });
  if (!device) return;

  try {
    const [state] = await inspectShellyDevices(device.control, [device.externalId]);
    await db.clubControlDevice.update({
      where: { id },
      data: {
        online: state?.online === 1,
        lastSeenAt: state?.online === 1 ? new Date() : device.lastSeenAt,
        model: state?.code ?? device.model,
        channelCount: shellyChannelCount(state) ?? device.channelCount,
      },
    });
    await db.clubControl.update({
      where: { id: device.controlId },
      data: {
        lastCheckedAt: new Date(),
        lastOkAt: state ? new Date() : device.control.lastOkAt,
        lastError: state ? null : "Enheden blev ikke returneret af Shelly Cloud.",
      },
    });
  } catch (error) {
    await db.clubControl.update({
      where: { id: device.controlId },
      data: {
        lastCheckedAt: new Date(),
        lastError: error instanceof Error ? error.message : "Status kunne ikke hentes.",
      },
    });
  }
  revalidatePath("/admin");
}

export async function removeControlDevice(formData: FormData) {
  const { clubId } = await requireClubAdmin();
  const id = String(formData.get("deviceId") ?? "");
  const device = await db.clubControlDevice.findFirst({
    where: { id, control: { clubId } },
    select: { id: true, controlId: true },
  });
  if (!device) return;

  await db.$transaction([
    db.clubControlDevice.delete({ where: { id: device.id } }),
    // En aktiv opsætning uden alle sine relæer må ikke fortsætte automatisk.
    db.clubControl.update({
      where: { id: device.controlId },
      data: { enabled: false, lastError: "En controller blev fjernet. Kontrollér opsætningen." },
    }),
  ]);
  revalidatePath("/admin");
}

export async function saveControlMappings(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const deviceId = String(formData.get("deviceId") ?? "");
  const device = await db.clubControlDevice.findFirst({
    where: { id: deviceId, control: { clubId } },
  });
  if (!device) return { error: "Controlleren findes ikke." };

  const courts = await db.court.findMany({
    where: { clubId },
    select: { id: true, name: true },
  });
  const courtById = new Map(courts.map((court: any) => [court.id, court.name]));

  for (let channel = 0; channel < device.channelCount; channel++) {
    const assignment = String(formData.get(`assignment_${channel}`) ?? "UNUSED");
    const customLabel = String(formData.get(`label_${channel}`) ?? "").trim().slice(0, 80);

    if (assignment === "UNUSED") {
      await db.clubControlChannel.deleteMany({ where: { deviceId, channel } });
      continue;
    }

    let kind: "COURT_LIGHT" | "COMMON_LIGHT" | "DOOR";
    let courtId: string | null = null;
    let fallbackLabel: string;
    if (assignment.startsWith("COURT_LIGHT:")) {
      kind = "COURT_LIGHT";
      courtId = assignment.slice("COURT_LIGHT:".length);
      const courtName = courtById.get(courtId);
      if (!courtName) return { error: "En af de valgte baner tilhører ikke klubben." };
      fallbackLabel = `${courtName} lys`;
    } else if (assignment === "COMMON_LIGHT") {
      kind = "COMMON_LIGHT";
      fallbackLabel = "Gangbelysning";
    } else if (assignment === "DOOR") {
      kind = "DOOR";
      fallbackLabel = "Hoveddør";
    } else {
      return { error: "Ukendt relæfunktion." };
    }

    await db.clubControlChannel.upsert({
      where: { deviceId_channel: { deviceId, channel } },
      create: {
        deviceId,
        channel,
        kind,
        courtId,
        label: customLabel || fallbackLabel,
      },
      update: {
        kind,
        courtId,
        label: customLabel || fallbackLabel,
        lastState: null,
        lastError: null,
      },
    });
  }

  await db.clubControl.update({
    where: { id: device.controlId },
    data: { enabled: false, lastError: null },
  });
  revalidatePath("/admin");
  return {
    ok: "Kanalerne er gemt. Gennemgå dem, test relæerne, og aktivér derefter styringen.",
  };
}

export async function testControlChannel(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const result = await testClubControlChannel(
    clubId,
    String(formData.get("channelId") ?? "")
  );
  revalidatePath("/admin");
  return result;
}

export async function runControlNow(
  _prev: FormResult,
  _formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const result = await reconcileClubControl(clubId);
  revalidatePath("/admin");
  if (result.skipped) return { error: `Styringen blev ikke kørt: ${result.skipped}.` };
  if (result.failed > 0) {
    return {
      error: `${result.failed} kanal(er) fejlede. ${result.changed} blev opdateret.`,
    };
  }
  return {
    ok: `Forbindelsen virker. ${result.checked} kanal(er) kontrolleret, ${result.changed} ændret.`,
  };
}
