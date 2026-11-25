import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/** Shortest password accepted when creating an account or changing the password. */
export const MIN_PASSWORD_LENGTH = 8;

const KEY_LENGTH = 64;
const PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, PARAMS, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** "scrypt$<salt base64>$<hash base64>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64")}$${(await derive(password, salt)).toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
