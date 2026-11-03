import Link from "next/link";

export function CategoryFilter({
  categories,
  activeId,
}: {
  categories: Array<{ id: number; name: string }>;
  activeId?: number;
}) {
  if (categories.length === 0) return null;
  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-text text-bg" : "bg-surface-2 text-text hover:bg-border"
    }`;
  return (
    <nav aria-label="Categorias" className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      <Link href="/" className={chip(activeId === undefined)} aria-current={activeId === undefined ? "page" : undefined}>
        Todos
      </Link>
      {categories.map((c) => (
        <Link
          key={c.id}
          href={`/?categoria=${c.id}`}
          className={chip(activeId === c.id)}
          aria-current={activeId === c.id ? "page" : undefined}
        >
          {c.name}
        </Link>
      ))}
    </nav>
  );
}
