"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { safeNextPath } from "@/lib/auth/redirect";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getEnv } from "@/lib/env";
import { createUser, findUserByUsername, usernameProblem, UsernameTakenError } from "@/lib/queries/users";

export interface LoginState {
  error?: string;
  /** What the user typed, so a failed attempt does not clear the form. */
  username?: string;
}

async function startSession(userId: number, next: FormDataEntryValue | null): Promise<never> {
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(userId, getEnv().SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(String(next ?? "")));
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const user = username && password ? await findUserByUsername(getDb(), username) : null;
  // Same message for an unknown user and a wrong password: never reveal which accounts exist.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Usuário ou senha incorretos", username };
  }
  return startSession(user.id, form.get("next"));
}

export async function signupAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const env = getEnv();
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const invite = String(form.get("invite") ?? "");

  if (!checkPassword(invite, env.APP_PASSWORD)) return { error: "Código de convite incorreto", username };
  const problem = usernameProblem(username);
  if (problem) return { error: problem, username };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`, username };
  if (password !== confirm) return { error: "As senhas não conferem.", username };

  let userId: number;
  try {
    userId = await createUser(getDb(), username, await hashPassword(password));
  } catch (e) {
    if (e instanceof UsernameTakenError) return { error: e.message, username };
    throw e;
  }
  return startSession(userId, form.get("next"));
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
