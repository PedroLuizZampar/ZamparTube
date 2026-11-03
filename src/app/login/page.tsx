import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · ZamparTube" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-border bg-surface p-8">
        <Logo size="lg" />
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
    </main>
  );
}
