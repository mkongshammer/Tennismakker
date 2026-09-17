import { normaliseShellyDeviceId } from "./shelly-cloud";

export function parseSetupDeviceIds(value: string): string[] {
  const ids = [...new Set(value.trim().split(/[\s,;]+/).filter(Boolean).map(normaliseShellyDeviceId))];
  if (!ids.length || ids.length > 10) throw new Error("Indsæt 1–10 enheds-ID’er, ét pr. linje.");
  return ids;
}

type SetupDevice = {
  channelCount: number;
  channels: { channel: number; kind: string; courtId: string | null; setupConfirmedAt: unknown }[];
};

export function setupProgress(devices: SetupDevice[]) {
  let total = 0, completed = 0, active = 0;
  for (const device of devices) {
    total += device.channelCount;
    for (let n = 0; n < device.channelCount; n++) {
      const channel = device.channels.find(c => c.channel === n);
      if (!channel) continue;
      const valid = ["UNUSED", "COMMON_LIGHT", "DOOR"].includes(channel.kind)
        || (channel.kind === "COURT_LIGHT" && Boolean(channel.courtId));
      if (valid && channel.setupConfirmedAt) completed++;
      if (valid && channel.kind !== "UNUSED") active++;
    }
  }
  return { total, completed, active, ready: total > 0 && completed === total && active > 0 };
}
