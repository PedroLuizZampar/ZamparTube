import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { isUniqueViolation } from "@/lib/db/errors";
import { users } from "@/lib/db/schema";

export class UsernameTakenError extends Error {
  constructor() {
    super("Esse nome de usuário já está em uso.");
    this.name = "UsernameTakenError";
  }
}

/** Trims and collapses runs of spaces, so "  Pedro   Zampar " and "Pedro Zampar" are the same name. */
export function normalizeUsername(username: string): string {
  return username.trim().replace(/\s+/g, " ");
}

/**
 * Letters, digits, spaces, dot, dash and underscore; 3–30 characters (after normalizing). The error message, or null
 * when valid.
 */
export function usernameProblem(username: string): string | null {
  const name = normalizeUsername(username);
  if (name.length < 3 || name.length > 30) return "O usuário precisa ter de 3 a 30 caracteres.";
  if (!/^[\p{L}\p{N} ._-]+$/u.test(name)) return "Use só letras, números, espaço, ponto, hífen ou sublinhado no usuário.";
  return null;
}

/** An account that can sign in (the placeholder owner, without a password, never matches). Case-insensitive. */
export async function findUserByUsername(
  db: Db,
  username: string,
): Promise<{ id: number; username: string; passwordHash: string } | null> {
  const [row] = await db
    .select({ id: users.id, username: users.username, passwordHash: users.passwordHash })
    .from(users)
    .where(and(sql`lower(${users.username}) = lower(${normalizeUsername(username)})`, isNotNull(users.passwordHash)));
  return row?.passwordHash ? { id: row.id, username: row.username, passwordHash: row.passwordHash } : null;
}

export async function getUsername(db: Db, id: number): Promise<string | null> {
  const [row] = await db.select({ username: users.username }).from(users).where(eq(users.id, id));
  return row?.username ?? null;
}

export interface Profile {
  id: number;
  username: string;
  /** "/profile-image?v=<update time>" once a photo is stored, "" otherwise (the UI shows the initial). */
  imageSrc: string;
  /** For checking the current password when changing it. */
  passwordHash: string | null;
}

export async function getProfile(db: Db, id: number): Promise<Profile | null> {
  const [row] = await db
    .select({
      id: users.id,
      username: users.username,
      passwordHash: users.passwordHash,
      imageSrc: sql<string>`case when ${users.imageData} is null then ''
        else '/profile-image?v=' || ((extract(epoch from ${users.imageUpdatedAt}) * 1000)::bigint)::text end`,
    })
    .from(users)
    .where(eq(users.id, id));
  return row ?? null;
}

/**
 * Creates an account. The first one takes over the placeholder owner left by migration 0007 (no password), so it
 * keeps every channel, category, playlist and history entry from before accounts existed.
 */
export async function createUser(db: Db, username: string, passwordHash: string): Promise<number> {
  const name = normalizeUsername(username);
  try {
    const [placeholder] = await db
      .select({ id: users.id })
      .from(users)
      .where(isNull(users.passwordHash))
      .orderBy(users.id)
      .limit(1);
    if (placeholder) {
      // Guarded by "still no password", so two sign-ups at once cannot both take it.
      const [claimed] = await db
        .update(users)
        .set({ username: name, passwordHash })
        .where(and(eq(users.id, placeholder.id), isNull(users.passwordHash)))
        .returning({ id: users.id });
      if (claimed) return claimed.id;
    }
    const [row] = await db.insert(users).values({ username: name, passwordHash }).returning({ id: users.id });
    return row.id;
  } catch (e) {
    throw isUniqueViolation(e) ? new UsernameTakenError() : e;
  }
}

/** Changes the username; a case change of one's own name is allowed. Names are unique ignoring case. */
export async function renameUser(db: Db, id: number, username: string): Promise<void> {
  const name = normalizeUsername(username);
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.username}) = lower(${name})`, ne(users.id, id)))
    .limit(1);
  if (taken) throw new UsernameTakenError();
  try {
    await db.update(users).set({ username: name }).where(eq(users.id, id));
  } catch (e) {
    throw isUniqueViolation(e) ? new UsernameTakenError() : e;
  }
}

export async function setPasswordHash(db: Db, id: number, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

/** Stores (or with null, removes) the user's profile photo. */
export async function setUserImage(
  db: Db,
  id: number,
  img: { data: string; contentType: string } | null,
): Promise<void> {
  await db
    .update(users)
    .set(
      img
        ? { imageData: img.data, imageContentType: img.contentType, imageUpdatedAt: new Date() }
        : { imageData: null, imageContentType: null, imageUpdatedAt: null },
    )
    .where(eq(users.id, id));
}

export async function getUserImage(db: Db, id: number): Promise<{ data: string; contentType: string } | null> {
  const [row] = await db
    .select({ data: users.imageData, contentType: users.imageContentType })
    .from(users)
    .where(eq(users.id, id));
  return row?.data && row.contentType ? { data: row.data, contentType: row.contentType } : null;
}
