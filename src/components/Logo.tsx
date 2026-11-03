export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#9FB4D3" />
      <path d="M12.5 10.2v11.6c0 .8.9 1.3 1.6.9l9.2-5.8a1 1 0 0 0 0-1.8l-9.2-5.8c-.7-.4-1.6.1-1.6.9Z" fill="#1B1C20" />
    </svg>
  );
}

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const lg = size === "lg";
  return (
    <span className={`flex items-center gap-2 font-semibold tracking-tight ${lg ? "text-2xl" : "text-lg"}`}>
      <LogoMark className={lg ? "h-9 w-9" : "h-7 w-7"} />
      <span>
        Zampar<span className="text-accent">Tube</span>
      </span>
    </span>
  );
}
