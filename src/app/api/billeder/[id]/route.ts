import { load } from "../../../../lib/images";

// Billederne ligger i databasen, men skal opføre sig som statiske filer.
// Et billede ændrer sig aldrig — uploader klubben et nyt, får det et nyt
// id — så det kan caches så længe som muligt.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const image = await load(params.id);
  if (!image) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
