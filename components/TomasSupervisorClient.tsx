"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { EstadoBadge } from "@/components/AppHeader";

interface TomaItem {
  id: string;
  estado: string;
  fecha: string;
  usuarioId: string;
  usuarioNombre: string;
  esPropia: boolean;
  area: { id: string; nombre: string; punto: string; puntoId: string };
  conteosCount: number;
}

interface PuntoGrupo {
  id: string;
  nombre: string;
  areas: { id: string; nombre: string; disponible: boolean }[];
}

interface UsuarioItem {
  id: string;
  nombre: string;
  role: string;
}

export function TomasSupervisorClient() {
  const [fecha, setFecha] = useState("");
  const [fechas, setFechas] = useState<string[]>([]);
  const [tomas, setTomas] = useState<TomaItem[]>([]);
  const [puntos, setPuntos] = useState<PuntoGrupo[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([]);
  const [usuarioId, setUsuarioId] = useState("");
  const [areaIds, setAreaIds] = useState<Set<string>>(new Set());
  const [openPuntos, setOpenPuntos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const refresh = useCallback(async (fechaQuery?: string) => {
    setLoading(true);
    const q = fechaQuery ?? fecha;
    const res = await fetch(`/api/tomas${q ? `?fecha=${q}` : ""}`);
    if (res.ok) {
      const data = await res.json();
      setFecha(data.fecha);
      setFechas(data.fechas ?? []);
      setTomas(data.tomas ?? []);
      setPuntos(data.puntos ?? []);
      setUsuarios(data.usuarios ?? []);
    }
    setLoading(false);
  }, [fecha]);

  useEffect(() => {
    refresh("");
  }, [refresh]);

  function toggleArea(id: string) {
    setAreaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePunto(puntoId: string) {
    setOpenPuntos((prev) => {
      const next = new Set(prev);
      if (next.has(puntoId)) next.delete(puntoId);
      else next.add(puntoId);
      return next;
    });
  }

  async function crearTomas() {
    if (!usuarioId || areaIds.size === 0) {
      setFlash({ type: "error", message: "Selecciona usuario y al menos un área" });
      return;
    }

    setSaving(true);
    setFlash(null);

    const res = await fetch("/api/tomas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usuarioId,
        areaIds: Array.from(areaIds),
        fecha,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear tomas" });
      return;
    }

    setAreaIds(new Set());
    setTomas(data.tomas ?? []);
    if (data.fecha && !fechas.includes(data.fecha)) {
      setFechas((prev) => [data.fecha, ...prev]);
    }
    const msg =
      data.warnings?.length > 0
        ? `${data.creadas} toma(s) creada(s). ${data.warnings.join(" ")}`
        : `${data.creadas} toma(s) creada(s) y asignada(s)`;
    setFlash({ type: "success", message: msg });
  }

  const activas = tomas.filter((t) => t.estado !== "COMPLETADA");
  const finalizadas = tomas.filter((t) => t.estado === "COMPLETADA");

  return (
    <div className="space-y-4">
      {flash && (
        <FlashMessage type={flash.type} message={flash.message} onDismiss={() => setFlash(null)} />
      )}

      <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-bold text-slate-900">Nueva toma de inventario</h2>
        <p className="mt-1 text-sm text-slate-500">
          Elige tomador y una o más áreas (del mismo punto o de varios). Se registra con la fecha seleccionada.
        </p>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              refresh(e.target.value);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
          />
        </label>

        <label className="mt-3 block text-sm font-medium text-slate-700">
          Tomador
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5"
          >
            <option value="">Seleccionar…</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
                {u.role === "SUPERVISOR" ? " (Supervisor)" : ""}
              </option>
            ))}
          </select>
        </label>

        <p className="mt-3 text-sm font-medium text-slate-700">Áreas ({areaIds.size} seleccionadas)</p>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200">
          {puntos.map((punto) => {
            const isOpen = openPuntos.has(punto.id);
            const seleccionables = punto.areas.filter((a) => a.disponible);
            return (
              <div key={punto.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => togglePunto(punto.id)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 active:bg-slate-50"
                >
                  <span className={isOpen ? "rotate-90" : ""}>▶</span>
                  {punto.nombre}
                  <span className="text-xs font-normal text-slate-400">
                    ({seleccionables.length} disponibles)
                  </span>
                </button>
                {isOpen && (
                  <ul className="pb-2 pl-6 pr-3">
                    {punto.areas.map((a) => (
                      <li key={a.id} className="py-1">
                        <label
                          className={`flex items-center gap-2 text-sm ${
                            a.disponible ? "text-slate-700" : "text-slate-400"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={!a.disponible}
                            checked={areaIds.has(a.id)}
                            onChange={() => toggleArea(a.id)}
                          />
                          {a.nombre}
                          {!a.disponible && (
                            <span className="text-xs">(toma activa)</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={crearTomas}
          disabled={saving || !usuarioId || areaIds.size === 0}
          className="mt-4 w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Creando…" : "Crear toma(s) y asignar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">Filtrar por fecha:</span>
        <select
          value={fecha}
          onChange={(e) => refresh(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {fechas.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-center text-sm text-slate-500">Cargando…</p>
      ) : tomas.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No hay tomas para esta fecha.
        </p>
      ) : (
        <>
          {activas.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase text-amber-700">
                Activas ({activas.length})
              </h3>
              <ul className="space-y-2">
                {activas.map((t) => (
                  <li key={t.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-500">{t.area.punto}</p>
                        <p className="font-bold text-slate-900">{t.area.nombre}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {t.usuarioNombre} · {t.conteosCount} conteos
                        </p>
                      </div>
                      <EstadoBadge estado={t.estado} />
                    </div>
                    <Link
                      href={`/tomador/area/${t.id}`}
                      className="mt-3 inline-block text-sm font-medium text-blue-600"
                    >
                      Ver conteos →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {finalizadas.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold uppercase text-green-700">
                Finalizadas ({finalizadas.length})
              </h3>
              <ul className="space-y-2">
                {finalizadas.map((t) => (
                  <li key={t.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm text-slate-500">{t.area.punto}</p>
                        <p className="font-bold text-slate-900">{t.area.nombre}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {t.usuarioNombre} · {t.conteosCount} conteos
                        </p>
                      </div>
                      <EstadoBadge estado={t.estado} />
                    </div>
                    <Link
                      href={`/tomador/area/${t.id}`}
                      className="mt-3 inline-block text-sm font-medium text-blue-600"
                    >
                      Ver conteos →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
