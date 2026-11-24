"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** True only when the previous history entry is a page of this app (never another site or the login page). */
function canGoBackInApp(): boolean {
  const nav = (window as Window & { navigation?: { canGoBack?: boolean } }).navigation;
  if (nav && typeof nav.canGoBack === "boolean") {
    // The Navigation API only counts same-origin entries; the referrer rules out the login hop.
    return nav.canGoBack && !document.referrer.includes("/login");
  }
  try {
    const ref = new URL(document.referrer);
    return ref.origin === window.location.origin && !ref.pathname.startsWith("/login");
  } catch {
    return false;
  }
}

/** "Voltar": goes back in the app's history, or to `fallbackHref` when the page was opened directly. */
export function BackButton({ fallbackHref, label = "Voltar" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (canGoBackInApp() ? router.back() : router.push(fallbackHref))}
      className="-ml-2 mb-4 flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-text"
    >
      <ArrowLeft className="h-4 w-4" /> {label}
    </button>
  );
}
