"use client";

interface ProductosPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

function getVisiblePages(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [1];

  if (current > 3) pages.push("ellipsis");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("ellipsis");

  pages.push(total);
  return pages;
}

export function ProductosPagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
}: ProductosPaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const visiblePages = getVisiblePages(page, totalPages);

  function goToPage(raw: string) {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) return;
    onPageChange(Math.min(totalPages, Math.max(1, n)));
  }

  return (
    <nav
      className="rounded-xl bg-white px-3 py-3 ring-1 ring-slate-200 sm:px-4"
      aria-label="Paginación de productos"
    >
      <p className="mb-3 text-center text-xs text-slate-500">
        Mostrando {from.toLocaleString("es-MX")}–{to.toLocaleString("es-MX")} de{" "}
        {total.toLocaleString("es-MX")}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <PageButton label="«" disabled={page <= 1} onClick={() => onPageChange(1)} title="Primera" />
        <PageButton
          label="←"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          title="Anterior"
        />

        {visiblePages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <PageButton
              key={p}
              label={String(p)}
              active={p === page}
              onClick={() => onPageChange(p)}
            />
          )
        )}

        <PageButton
          label="→"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          title="Siguiente"
        />
        <PageButton
          label="»"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          title="Última"
        />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-600">
        <label className="flex items-center gap-2">
          Ir a página
          <input
            type="number"
            min={1}
            max={totalPages}
            defaultValue={page}
            key={page}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                goToPage((e.target as HTMLInputElement).value);
              }
            }}
            onBlur={(e) => goToPage(e.target.value)}
            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm"
          />
        </label>
        <span className="text-slate-400">de {totalPages.toLocaleString("es-MX")}</span>
      </div>
    </nav>
  );
}

function PageButton({
  label,
  disabled,
  active,
  onClick,
  title,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-blue-600 text-white"
          : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
