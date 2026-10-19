// Card-sized variants of stored images, made on demand and kept in a small
// in-process cache. The stored hero is up to 1600 px wide (~150 kB); a
// discovery page shows 24 cards, so sending the full hero to each would cost
// ~3.6 MB on a phone. A 480 px WebP is ~15 kB.
//
// Widths are whitelisted so the cache cannot be filled by arbitrary sizes.
import sharp from "sharp";

export const VARIANT_WIDTHS = [320, 480, 640, 960] as const;
export type VariantWidth = (typeof VARIANT_WIDTHS)[number];

const MAX_CACHE_BYTES = 48 * 1024 * 1024;
const cache = new Map<string, { bytes: Buffer; mime: string; at: number }>();
let cacheBytes = 0;

export function parseVariantWidth(raw: string | null): VariantWidth | null {
  const n = Number(raw);
  return (VARIANT_WIDTHS as readonly number[]).includes(n) ? (n as VariantWidth) : null;
}

/** Resize `source` to `width` (cover, 3:2 for card tiles), as WebP. Cached per (id, width). */
export async function variant(id: string, width: VariantWidth, source: () => Promise<Buffer | null>): Promise<{ bytes: Buffer; mime: string } | null> {
  const key = `${id}:${width}`;
  const hit = cache.get(key);
  if (hit) {
    hit.at = Date.now();
    return { bytes: hit.bytes, mime: hit.mime };
  }
  const input = await source();
  if (!input) return null;
  const bytes = await sharp(input, { failOn: "none" }).rotate().resize({ width, height: Math.round((width * 2) / 3), fit: "cover", position: "attention" }).webp({ quality: 78 }).toBuffer();
  cache.set(key, { bytes, mime: "image/webp", at: Date.now() });
  cacheBytes += bytes.length;
  while (cacheBytes > MAX_CACHE_BYTES && cache.size) {
    // Evict least recently used.
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [k, v] of cache) if (v.at < oldest) { oldest = v.at; oldestKey = k; }
    if (!oldestKey) break;
    cacheBytes -= cache.get(oldestKey)!.bytes.length;
    cache.delete(oldestKey);
  }
  return { bytes, mime: "image/webp" };
}
