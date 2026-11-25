import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

/** The sign-in card; /signup renders the same card in "criar" mode. */
export function AuthCard({ next, mode }: { next: string; mode: "entrar" | "criar" }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-border bg-surface p-8">
        <Logo size="lg" />
        <h1 className="sr-only">{mode === "criar" ? "Criar conta" : "Entrar"}</h1>
        <LoginForm next={next} mode={mode} />
      </div>
    </main>
  );
}
