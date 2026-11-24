import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, parseImageUpload } from "@/lib/images";

const file = (bytes: number, type: string) => new File([new Uint8Array(bytes)], "x", { type });

describe("parseImageUpload", () => {
  it("accepts a small PNG, JPEG or WebP and returns base64", async () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(await parseImageUpload(file(10, type))).toEqual({
        data: Buffer.alloc(10).toString("base64"),
        contentType: type,
      });
    }
  });

  it("rejects other types", async () => {
    expect(await parseImageUpload(file(10, "text/plain"))).toEqual({ error: "Use uma imagem JPG, PNG ou WebP." });
    expect(await parseImageUpload(file(10, "image/svg+xml"))).toEqual({ error: "Use uma imagem JPG, PNG ou WebP." });
  });

  it("rejects files that are too big or empty", async () => {
    expect(await parseImageUpload(file(MAX_IMAGE_BYTES + 1, "image/png"))).toEqual({ error: "A imagem é grande demais." });
    expect(await parseImageUpload(file(0, "image/png"))).toEqual({ error: "Escolha uma imagem." });
  });

  it("rejects a missing value", async () => {
    expect(await parseImageUpload(null)).toEqual({ error: "Escolha uma imagem." });
    expect(await parseImageUpload("texto")).toEqual({ error: "Escolha uma imagem." });
  });
});
