"use client";

import { useState } from "react";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { EstadoBadge } from "@/components/AppHeader";

export interface InventarioListItem {
  id: string;
  estado: string;
  createdAt: string;
  areasAsignadas: number;
  areasCompletadas: number;
}

interface InventariosClientProps {
  initialInventarios: InventarioListItem[];
  inventarioActivoId: string | null;
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
          {completadas}/{total} áreas completadas
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

export function InventariosClient({
  initialInventarios,
  inventarioActivoId,
}: InventariosClientProps) {
  const [inventarios, setInventarios] = useState(initialInventarios);
  const [activoId, setActivoId] = useState(inventarioActivoId);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  async function handleCreate() {
    if (activoId) return;

    setLoading(true);
    setFlash(null);

    const res = await fetch("/api/inventarios", { method: "POST" });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear" });
      if (data.inventarioActivoId) setActivoId(data.inventarioActivoId);
      return;
    }

    setInventarios((prev) => [
      {
        id: data.id,
        estado: data.estado,
        createdAt: data.createdAt,
        areasAsignadas: data.areasAsignadas,
        areasCompletadas: 0,
      },
      ...prev,
    ]);
    setActivoId(data.id);
    setFlash({ type: "success", message: "Inventario creado con todas las áreas activas" });
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

      {activoId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Ya hay un inventario activo
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Ciérralo antes de iniciar uno nuevo.
          </p>
          <Link
            href={`/supervisor/inventarios/${activoId}`}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white active:bg-amber-700"
          >
            Ir al inventario activo
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-4 text-base font-semibold text-white shadow-sm active:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creando…" : "+ Crear Nuevo Inventario"}
        </button>
      )}

      {inventarios.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          No hay inventarios registrados.
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
                  completadas={inv.areasCompletadas}
                  total={inv.areasAsignadas}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
