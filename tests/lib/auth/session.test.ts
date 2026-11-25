import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { checkPassword, createSessionToken, isPublicPath, verifySessionToken } from "@/lib/auth/session";

const SECRET = "a-very-long-secret-value-for-tests-1234567890";

describe("session token", () => {
  it("roundtrip gives back the user id", async () => {
    expect(await verifySessionToken(await createSessionToken(42, SECRET), SECRET)).toBe(42);
  });

  it("fails with a wrong secret, garbage or undefined", async () => {
    const token = await createSessionToken(7, SECRET);
    expect(await verifySessionToken(token, "another-secret-another-secret-123456")).toBeNull();
    expect(await verifySessionToken("garbage", SECRET)).toBeNull();
    expect(await verifySessionToken(undefined, SECRET)).toBeNull();
  });

  it("rejects a token from before accounts (subject 'owner')", async () => {
    const legacy = await new SignJWT({ sub: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(legacy, SECRET)).toBeNull();
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
    "/signup",
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
