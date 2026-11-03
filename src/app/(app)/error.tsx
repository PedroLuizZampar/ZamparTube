"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const expired = error.message.includes("Sessão expirada");
  return (
    <section className="mx-auto mt-24 flex max-w-md flex-col items-center text-center">
      <h1 className="text-xl font-semibold">{expired ? "Sua sessão expirou" : "Algo deu errado"}</h1>
      <p className="mt-2 text-muted text-pretty">
        {expired
          ? "Entre de novo para continuar."
          : "Não foi possível concluir essa ação. Verifique a conexão e tente de novo."}
      </p>
      <div className="mt-6 flex gap-2">
        {expired ? (
          <Link href="/login" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
            Entrar
          </Link>
        ) : (
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Tentar de novo
          </button>
        )}
        <Link href="/" className="rounded-lg bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-border">
          Início
        </Link>
      </div>
    </section>
  );
}
