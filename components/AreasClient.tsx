"use client";

import { useState } from "react";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CollapsibleList } from "@/components/CollapsibleList";

export interface AreaItem {
  id: string;
  nombre: string;
  asignacionesCount: number;
}

interface AreasClientProps {
  puntoId: string;
  puntoNombre: string;
  initialAreas: AreaItem[];
}

type Flash = { type: "success" | "error"; message: string } | null;

export function AreasClient({
  puntoId,
  puntoNombre,
  initialAreas,
}: AreasClientProps) {
  const [areas, setAreas] = useState(initialAreas);
  const [flash, setFlash] = useState<Flash>(null);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AreaItem | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/puntos/${puntoId}/areas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear área" });
      return;
    }

    setAreas((prev) =>
      [...prev, { id: data.id, nombre: data.nombre, asignacionesCount: 0 }].sort(
        (a, b) => a.nombre.localeCompare(b.nombre)
      )
    );
    setNombre("");
    setShowForm(false);
    setFlash({ type: "success", message: "Área creada correctamente" });
  }

  async function handleUpdate(areaId: string) {
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/puntos/${puntoId}/areas`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ areaId, nombre: editNombre }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al actualizar" });
      return;
    }

    setAreas((prev) =>
      prev
        .map((a) =>
          a.id === areaId
            ? {
                ...a,
                nombre: data.nombre,
                asignacionesCount: data.asignacionesCount,
              }
            : a
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
    setEditingId(null);
    setFlash({ type: "success", message: "Área actualizada" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/puntos/${puntoId}/areas`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ areaId: deleteTarget.id }),
    });

    const data = await res.json();
    setLoading(false);
    setDeleteTarget(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al eliminar" });
      return;
    }

    setAreas((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setFlash({
      type: "success",
      message: data.message ?? "Área eliminada",
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-slate-500">Punto</p>
        <p className="text-xl font-bold text-slate-900">{puntoNombre}</p>
      </div>

      {flash && (
        <FlashMessage
          type={flash.type}
          message={flash.message}
          onDismiss={() => setFlash(null)}
        />
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setNombre("");
          }}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white active:bg-blue-700"
        >
          + Agregar Área
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
        >
          <label className="block text-sm font-medium text-slate-700">
            Nombre del área
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              placeholder="Ej. Área Principal"
              autoFocus
              required
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}

      <CollapsibleList
        items={areas}
        getKey={(a) => a.id}
        forceExpanded={!!editingId}
        emptyMessage="Este punto no tiene áreas. Agrega la primera."
        renderItem={(area) =>
          editingId === area.id ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editNombre}
                onChange={(e) => setEditNombre(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate(area.id)}
                  disabled={loading}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-lg font-bold text-slate-900">{area.nombre}</p>
              {area.asignacionesCount > 0 && (
                <p className="mt-0.5 text-xs text-amber-600">
                  {area.asignacionesCount} asignación(es) en inventarios
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(area.id);
                    setEditNombre(area.nombre);
                  }}
                  className="flex-1 rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-200"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(area)}
                  className="flex-1 rounded-lg bg-red-50 py-2.5 text-sm font-medium text-red-600 active:bg-red-100"
                >
                  Eliminar
                </button>
              </div>
            </>
          )
        }
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar área"
        message={
          deleteTarget
            ? deleteTarget.asignacionesCount > 0
              ? `"${deleteTarget.nombre}" tiene asignaciones de inventario. Se desactivará pero no se borrará del historial.`
              : `¿Eliminar "${deleteTarget.nombre}"? Esta acción no se puede deshacer.`
            : ""
        }
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
