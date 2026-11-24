// One look for every popup control (ui/Select, the channel filter, card and player menus), so they cannot drift apart.

export const menuTriggerClass =
  "inline-flex min-w-0 items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none transition-colors hover:border-muted/50 focus-visible:border-accent disabled:opacity-60 data-[state=open]:border-accent";

/** Popup surface without overflow/padding (Radix Select scrolls inside its own viewport). */
export const menuSurfaceClass =
  "z-50 rounded-xl border border-border bg-surface-2 text-sm text-text shadow-[0_12px_32px_rgba(0,0,0,0.45)] data-[state=open]:animate-[select-in_140ms_ease-out]";

export const menuContentClass = `${menuSurfaceClass} overflow-y-auto p-1`;

/** No left padding: callers add pl-8 (checkbox gutter) or pl-3 (icon items), since Tailwind would not let one override the other. */
export const menuItemClass =
  "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg py-2 pr-3 outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent/15 data-[highlighted]:text-text";
