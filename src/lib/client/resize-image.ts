/**
 * Crops an image file to the target aspect (centered, "cover") and scales it down in the browser,
 * so uploads stay small. Returns WebP, or JPEG where the browser cannot encode WebP.
 */
export async function resizeImage(file: File, size: { width: number; height: number }): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(size.width / bitmap.width, size.height / bitmap.height);
  const sw = size.width / scale;
  const sh = size.height / scale;
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - sw) / 2, (bitmap.height - sh) / 2, sw, sh, 0, 0, size.width, size.height);
  bitmap.close();
  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Browsers that cannot encode WebP silently return PNG; fall back to JPEG then.
  const webp = await encode("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg");
  if (!blob) throw new Error("Não foi possível processar a imagem");
  return blob;
}
