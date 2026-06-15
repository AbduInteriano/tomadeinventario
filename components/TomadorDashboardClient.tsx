"use client";

import { useEffect, useState } from "react";
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

function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TomadorDashboardClient({ isSupervisor }: TomadorDashboardClientProps) {
  const router = useRouter();
  const [fecha, setFecha] = useState(hoyLocal());
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/tomador/asignaciones?fecha=${fecha}`);
      if (res.ok && !cancelled) {
        const data = await res.json();
        setAsignaciones(data.asignaciones ?? []);
        if (data.fecha) setFecha(data.fecha);
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fecha]);

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
    }
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
    await refreshList();
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
    await refreshList();
  }

  const pendientes = asignaciones.filter((a) => a.estado === "PENDIENTE");
  const enProgreso = asignaciones.filter((a) => a.estado === "EN_PROGRESO");
  const pausadas = asignaciones.filter((a) => a.estado === "PAUSADA");
  const finalizadas = asignaciones.filter((a) => a.estado === "COMPLETADA");

  function renderToma(a: AsignacionItem) {
    const busy = actionId === a.id;
    const allowManage = a.esPropia && a.estado !== "COMPLETADA";

    return (
      <li key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">{a.area.punto}</p>
            <p className="text-lg font-bold text-slate-900">{a.area.nombre}</p>
            {isSupervisor && !a.esPropia && (
              <p className="mt-0.5 text-xs font-medium text-blue-600">
                Asignada a {a.usuarioNombre}
              </p>
            )}
            <p className="mt-1 text-sm text-slate-600">
              {a.conteosCount} productos contados
            </p>
          </div>
          <EstadoBadge estado={a.estado} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {allowManage && a.estado === "PENDIENTE" && (
            <button
              type="button"
              onClick={() => iniciarToma(a.id)}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Iniciando…" : "Iniciar toma"}
            </button>
          )}
          {allowManage && a.estado === "EN_PROGRESO" && (
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
          {allowManage && a.estado === "PAUSADA" && (
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
          {(!allowManage || a.estado === "COMPLETADA") && (
            <Link
              href={`/tomador/area/${a.id}`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Ver conteos
            </Link>
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

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-600" htmlFor="fecha-filtro">
          Fecha:
        </label>
        <input
          id="fecha-filtro"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {isSupervisor && (
        <Link
          href="/supervisor/tomas"
          className="block rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-800"
        >
          + Crear nueva toma de inventario
        </Link>
      )}

      {asignaciones.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <p className="text-lg font-medium text-slate-700">
            {isSupervisor ? "Sin tomas en esta fecha" : "Sin tomas asignadas"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {isSupervisor
              ? "Crea tomas desde el enlace de arriba o cambia la fecha."
              : "El supervisor aún no te ha asignado tomas para esta fecha."}
          </p>
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
          {finalizadas.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-green-600">
                Finalizadas ({finalizadas.length})
              </h2>
              <ul className="space-y-3">{finalizadas.map(renderToma)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
