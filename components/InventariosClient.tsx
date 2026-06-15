"use client";

import { useState } from "react";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { EstadoBadge } from "@/components/AppHeader";

export interface InventarioListItem {
  id: string;
  estado: string;
  createdAt: string;
  tomasTotal: number;
  tomasFinalizadas: number;
}

interface InventariosClientProps {
  initialInventarios: InventarioListItem[];
}

type Flash = { type: "success" | "error"; message: string } | null;

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ProgressBar({
  completadas,
  total,
}: {
  completadas: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">
          {completadas}/{total} tomas finalizadas
        </span>
        <span className="text-slate-400">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function InventariosClient({ initialInventarios }: InventariosClientProps) {
  const [inventarios, setInventarios] = useState(initialInventarios);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  async function handleCreate() {
    setLoading(true);
    setFlash(null);

    const res = await fetch("/api/inventarios", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear" });
      return;
    }

    setInventarios((prev) => [
      {
        id: data.id,
        estado: data.estado,
        createdAt: data.createdAt,
        tomasTotal: data.tomasTotal ?? 0,
        tomasFinalizadas: 0,
      },
      ...prev,
    ]);
    setFlash({
      type: "success",
      message: "Ciclo de inventario creado. Asigna tomas por área y usuario.",
    });
  }

  return (
    <div className="space-y-4">
      {flash && (
        <FlashMessage
          type={flash.type}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}

      <button
        type="button"
        onClick={handleCreate}
        disabled={loading}
        className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm active:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Creando…" : "+ Crear ciclo de inventario"}
      </button>

      {inventarios.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          No hay ciclos de inventario registrados.
        </p>
      ) : (
        <ul className="space-y-3">
          {inventarios.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/supervisor/inventarios/${inv.id}`}
                className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-slate-500">{formatFecha(inv.createdAt)}</p>
                  <EstadoBadge estado={inv.estado} />
                </div>
                <ProgressBar
                  completadas={inv.tomasFinalizadas}
                  total={inv.tomasTotal}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
