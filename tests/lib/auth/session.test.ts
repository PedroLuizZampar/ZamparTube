import { describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, isPublicPath, verifySessionToken } from "@/lib/auth/session";

const SECRET = "a-very-long-secret-value-for-tests-1234567890";

describe("session token", () => {
  it("roundtrip verifies", async () => {
    expect(await verifySessionToken(await createSessionToken(SECRET), SECRET)).toBe(true);
  });

  it("fails with a wrong secret, garbage or undefined", async () => {
    const token = await createSessionToken(SECRET);
    expect(await verifySessionToken(token, "another-secret-another-secret-123456")).toBe(false);
    expect(await verifySessionToken("garbage", SECRET)).toBe(false);
    expect(await verifySessionToken(undefined, SECRET)).toBe(false);
  });
});

describe("checkPassword", () => {
  it("true only for an exact match", () => {
    expect(checkPassword("segredo", "segredo")).toBe(true);
    expect(checkPassword("Segredo", "segredo")).toBe(false);
    expect(checkPassword("segredo-mais-longo", "segredo")).toBe(false);
    expect(checkPassword("", "segredo")).toBe(false);
  });
});

describe("isPublicPath", () => {
  it.each([
    "/login",
    "/api/cron/sync",
    "/_next/static/x.js",
    "/_next/image",
    "/manifest.webmanifest",
    "/icon.svg",
    "/icon-192.png",
    "/apple-icon.png",
    "/favicon.ico",
  ])("public %s", (p) => expect(isPublicPath(p)).toBe(true));

  it.each(["/", "/watch/abc", "/channels", "/api/anything", "/login-fake", "/api/cron/sync/../x"])(
    "private %s",
    (p) => expect(isPublicPath(p)).toBe(false),
  );
});
