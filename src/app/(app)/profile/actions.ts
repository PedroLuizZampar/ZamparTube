"use server";

import { revalidatePath } from "next/cache";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { requireUserId } from "@/lib/auth/require";
import { getDb } from "@/lib/db/client";
import { parseImageUpload } from "@/lib/images";
import { getProfile, renameUser, setPasswordHash, setUserImage, usernameProblem, UsernameTakenError } from "@/lib/queries/users";

export interface ProfileState {
  ok: boolean;
  message: string;
}

const done = () => revalidatePath("/", "layout");

export async function renameUserAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const userId = await requireUserId();
  const username = String(form.get("username") ?? "");
  const problem = usernameProblem(username);
  if (problem) return { ok: false, message: problem };
  try {
    await renameUser(getDb(), userId, username);
  } catch (e) {
    if (e instanceof UsernameTakenError) return { ok: false, message: e.message };
    throw e;
  }
  done();
  return { ok: true, message: "Nome de usuário salvo." };
}

export async function changePasswordAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const userId = await requireUserId();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const db = getDb();
  const profile = await getProfile(db, userId);
  if (!profile?.passwordHash || !(await verifyPassword(current, profile.passwordHash))) {
    return { ok: false, message: "A senha atual está incorreta." };
  }
  if (next.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }
  if (next !== confirm) return { ok: false, message: "As senhas novas não conferem." };
  await setPasswordHash(db, userId, await hashPassword(next));
  return { ok: true, message: "Senha alterada." };
}

/** Sets (form field "image") or, with form field "remove", clears the profile photo. */
export async function setProfileImageAction(form: FormData): Promise<ProfileState> {
  const userId = await requireUserId();
  if (form.get("remove")) {
    await setUserImage(getDb(), userId, null);
    done();
    return { ok: true, message: "" };
  }
  const img = await parseImageUpload(form.get("image"));
  if ("error" in img) return { ok: false, message: img.error };
  await setUserImage(getDb(), userId, img);
  done();
  return { ok: true, message: "" };
}
