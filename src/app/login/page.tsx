import type { Metadata } from "next";
import { AuthCard } from "./AuthCard";

export const metadata: Metadata = { title: "Entrar · ZamparTube" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return <AuthCard next={typeof next === "string" ? next : "/"} mode="entrar" />;
}
