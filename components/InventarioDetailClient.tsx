"use client";

import { useCallback, useState } from "react";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EstadoBadge } from "@/components/AppHeader";

interface Tomador {
  id: string;
  nombre: string;
  email: string;
}

interface AreaAsignacion {
  asignacionId: string;
  areaId: string;
  areaNombre: string;
  estado: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  conteosCount: number;
  ultimaActividad: string | null;
  editable: boolean;
}

interface PuntoGrupo {
  id: string;
  nombre: string;
  areas: AreaAsignacion[];
}

interface Stats {
  total: number;
  completadas: number;
  enProgreso: number;
  pendientes: number;
  sinAsignar: number;
}

export interface InventarioDetalleData {
  inventario: {
    id: string;
    estado: string;
    createdAt: string;
  };
  stats: Stats;
  puntos: PuntoGrupo[];
  tomadores: Tomador[];
}

interface InventarioDetailClientProps {
  inventarioId: string;
  initialData: InventarioDetalleData;
}

type Flash = { type: "success" | "error"; message: string } | null;

function formatRelative(iso: string | null): string {
  if (!iso) return "Sin actividad";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return "ahora";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}

function puntoProgreso(areas: AreaAsignacion[]) {
  const completadas = areas.filter((a) => a.estado === "COMPLETADA").length;
  const total = areas.length;
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
  return { completadas, total, pct };
}

function puntoBadgeClass(completadas: number, total: number): string {
  if (total === 0) return "bg-slate-100 text-slate-600";
  if (completadas === total) return "bg-green-100 text-green-800";
  if (completadas > 0) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-600";
}

export function InventarioDetailClient({
  inventarioId,
  initialData,
}: InventarioDetailClientProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [openPuntos, setOpenPuntos] = useState<Set<string>>(() => {
    const first = initialData.puntos[0]?.id;
    return new Set(first ? [first] : []);
  });

  const cerrado = data.inventario.estado === "CERRADO";
  const globalPct =
    data.stats.total > 0
      ? Math.round((data.stats.completadas / data.stats.total) * 100)
      : 0;

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventarios/${inventarioId}`);
    if (res.ok) {
      const next = await res.json();
      setData(next);
    }
    setLoading(false);
  }, [inventarioId]);

  function togglePunto(puntoId: string) {
    setOpenPuntos((prev) => {
      const next = new Set(prev);
      if (next.has(puntoId)) next.delete(puntoId);
      else next.add(puntoId);
      return next;
    });
  }

  async function assignTomador(asignacionId: string, usuarioId: string) {
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/inventarios/${inventarioId}/asignaciones`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asignacionId, usuarioId: usuarioId || null }),
    });

    const result = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: result.error ?? "Error al asignar" });
      return;
    }

    if (result.warnings?.length) {
      setFlash({ type: "success", message: result.warnings.join(" ") });
    }

    if (result.puntos) {
      setData((prev) => ({
        ...prev,
        stats: result.stats,
        puntos: result.puntos,
      }));
    } else {
      await refresh();
    }
  }

  async function handleClose() {
    const forzar = data.stats.completadas < data.stats.total;
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/inventarios/${inventarioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "CERRADO", forzar }),
    });

    const result = await res.json();
    setLoading(false);
    setShowCloseConfirm(false);

    if (!res.ok) {
      setFlash({ type: "error", message: result.error ?? "Error al cerrar" });
      return;
    }

    setData((prev) => ({
      ...prev,
      inventario: { ...prev.inventario, estado: "CERRADO" },
    }));
    setFlash({ type: "success", message: result.message ?? "Inventario cerrado" });
  }

  return (
    <div className="space-y-3">
      {/* Barra fija: estado + acciones */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-slate-200 bg-slate-100/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <EstadoBadge estado={data.inventario.estado} />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 active:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "…" : "Actualizar"}
            </button>
            {!cerrado && (
              <button
                type="button"
                onClick={() => setShowCloseConfirm(true)}
                disabled={loading}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-50"
              >
                Cerrar Inventario
              </button>
            )}
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              {data.stats.completadas}/{data.stats.total} áreas completadas
            </span>
            <span>{globalPct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${globalPct}%` }}
            />
          </div>
        </div>
      </div>

      {flash && (
        <FlashMessage
          type={flash.type}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}

      {data.puntos.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No hay áreas activas en el sistema.
        </p>
      ) : (
        <div className="space-y-2">
          {data.puntos.map((punto) => {
            const { completadas, total, pct } = puntoProgreso(punto.areas);
            const isOpen = openPuntos.has(punto.id);

            return (
              <div
                key={punto.id}
                className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200"
              >
                <button
                  type="button"
                  onClick={() => togglePunto(punto.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                >
                  <span
                    className={`text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    aria-hidden
                  >
                    ▶
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{punto.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {completadas}/{total} completadas
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${puntoBadgeClass(completadas, total)}`}
                  >
                    {pct}%
                  </span>
                </button>

                {isOpen && (
                  <ul className="border-t border-slate-100">
                    {punto.areas.map((area) => (
                      <li
                        key={area.asignacionId}
                        className="border-b border-slate-50 px-4 py-3 last:border-b-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium text-slate-900">
                            {area.areaNombre}
                          </p>
                          <EstadoBadge estado={area.estado} />
                        </div>

                        <div className="mt-2">
                          {area.editable && !cerrado ? (
                            <select
                              value={area.usuarioId ?? ""}
                              onChange={(e) =>
                                assignTomador(area.asignacionId, e.target.value)
                              }
                              disabled={loading}
                              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                              aria-label={`Tomador para ${area.areaNombre}`}
                            >
                              <option value="">Sin asignar</option>
                              {data.tomadores.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.nombre}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-sm text-slate-700">
                              {area.usuarioNombre ?? (
                                <span className="text-slate-400">Sin asignar</span>
                              )}
                            </p>
                          )}
                        </div>

                        <p className="mt-1.5 text-[11px] text-slate-400">
                          {formatRelative(area.ultimaActividad)}
                          {area.conteosCount > 0 && ` · ${area.conteosCount} conteos`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={showCloseConfirm}
        title="Cerrar inventario"
        message={
          data.stats.completadas === data.stats.total
            ? "¿Cerrar este inventario? No se podrán registrar más conteos."
            : `Quedan ${data.stats.total - data.stats.completadas} área(s) sin completar. ¿Cerrar de todas formas? Los conteos quedarán bloqueados.`
        }
        confirmLabel="Cerrar inventario"
        loading={loading}
        onConfirm={handleClose}
        onCancel={() => setShowCloseConfirm(false)}
      />
    </div>
  );
}
