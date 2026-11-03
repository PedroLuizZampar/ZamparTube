import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../helpers/db";
import { CH_A, insertChannel } from "../helpers/fixtures";
import type { Db } from "@/lib/db/client";

let db: Db;
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
const { GET } = await import("@/app/avatar/[id]/route");

const call = (id: string) => GET(new Request(`http://x/avatar/${id}`), { params: Promise.resolve({ id }) });

describe("GET /avatar/[id]", () => {
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("serves the stored image with long cache headers", async () => {
    await insertChannel(db, CH_A, { avatarData: Buffer.from([1, 2, 3]).toString("base64"), avatarContentType: "image/png" });
    const res = await call(CH_A);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toMatch(/max-age=\d{5,}/);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("404 when the channel has no stored avatar", async () => {
    await insertChannel(db, CH_A);
    expect((await call(CH_A)).status).toBe(404);
    expect((await call("UCnope")).status).toBe(404);
  });
});
