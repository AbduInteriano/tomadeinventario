"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EstadoBadge } from "@/components/AppHeader";

interface AsignacionItem {
  id: string;
  estado: string;
  inventarioId: string;
  area: { id: string; nombre: string; punto: string };
  conteosCount: number;
}

interface AreaDisponible {
  id: string;
  nombre: string;
  punto: string;
  tieneTomaActiva: boolean;
}

interface TomadorDashboardClientProps {
  isSupervisor: boolean;
}

export function TomadorDashboardClient({ isSupervisor }: TomadorDashboardClientProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([]);
  const [areasDisponibles, setAreasDisponibles] = useState<AreaDisponible[]>([]);
  const [inventarioDefaultId, setInventarioDefaultId] = useState<string | null>(null);
  const [areaSeleccionada, setAreaSeleccionada] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetch("/api/tomador/asignaciones");
    if (res.ok) {
      const data = await res.json();
      setAsignaciones(data.asignaciones ?? []);
      setAreasDisponibles(data.areasDisponibles ?? []);
      setInventarioDefaultId(data.inventarioDefaultId ?? null);
    }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  async function pausarToma(id: string) {
    setActionId(id);
    setMessage(null);
    const res = await fetch(`/api/asignaciones/${id}/pausar`, { method: "POST" });
    const data = await res.json();
    setActionId(null);
    if (!res.ok) {
      setMessage(data.error ?? "Error al pausar");
      return;
    }
    await refresh(true);
  }

  async function finalizarToma(id: string) {
    if (!confirm("¿Finalizar esta toma? No podrás agregar más conteos.")) return;
    setActionId(id);
    setMessage(null);
    const res = await fetch(`/api/asignaciones/${id}/finalizar`, { method: "POST" });
    const data = await res.json();
    setActionId(null);
    if (!res.ok) {
      setMessage(data.error ?? "Error al finalizar");
      return;
    }
    await refresh(true);
  }

  async function iniciarAreaSupervisor() {
    if (!areaSeleccionada) return;
    setActionId("new-area");
    setMessage(null);
    const res = await fetch("/api/tomas/iniciar-area", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        areaId: areaSeleccionada,
        inventarioId: inventarioDefaultId ?? undefined,
      }),
    });
    const data = await res.json();
    setActionId(null);
    if (!res.ok) {
      setMessage(data.error ?? "Error al iniciar área");
      return;
    }
    router.push(`/tomador/area/${data.asignacionId}`);
  }

  const pendientes = asignaciones.filter((a) => a.estado === "PENDIENTE");
  const enProgreso = asignaciones.filter((a) => a.estado === "EN_PROGRESO");
  const pausadas = asignaciones.filter((a) => a.estado === "PAUSADA");

  function renderToma(a: AsignacionItem) {
    const busy = actionId === a.id;

    return (
      <li
        key={a.id}
        className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">{a.area.punto}</p>
            <p className="text-lg font-bold text-slate-900">{a.area.nombre}</p>
            <p className="mt-1 text-sm text-slate-600">
              {a.conteosCount} productos contados
            </p>
          </div>
          <EstadoBadge estado={a.estado} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {a.estado === "PENDIENTE" && (
            <button
              type="button"
              onClick={() => iniciarToma(a.id)}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Iniciando…" : "Iniciar toma"}
            </button>
          )}
          {a.estado === "EN_PROGRESO" && (
            <>
              <Link
                href={`/tomador/area/${a.id}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Continuar conteo
              </Link>
              <button
                type="button"
                onClick={() => pausarToma(a.id)}
                disabled={busy}
                className="rounded-lg border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-700 disabled:opacity-60"
              >
                Pausar
              </button>
              <button
                type="button"
                onClick={() => finalizarToma(a.id)}
                disabled={busy}
                className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-60"
              >
                Finalizar
              </button>
            </>
          )}
          {a.estado === "PAUSADA" && (
            <>
              <button
                type="button"
                onClick={() => iniciarToma(a.id)}
                disabled={busy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Reanudar
              </button>
              <Link
                href={`/tomador/area/${a.id}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Ver conteos
              </Link>
              <button
                type="button"
                onClick={() => finalizarToma(a.id)}
                disabled={busy}
                className="rounded-lg border border-green-600 px-4 py-2 text-sm font-semibold text-green-700 disabled:opacity-60"
              >
                Finalizar
              </button>
            </>
          )}
        </div>
      </li>
    );
  }

  if (loading) {
    return (
      <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        Cargando tomas…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>
      )}

      {isSupervisor && areasDisponibles.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Iniciar toma en cualquier área
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Como supervisor puedes iniciar el conteo en cualquier área disponible.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={areaSeleccionada}
              onChange={(e) => setAreaSeleccionada(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="">Seleccionar área…</option>
              {areasDisponibles
                .filter((a) => !a.tieneTomaActiva)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.punto} · {a.nombre}
                  </option>
                ))}
            </select>
            <button
              type="button"
              onClick={iniciarAreaSupervisor}
              disabled={!areaSeleccionada || actionId === "new-area"}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {actionId === "new-area" ? "Iniciando…" : "Iniciar toma"}
            </button>
          </div>
        </section>
      )}

      {asignaciones.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-lg font-medium text-slate-700">Sin tomas asignadas</p>
          <p className="mt-2 text-sm text-slate-500">
            {isSupervisor
              ? "Crea tomas desde Inventarios o inicia una en cualquier área arriba."
              : "El supervisor aún no te ha asignado tomas de inventario."}
          </p>
          {isSupervisor && (
            <Link
              href="/supervisor/inventarios"
              className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              Ir a Inventarios
            </Link>
          )}
        </div>
      ) : (
        <>
          {enProgreso.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-600">
                En progreso ({enProgreso.length})
              </h2>
              <ul className="space-y-3">{enProgreso.map(renderToma)}</ul>
            </section>
          )}
          {pausadas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Pausadas ({pausadas.length})
              </h2>
              <ul className="space-y-3">{pausadas.map(renderToma)}</ul>
            </section>
          )}
          {pendientes.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Pendientes ({pendientes.length})
              </h2>
              <ul className="space-y-3">{pendientes.map(renderToma)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
