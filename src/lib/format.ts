/** 3723 → "1:02:03", 61 → "1:01". */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "always" });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

/** "há 2 dias", "há 3 semanas"… */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diff = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  for (const [unit, size] of STEPS) {
    if (diff >= size) return rtf.format(-Math.floor(diff / size), unit);
  }
  return "agora";
}
