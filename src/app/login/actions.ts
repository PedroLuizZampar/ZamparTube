"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkPassword, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { getEnv } from "@/lib/env";

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const env = getEnv();
  const password = String(form.get("password") ?? "");
  if (!checkPassword(password, env.APP_PASSWORD)) return { error: "Senha incorreta" };

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(env.SESSION_SECRET), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(safeNextPath(String(form.get("next") ?? "")));
}
