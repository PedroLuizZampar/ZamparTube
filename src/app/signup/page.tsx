import type { Metadata } from "next";
import { AuthCard } from "../login/AuthCard";

export const metadata: Metadata = { title: "Criar conta · ZamparTube" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  return <AuthCard next={typeof next === "string" ? next : "/"} mode="criar" />;
}
