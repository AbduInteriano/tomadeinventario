"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EstadoBadge } from "@/components/AppHeader";

interface AsignacionItem {
  id: string;
  estado: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  esPropia: boolean;
  area: { id: string; nombre: string; punto: string };
  conteosCount: number;
}

interface TomadorDashboardClientProps {
  isSupervisor: boolean;
}

const PRIORIDAD: Record<string, number> = {
  EN_PROGRESO: 0,
  PAUSADA: 1,
  PENDIENTE: 2,
  COMPLETADA: 3,
};

import { fechaHoyIso } from "@/lib/fecha";

export function TomadorDashboardClient({ isSupervisor }: TomadorDashboardClientProps) {
  const router = useRouter();
  const [fecha, setFecha] = useState(fechaHoyIso());
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [showFinalizadas, setShowFinalizadas] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/tomador/asignaciones?fecha=${fecha}`);
      if (res.ok && !cancelled) {
        const data = await res.json();
        setAsignaciones(data.asignaciones ?? []);
        if (data.fecha) setFecha(data.fecha);
        setSelectedIds(new Set());
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fecha]);

  const activas = useMemo(
    () =>
      asignaciones
        .filter((a) => a.estado !== "COMPLETADA")
        .sort((a, b) => (PRIORIDAD[a.estado] ?? 9) - (PRIORIDAD[b.estado] ?? 9)),
    [asignaciones]
  );

  const finalizadas = useMemo(
    () => asignaciones.filter((a) => a.estado === "COMPLETADA"),
    [asignaciones]
  );

  async function iniciarToma(id: string) {
    setActionId(id);
    setMessage(null);
    const res = await fetch(`/api/asignaciones/${id}/iniciar`, { method: "POST" });
    const data = await res.json();
    setActionId(null);
    if (!res.ok) {
      setMessage(data.error ?? "Error al iniciar");
      return;
    }
    router.push(`/tomador/area/${id}`);
  }

  async function refreshList() {
    const res = await fetch(`/api/tomador/asignaciones?fecha=${fecha}`);
    if (res.ok) {
      const data = await res.json();
      setAsignaciones(data.asignaciones ?? []);
      setSelectedIds(new Set());
    }
  }

  async function pausarToma(id: string) {
    setActionId(id);
    const res = await fetch(`/api/asignaciones/${id}/pausar`, { method: "POST" });
    setActionId(null);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Error al pausar");
      return;
    }
    await refreshList();
  }

  async function finalizarToma(id: string) {
    if (!confirm("¿Finalizar esta toma?")) return;
    setActionId(id);
    const res = await fetch(`/api/asignaciones/${id}/finalizar`, { method: "POST" });
    setActionId(null);
    if (!res.ok) {
      const data = await res.json();
      setMessage(data.error ?? "Error al finalizar");
      return;
    }
    router.refresh();
    await refreshList();
  }

  function verConteo(id: string) {
    router.refresh();
    router.push(`/tomador/area/${id}`);
  }

  async function descargarSeleccionados() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setExportando(true);
    try {
      const res = await fetch("/api/conteos/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("No se pudo generar el Excel");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `conteos-${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al descargar");
    } finally {
      setExportando(false);
    }
  }

  function renderAccionPrincipal(a: AsignacionItem, busy: boolean) {
    const allowManage = a.esPropia && a.estado !== "COMPLETADA";

    if (allowManage && a.estado === "PENDIENTE") {
      return (
        <button
          type="button"
          onClick={() => iniciarToma(a.id)}
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? "…" : "Iniciar"}
        </button>
      );
    }
    if (allowManage && (a.estado === "EN_PROGRESO" || a.estado === "PAUSADA")) {
      return (
        <button
          type="button"
          onClick={() => verConteo(a.id)}
          className="block w-full rounded-lg bg-blue-600 py-2.5 text-center text-sm font-semibold text-white"
        >
          {a.estado === "PAUSADA" ? "Reanudar conteo" : "Continuar conteo"}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => verConteo(a.id)}
        className="block w-full rounded-lg border border-slate-200 py-2.5 text-center text-sm font-medium text-slate-700"
      >
        Ver conteo
      </button>
    );
  }

  function renderTomaActiva(a: AsignacionItem) {
    const busy = actionId === a.id;
    const allowManage = a.esPropia && a.estado !== "COMPLETADA";

    return (
      <li key={a.id} className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{a.area.nombre}</p>
            <p className="truncate text-xs text-slate-500">{a.area.punto}</p>
          </div>
          <EstadoBadge estado={a.estado} />
        </div>

        {isSupervisor && !a.esPropia && (
          <p className="mt-1 text-xs text-blue-600">Asignada a {a.usuarioNombre}</p>
        )}

        <div className="mt-3">{renderAccionPrincipal(a, busy)}</div>

        {allowManage && (a.estado === "EN_PROGRESO" || a.estado === "PAUSADA") && (
          <div className="mt-2 flex justify-center gap-4 text-xs">
            {a.estado === "EN_PROGRESO" && (
              <button
                type="button"
                onClick={() => pausarToma(a.id)}
                disabled={busy}
                className="text-amber-700 disabled:opacity-50"
              >
                Pausar
              </button>
            )}
            {a.estado === "PAUSADA" && (
              <button
                type="button"
                onClick={() => iniciarToma(a.id)}
                disabled={busy}
                className="text-blue-600 disabled:opacity-50"
              >
                Reanudar
              </button>
            )}
            <button
              type="button"
              onClick={() => finalizarToma(a.id)}
              disabled={busy}
              className="text-green-700 disabled:opacity-50"
            >
              Finalizar
            </button>
          </div>
        )}
      </li>
    );
  }

  function renderTomaFinalizada(a: AsignacionItem) {
    const selected = selectedIds.has(a.id);

    return (
      <li key={a.id} className="flex items-center gap-3 rounded-lg px-1 py-2">
        {isSupervisor && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (next.has(a.id)) next.delete(a.id);
                else next.add(a.id);
                return next;
              });
            }}
            className="h-4 w-4 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">{a.area.nombre}</p>
          <p className="truncate text-xs text-slate-500">
            {a.area.punto}
            {isSupervisor && !a.esPropia ? ` · ${a.usuarioNombre}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => verConteo(a.id)}
          className="shrink-0 text-sm text-blue-600"
        >
          Ver
        </button>
      </li>
    );
  }

  if (loading) {
    return <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>;
  }

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
      )}

      <input
        id="fecha-filtro"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />

      {isSupervisor && (
        <Link
          href="/supervisor/tomas"
          className="block text-center text-sm font-medium text-blue-600"
        >
          + Crear toma
        </Link>
      )}

      {asignaciones.length === 0 ? (
        <p className="rounded-xl bg-white px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {isSupervisor ? "Sin tomas en esta fecha" : "No tienes tomas asignadas"}
        </p>
      ) : (
        <>
          {activas.length > 0 && (
            <ul className="space-y-2">{activas.map(renderTomaActiva)}</ul>
          )}

          {finalizadas.length > 0 && (
            <section className="rounded-xl bg-white ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setShowFinalizadas((v) => !v)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
              >
                Finalizadas ({finalizadas.length})
                <span className="text-slate-400">{showFinalizadas ? "▲" : "▼"}</span>
              </button>
              {showFinalizadas && (
                <ul className="border-t border-slate-100 px-3 pb-2">
                  {finalizadas.map(renderTomaFinalizada)}
                </ul>
              )}
              {isSupervisor && selectedIds.size > 0 && (
                <div className="border-t border-slate-100 p-3">
                  <button
                    type="button"
                    onClick={descargarSeleccionados}
                    disabled={exportando}
                    className="w-full rounded-lg border border-green-600 py-2 text-sm font-medium text-green-700 disabled:opacity-60"
                  >
                    {exportando ? "Generando…" : `Descargar Excel (${selectedIds.size})`}
                  </button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
