"use client";

import { useEffect, useState } from "react";

const DEFAULT_PREVIEW = 3;

interface CollapsibleListProps<T> {
  items: T[];
  previewCount?: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
  /** Si es true, muestra todos los ítems (ej. al editar uno fuera del preview). */
  forceExpanded?: boolean;
  emptyMessage?: React.ReactNode;
  className?: string;
  itemClassName?: string;
}

export function CollapsibleList<T>({
  items,
  previewCount = DEFAULT_PREVIEW,
  getKey,
  renderItem,
  forceExpanded = false,
  emptyMessage,
  className = "rounded-xl bg-white shadow-sm ring-1 ring-slate-200",
  itemClassName = "p-4",
}: CollapsibleListProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const showAll = forceExpanded || expanded;
  const hasMore = items.length > previewCount;
  const visible = showAll ? items : items.slice(0, previewCount);

  useEffect(() => {
    if (!forceExpanded) return;
    setExpanded(true);
  }, [forceExpanded]);

  if (items.length === 0) {
    if (!emptyMessage) return null;
    return (
      <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={className}>
      <ul className="divide-y divide-slate-100">
        {visible.map((item) => (
          <li key={getKey(item)} className={itemClassName}>
            {renderItem(item)}
          </li>
        ))}
      </ul>
      {hasMore && !forceExpanded && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-3 text-sm font-medium text-blue-600 active:bg-slate-50"
        >
          {expanded ? (
            <>Ver menos</>
          ) : (
            <>Ver todos ({items.length})</>
          )}
          <span className="text-slate-400">{expanded ? "▲" : "▼"}</span>
        </button>
      )}
    </div>
  );
}
