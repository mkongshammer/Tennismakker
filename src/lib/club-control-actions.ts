"use server";

import { requireCustomClub } from "./club-management-actions";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { seal } from "./crypto-box";
import { parseSetupDeviceIds, setupProgress } from "./club-control-setup";
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
  await requireCustomClub();
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
  if (enabled) {
    const devices = await db.clubControlDevice.findMany({ where: { controlId: existing?.id ?? "" }, include: { channels: true } });
    if (!setupProgress(devices).ready) return { error: "Gennemgå og bekræft alle relæer i guiden først." };
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

  revalidatePath("/admin", "layout");
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

  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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
  revalidatePath("/admin", "layout");
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
  const operations: Prisma.PrismaPromise<unknown>[] = [];

  for (let channel = 0; channel < device.channelCount; channel++) {
    const assignment = String(formData.get(`assignment_${channel}`) ?? "UNUSED");
    const customLabel = String(formData.get(`label_${channel}`) ?? "").trim().slice(0, 80);

    if (assignment === "UNUSED") {
      operations.push(db.clubControlChannel.deleteMany({ where: { deviceId, channel } }));
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

    operations.push(db.clubControlChannel.upsert({
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
        setupTestedAt: null,
        setupConfirmedAt: null,
      },
    }));
  }

  operations.push(db.clubControl.update({
    where: { id: device.controlId },
    data: { enabled: false, lastError: null },
  }));
  // Validate every assignment before making changes; apply mappings and the
  // safety disable atomically so an invalid form cannot leave a partial setup.
  await db.$transaction(operations);
  revalidatePath("/admin", "layout");
  return {
    ok: "Kanalerne er gemt. Gennemgå dem, test relæerne, og aktivér derefter styringen.",
  };
}

export async function testControlChannel(
  _prev: FormResult,
  formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  if (formData.get("safeToTest") !== "on") return { error: "Bekræft først, at det er sikkert at teste relæet." };
  const result = await testClubControlChannel(
    clubId,
    String(formData.get("channelId") ?? "")
  );
  revalidatePath("/admin", "layout");
  return result;
}

/** One connection form: validate all supplied devices before saving anything. */
export async function connectControlSetup(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const existing = await db.clubControl.findUnique({ where: { clubId } });
  if (existing?.enabled) return { error: "Sæt styringen på pause, før forbindelsen ændres." };
  try {
    const serverUrl = normaliseShellyServerUrl(String(formData.get("serverUrl") ?? ""));
    const ids = parseSetupDeviceIds(String(formData.get("deviceIds") ?? ""));
    const key = String(formData.get("authKey") ?? "").trim();
    if (key && (key.length < 16 || key.length > 1000)) return { error: "Kopiér hele Authorization Cloud Key fra Shelly." };
    const authKeyCipher = key ? seal(key) : existing?.authKeyCipher;
    if (!authKeyCipher) return { error: "Indsæt nøglen fra Shelly." };
    const states = await inspectShellyDevices({ id: existing?.id ?? clubId, serverUrl, authKeyCipher }, ids);
    const devices = ids.map(id => {
      const state = states.find(s => s.id.toLowerCase() === id);
      if (!state || state.online !== 1) throw new Error(`Enhed ${id} er ikke online. Åbn Shelly og kontrollér Cloud-forbindelsen og ID’et.`);
      const count = shellyChannelCount(state);
      if (!count || count > 8) throw new Error(`Enhed ${id} har ingen understøttede relæer. Brug en online Shelly med switch-kanaler.`);
      return { id, state, count };
    });
    await db.$transaction(async tx => {
      const control = await tx.clubControl.upsert({ where: { clubId },
        create: { clubId, serverUrl, authKeyCipher, enabled: false },
        update: { serverUrl, authKeyCipher, enabled: false, lastError: null } });
      if (key || existing?.serverUrl !== serverUrl) {
        await tx.clubControlChannel.updateMany({ where: { device: { controlId: control.id } }, data: { setupTestedAt: null, setupConfirmedAt: null } });
      }
      for (const [index, device] of devices.entries()) {
        const saved = await tx.clubControlDevice.upsert({
          where: { controlId_externalId: { controlId: control.id, externalId: device.id } },
          create: { controlId: control.id, externalId: device.id, name: `Controller ${index + 1}`, channelCount: device.count, model: device.state.code, online: true, lastSeenAt: new Date() },
          update: { channelCount: device.count, model: device.state.code, online: true, lastSeenAt: new Date() },
        });
        await tx.clubControlChannel.deleteMany({ where: { deviceId: saved.id, channel: { gte: device.count } } });
      }
    });
    revalidatePath("/admin", "layout");
    return { ok: `${devices.length} controller(e) forbundet. Vælg nu hvad hvert relæ styrer.` };
  } catch (error) { return { error: error instanceof Error ? error.message : "Forbindelsen kunne ikke gemmes. Prøv igen." }; }
}

export async function saveSetupChannel(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const deviceId = String(formData.get("deviceId") ?? "");
  const channel = Number(formData.get("channel"));
  const device = await db.clubControlDevice.findFirst({ where: { id: deviceId, control: { clubId } }, include: { control: true } });
  if (!device || !Number.isInteger(channel) || channel < 0 || channel >= device.channelCount) return { error: "Relæet findes ikke." };
  if (device.control.enabled) return { error: "Sæt styringen på pause først." };
  const choice = String(formData.get("assignment") ?? "");
  let kind = choice, courtId: string | null = null, label = "";
  if (choice.startsWith("COURT_LIGHT:")) {
    courtId = choice.slice(12);
    const court = await db.court.findFirst({ where: { id: courtId, clubId } });
    if (!court) return { error: "Vælg en af klubbens baner." };
    kind = "COURT_LIGHT"; label = `${court.name} lys`;
  } else if (choice === "COMMON_LIGHT") label = "Gang / fælleslys";
  else if (choice === "DOOR") label = "Dør";
  else if (choice === "UNUSED") label = "Ikke tilsluttet";
  else return { error: "Vælg hvad relæet styrer." };
  const data = { kind, courtId, label, setupTestedAt: null, setupConfirmedAt: kind === "UNUSED" ? new Date() : null, lastError: null };
  await db.$transaction([
    db.clubControlChannel.upsert({ where: { deviceId_channel: { deviceId, channel } }, create: { deviceId, channel, ...data }, update: data }),
    db.clubControl.update({ where: { id: device.controlId }, data: { enabled: false } }),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: kind === "UNUSED" ? "Relæet er markeret som ikke tilsluttet." : "Gemt. Test nu, om det er det rigtige lys eller den rigtige dør." };
}

export async function confirmSetupChannel(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  if (formData.get("observed") !== "on") return { error: "Bekræft, at du selv har set den rigtige funktion reagere og vende tilbage efter testen." };
  const testedAt = new Date(String(formData.get("testedAt") ?? ""));
  if (!Number.isFinite(testedAt.getTime())) return { error: "Test relæet først." };
  const result = await db.clubControlChannel.updateMany({ where: {
    id: String(formData.get("channelId") ?? ""), setupTestedAt: testedAt, lastError: null,
    device: { control: { clubId, enabled: false } },
  }, data: { setupConfirmedAt: new Date() } });
  revalidatePath("/admin", "layout");
  return result.count ? { ok: "Bekræftet. Fortsæt til næste relæ." } : { error: "Opsætningen er ændret. Test relæet igen." };
}

export async function pauseControlSetup(_prev: FormResult, _formData: FormData): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  await db.clubControl.updateMany({ where: { clubId }, data: { enabled: false } });
  revalidatePath("/admin", "layout");
  return { ok: "Automatik og appens dørknap er sat på pause. Lysenes aktuelle tilstand ændres ikke." };
}

export async function activateControlSetup(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const control = await db.clubControl.findUnique({ where: { clubId }, include: { devices: { include: { channels: true } } } });
  if (!control || !setupProgress(control.devices).ready) return { error: "Vælg funktion, test og bekræft alle tilsluttede relæer først." };
  if (formData.get("ready") !== "on") return { error: "Bekræft den samlede opsætning først." };
  try {
    for (let i = 0; i < control.devices.length; i += 10) {
      const batch = control.devices.slice(i, i + 10);
      const states = await inspectShellyDevices(control, batch.map(d => d.externalId));
      if (batch.some(d => !states.some(s => s.id.toLowerCase() === d.externalId && s.online === 1 && shellyChannelCount(s) === d.channelCount)))
        return { error: "En controller er offline eller ændret. Kontrollér forbindelsen i Shelly og prøv igen." };
    }
    const activated = await db.clubControl.updateMany({ where: { id: control.id, updatedAt: control.updatedAt }, data: {
      enabled: true, lastError: null,
      accessBeforeMinutes: integerField(formData, "accessBeforeMinutes", 15, 0, 120),
      accessAfterMinutes: integerField(formData, "accessAfterMinutes", 15, 0, 120),
      lightsBeforeMinutes: integerField(formData, "lightsBeforeMinutes", 10, 0, 120),
      lightsAfterMinutes: integerField(formData, "lightsAfterMinutes", 5, 0, 120),
      doorPulseSeconds: integerField(formData, "doorPulseSeconds", 5, 1, 30),
    } });
    if (!activated.count) return { error: "Opsætningen blev ændret under kontrollen. Gennemgå den og aktivér igen." };
    revalidatePath("/admin", "layout");
    return { ok: "Aktiveret. Lysene følger nu bookingerne ved næste minutkontrol." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Kunne ikke aktivere. Prøv igen." }; }
}

export async function runControlNow(
  _prev: FormResult,
  _formData: FormData
): Promise<FormResult> {
  const { clubId } = await requireClubAdmin();
  const result = await reconcileClubControl(clubId);
  revalidatePath("/admin", "layout");
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

export async function setManualLight(_prev:FormResult, formData:FormData):Promise<FormResult> {
  const {clubId,user}=await requireClubAdmin();
  const minutes=Number(formData.get('minutes'));
  if(![0,15,30,60,120].includes(minutes))return {error:'Vælg en gyldig varighed.'};
  const channel=await db.clubControlChannel.findFirst({where:{id:String(formData.get('channelId')),kind:{in:['COURT_LIGHT','COMMON_LIGHT']},setupConfirmedAt:{not:null},device:{control:{clubId,enabled:true}}},include:{device:true}});
  if(!channel)return {error:'Lysstyringen skal først tilknyttes, testes og aktiveres.'};
  await db.clubControlChannel.update({where:{id:channel.id},data:{manualOnUntil:minutes?new Date(Date.now()+minutes*60000):null}});
  await db.clubControlEvent.create({data:{clubId,userId:user.id,deviceExternalId:channel.device.externalId,channel:channel.channel,action:'ADMIN_LIGHT_OVERRIDE',outcome:'REQUESTED',message:minutes?`Manuelt tændt ønskes i ${minutes} minutter`:'Automatik genoptaget'}});
  const result=await reconcileClubControl(clubId);
  revalidatePath('/admin','layout');
  return result.failed?{error:'Anmodningen er gemt, men controlleren kunne ikke bekræftes. Kontrollér forbindelsen.'}:{ok:minutes?'Manuel lystid er aktiveret. Automatikken overtager efter perioden.':'Automatikken styrer igen lyset efter bookingerne.'};
}
