import { load } from "../../../../lib/images";

// Alle billeder hentes via denne adresse, uanset hvor filen ligger.
//
// Ligger den hos en lagringstjeneste, sender vi browseren derhen. Det
// koster ét ekstra kald første gang, men til gengæld skal resten af koden
// aldrig vide, hvor filen er — og et skifte af udbyder ændrer ingen sider.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const image = await load(params.id);
  if (!image) return new Response("Not found", { status: 404 });

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
