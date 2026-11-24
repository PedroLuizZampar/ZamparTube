"use server";

import { requireSession } from "@/lib/auth/require";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { parseImageUpload } from "@/lib/images";
import { setImage } from "@/lib/queries/images";
import { CategoryNameTakenError, createCategory, deleteCategory, renameCategory } from "@/lib/queries/channels";

export interface ActionState {
  ok: boolean;
  message: string;
}

const done = () => revalidatePath("/", "layout");
const validId = (id: number) => Number.isInteger(id) && id > 0;

/** "Criar" on the categories page: a category with a free default name; the page then opens its name for editing. */
export async function createCategoryQuickAction(): Promise<{ id: number }> {
  await requireSession();
  const id = await createCategory(getDb());
  done();
  return { id };
}

export async function renameCategoryAction(id: number, name: string): Promise<ActionState> {
  await requireSession();
  if (!validId(id)) return { ok: false, message: "Categoria inválida." };
  if (!name.trim()) return { ok: false, message: "O nome não pode ficar vazio." };
  try {
    await renameCategory(getDb(), id, name);
    done();
    return { ok: true, message: "" };
  } catch (e) {
    if (e instanceof CategoryNameTakenError) return { ok: false, message: e.message };
    return { ok: false, message: "Não foi possível renomear. Tente de novo." };
  }
}

export async function deleteCategoryAction(id: number): Promise<void> {
  await requireSession();
  if (!validId(id)) return;
  await deleteCategory(getDb(), id);
  done();
}

/** Sets (form field "image") or, with form field "remove", clears the category's picture. */
export async function setCategoryImageAction(id: number, form: FormData): Promise<ActionState> {
  await requireSession();
  if (!validId(id)) return { ok: false, message: "Categoria inválida." };
  if (form.get("remove")) {
    await setImage(getDb(), "category", id, null);
    done();
    return { ok: true, message: "" };
  }
  const img = await parseImageUpload(form.get("image"));
  if ("error" in img) return { ok: false, message: img.error };
  await setImage(getDb(), "category", id, img);
  done();
  return { ok: true, message: "" };
}
