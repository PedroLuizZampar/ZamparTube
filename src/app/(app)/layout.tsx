import Link from "next/link";
import { Logo } from "@/components/Logo";
import { BottomNav, SideNav } from "@/components/Nav";
import { SyncButton } from "@/components/SyncButton";

// Every page reads the database; nothing here can be prerendered at build time.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-bg px-3 py-5 md:flex">
        <Link href="/" className="mb-8 px-3">
          <Logo />
        </Link>
        <SideNav />
        <div className="mt-auto">
          <SyncButton />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/">
          <Logo />
        </Link>
        <SyncButton compact />
      </header>

      <main className="px-4 pb-28 pt-6 md:pb-12 md:pl-[calc(15rem+2rem)] md:pr-8 md:pt-8">{children}</main>
      <BottomNav />
    </div>
  );
}
