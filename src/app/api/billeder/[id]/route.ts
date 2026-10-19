import { load } from "../../../../lib/images";
import { parseVariantWidth, variant } from "../../../../lib/image-variants";

// Alle billeder hentes via denne adresse, uanset hvor filen ligger.
//
// Ligger den hos en lagringstjeneste, sender vi browseren derhen. Det
// koster ét ekstra kald første gang, men til gengæld skal resten af koden
// aldrig vide, hvor filen er — og et skifte af udbyder ændrer ingen sider.
//
// `?w=480` (whitelisted widths) answers with a card-sized WebP variant made
// on demand and cached in memory — see src/lib/image-variants.ts.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const image = await load(id);
  if (!image) return new Response("Not found", { status: 404 });

  const width = parseVariantWidth(new URL(req.url).searchParams.get("w"));
  if (width) {
    const out = await variant(id, width, async () => {
      if (image.bytes) return Buffer.from(image.bytes);
      if (!image.publicUrl) return null;
      const res = await fetch(image.publicUrl, { cache: "force-cache" }).catch(() => null);
      return res && res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    });
    if (out) {
      return new Response(new Uint8Array(out.bytes), {
        headers: { "Content-Type": out.mime, "Cache-Control": "public, max-age=31536000, immutable" },
      });
    }
    // Fall through to the original if the variant could not be made.
  }

  if (image.publicUrl) {
    return Response.redirect(image.publicUrl, 308);
  }

  if (!image.bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
