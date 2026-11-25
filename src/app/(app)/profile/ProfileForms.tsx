"use client";

import { useActionState, useEffect, useRef } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { ImagePicker } from "@/components/ImagePicker";
import { changePasswordAction, renameUserAction, setProfileImageAction, type ProfileState } from "./actions";

const PHOTO_SIZE = { width: 256, height: 256 };
const inputClass =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-text outline-none focus:border-accent";
const saveButton =
  "self-start rounded-full bg-accent px-5 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60";

function Feedback({ state }: { state: ProfileState }) {
  if (!state.message) return null;
  return (
    <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-accent" : "text-danger"}`}>
      {state.message}
    </p>
  );
}

function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input id={id} name={id} required spellCheck={false} className={inputClass} {...input} />
    </div>
  );
}

export function PhotoPicker({ hasImage }: { hasImage: boolean }) {
  return <ImagePicker action={setProfileImageAction} hasImage={hasImage} size={PHOTO_SIZE} />;
}

export function UsernameForm({ username }: { username: string }) {
  const [state, action, pending] = useActionState(renameUserAction, { ok: true, message: "" });
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field id="username" label="Nome de usuário" defaultValue={username} autoComplete="username" maxLength={30} />
      <p className="-mt-1 text-xs text-muted">
        De 3 a 30 caracteres: letras, números, espaço, ponto, hífen ou sublinhado. É com ele que você entra.
      </p>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveButton}>
        {pending ? "Salvando…" : "Salvar nome"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, { ok: true, message: "" });
  const formRef = useRef<HTMLFormElement>(null);
  // Never leave passwords sitting in the fields after a successful change.
  useEffect(() => {
    if (state.ok && state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <Field id="current" label="Senha atual" type="password" autoComplete="current-password" />
      <Field id="password" label="Nova senha" type="password" autoComplete="new-password" minLength={8} />
      <Field id="confirm" label="Repita a nova senha" type="password" autoComplete="new-password" minLength={8} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={saveButton}>
        {pending ? "Alterando…" : "Alterar senha"}
      </button>
    </form>
  );
}

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex items-center gap-2 rounded-full bg-surface-2 px-5 py-2 text-sm font-medium text-text transition-colors hover:bg-border"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sair da conta
      </button>
    </form>
  );
}
