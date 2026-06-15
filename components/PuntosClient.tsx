"use client";

import { useState } from "react";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface PuntoItem {
  id: string;
  nombre: string;
  areasCount: number;
}

interface PuntosClientProps {
  initialPuntos: PuntoItem[];
}

type Flash = { type: "success" | "error"; message: string } | null;

export function PuntosClient({ initialPuntos }: PuntosClientProps) {
  const [puntos, setPuntos] = useState(initialPuntos);
  const [flash, setFlash] = useState<Flash>(null);
  const [showForm, setShowForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PuntoItem | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFlash(null);

    const res = await fetch("/api/puntos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear punto" });
      return;
    }

    setPuntos((prev) =>
      [...prev, { id: data.id, nombre: data.nombre, areasCount: 0 }].sort(
        (a, b) => a.nombre.localeCompare(b.nombre)
      )
    );
    setNombre("");
    setShowForm(false);
    setFlash({ type: "success", message: "Punto creado correctamente" });
  }

  async function handleUpdate(id: string) {
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/puntos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editNombre }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al actualizar" });
      return;
    }

    setPuntos((prev) =>
      prev
        .map((p) =>
          p.id === id
            ? { ...p, nombre: data.nombre, areasCount: data.areasCount }
            : p
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    );
    setEditingId(null);
    setFlash({ type: "success", message: "Punto actualizado" });
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    setFlash(null);

    const res = await fetch(`/api/puntos/${deleteTarget.id}`, {
      method: "DELETE",
    });

    const data = await res.json();
    setLoading(false);
    setDeleteTarget(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al eliminar" });
      return;
    }

    setPuntos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setFlash({
      type: "success",
      message: data.message ?? "Punto eliminado",
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

      {!showForm ? (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setNombre("");
          }}
          className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white active:bg-blue-700"
        >
          + Agregar Punto
        </button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
        >
          <label className="block text-sm font-medium text-slate-700">
            Nombre del punto
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              placeholder="Ej. Almacén Central"
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

      {puntos.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          No hay puntos registrados. Agrega el primero.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {puntos.map((punto) => (
            <li key={punto.id} className="p-4">
              {editingId === punto.id ? (
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
                      onClick={() => handleUpdate(punto.id)}
                      disabled={loading}
                      className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link
                    href={`/supervisor/puntos/${punto.id}`}
                    className="block active:opacity-80"
                  >
                    <p className="text-lg font-bold text-slate-900">{punto.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {punto.areasCount}{" "}
                      {punto.areasCount === 1 ? "área" : "áreas"}
                    </p>
                  </Link>
                  <div className="mt-3 flex gap-2">
                    <Link
                      href={`/supervisor/puntos/${punto.id}`}
                      className="flex-1 rounded-lg bg-slate-100 py-2.5 text-center text-sm font-medium text-slate-700 active:bg-slate-200"
                    >
                      Ver áreas
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(punto.id);
                        setEditNombre(punto.nombre);
                      }}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-blue-600 active:bg-blue-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(punto)}
                      className="rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 active:bg-red-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar punto"
        message={
          deleteTarget
            ? `¿Eliminar "${deleteTarget.nombre}"? Si tiene historial de inventarios se desactivará en lugar de borrarse.`
            : ""
        }
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
