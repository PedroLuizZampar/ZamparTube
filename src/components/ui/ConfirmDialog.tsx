"use client";

import type { ReactNode } from "react";
import * as AD from "@radix-ui/react-alert-dialog";

interface Props {
  /** The element that opens the dialog (usually a button). */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
  onConfirm: () => void;
}

/** In-app replacement for window.confirm: focus is trapped, Esc cancels, Enter confirms the focused button. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
}: Props) {
  return (
    <AD.Root>
      <AD.Trigger asChild>{trigger}</AD.Trigger>
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]" />
        <AD.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)] outline-none data-[state=open]:animate-[dialog-in_180ms_cubic-bezier(0.16,1,0.3,1)]">
          <AD.Title className="text-lg font-semibold text-balance">{title}</AD.Title>
          <AD.Description className="mt-2 text-sm leading-relaxed text-muted text-pretty">{description}</AD.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AD.Cancel className="rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text">
              {cancelLabel}
            </AD.Cancel>
            <AD.Action
              onClick={onConfirm}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                destructive
                  ? "bg-danger/15 text-danger hover:bg-danger/25"
                  : "bg-accent text-on-accent hover:bg-accent-hover"
              }`}
            >
              {confirmLabel}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
