import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo />
      <div>
        <h1 className="text-2xl font-semibold">Não encontrado</h1>
        <p className="mt-2 max-w-sm text-muted text-pretty">
          Esse vídeo ou página não existe aqui. Vídeos que saíram do YouTube ou que não são dos seus canais não aparecem.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-accent px-5 py-2.5 font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
