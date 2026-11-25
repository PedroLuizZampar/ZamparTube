"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, signupAction, type LoginState } from "./actions";

const inputClass =
  "rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-text outline-none focus:border-accent";

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  autoFocus,
  defaultValue,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete: string;
  autoFocus?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        spellCheck={false}
        required
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={inputClass}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Sign in ("entrar") or create an account ("criar"); both keep `next` so the user lands where they were going. */
export function LoginForm({ next, mode }: { next: string; mode: "entrar" | "criar" }) {
  const signup = mode === "criar";
  const [state, action, pending] = useActionState<LoginState, FormData>(signup ? signupAction : loginAction, {});
  const otherHref = `${signup ? "/login" : "/signup"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field
        id="username"
        label="Usuário"
        autoComplete="username"
        autoFocus
        defaultValue={state.username}
        hint={signup ? "De 3 a 30 caracteres: letras, números, espaço, ponto, hífen ou sublinhado." : undefined}
      />
      <Field
        id="password"
        label="Senha"
        type="password"
        autoComplete={signup ? "new-password" : "current-password"}
        hint={signup ? "Pelo menos 8 caracteres." : undefined}
      />
      {signup && (
        <>
          <Field id="confirm" label="Repita a senha" type="password" autoComplete="new-password" />
          <Field
            id="invite"
            label="Código de convite"
            type="password"
            autoComplete="off"
            hint="Peça o código para quem administra o ZamparTube."
          />
        </>
      )}
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-full bg-accent px-4 py-2.5 font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {signup ? (pending ? "Criando conta…" : "Criar conta") : pending ? "Entrando…" : "Entrar"}
      </button>
      <p className="text-center text-sm text-muted">
        {signup ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link href={otherHref} className="text-accent hover:underline">
          {signup ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </form>
  );
}
