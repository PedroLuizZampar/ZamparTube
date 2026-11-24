import { redirect } from "next/navigation";

/** Search moved to the home page; old links and installed shortcuts keep working. */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  redirect(q ? `/?q=${encodeURIComponent(q)}` : "/");
}
