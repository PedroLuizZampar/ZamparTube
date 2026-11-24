import type { StoredImage } from "@/lib/queries/images";

/** The client resizes before upload, so real uploads are far below this; anything bigger is refused. */
export const MAX_IMAGE_BYTES = 300 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Validates an uploaded picture (form value) and turns it into what the database stores. */
export async function parseImageUpload(value: FormDataEntryValue | null): Promise<StoredImage | { error: string }> {
  if (!(value instanceof File) || value.size === 0) return { error: "Escolha uma imagem." };
  if (!TYPES.has(value.type)) return { error: "Use uma imagem JPG, PNG ou WebP." };
  if (value.size > MAX_IMAGE_BYTES) return { error: "A imagem é grande demais." };
  return { data: Buffer.from(await value.arrayBuffer()).toString("base64"), contentType: value.type };
}
