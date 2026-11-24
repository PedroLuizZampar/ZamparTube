"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { CreateButton } from "@/components/CreateButton";
import { ImagePicker } from "@/components/ImagePicker";
import { NameEditor } from "@/components/NameEditor";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createCategoryQuickAction,
  deleteCategoryAction,
  renameCategoryAction,
  setCategoryImageAction,
} from "./actions";

/** Square: shown in round chips and on the category card. */
const CATEGORY_IMAGE_SIZE = { width: 256, height: 256 };

/** "Criar": makes a category with a free default name and opens its name for editing in the grid. */
export function CreateCategoryButton() {
  return <CreateButton create={createCategoryQuickAction} basePath="/categories" />;
}

/** Name + picture editing on a category card. */
export function CategoryEditor({ id, name, hasImage }: { id: number; name: string; hasImage: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <NameEditor
        initial={name}
        label="Nome da categoria"
        maxLength={60}
        rename={(value) => renameCategoryAction(id, value)}
        closeHref="/categories"
        focusId={`rename-category-${id}`}
      />
      <ImagePicker action={setCategoryImageAction.bind(null, id)} hasImage={hasImage} size={CATEGORY_IMAGE_SIZE} />
    </div>
  );
}

export function DeleteCategoryButton({ id, name }: { id: number; name: string }) {
  const [pending, start] = useTransition();
  return (
    <ConfirmDialog
      title={`Apagar a categoria "${name}"?`}
      description="Os canais dela continuam no app, só ficam sem categoria."
      confirmLabel="Apagar categoria"
      destructive
      onConfirm={() => start(() => deleteCategoryAction(id))}
      trigger={
        <button
          type="button"
          disabled={pending}
          aria-label={`Apagar ${name}`}
          title="Apagar"
          className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        </button>
      }
    />
  );
}
