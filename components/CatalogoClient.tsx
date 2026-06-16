"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CollapsibleList } from "@/components/CollapsibleList";

interface CategoriaItem {
  id: string;
  nombre: string;
  activo: boolean;
  productosCount: number;
}

interface UnidadItem {
  id: string;
  nombre: string;
  abreviatura: string;
  activo: boolean;
  productosCount: number;
}

type Flash = { type: "success" | "error"; message: string } | null;
type DeleteTarget =
  | { type: "categoria"; item: CategoriaItem }
  | { type: "unidad"; item: UnidadItem }
  | null;

export function CatalogoClient() {
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [unidades, setUnidades] = useState<UnidadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [nuevaUnidad, setNuevaUnidad] = useState({ nombre: "", abreviatura: "" });

  const [editCategoriaId, setEditCategoriaId] = useState<string | null>(null);
  const [editCategoriaNombre, setEditCategoriaNombre] = useState("");
  const [editUnidadId, setEditUnidadId] = useState<string | null>(null);
  const [editUnidadForm, setEditUnidadForm] = useState({ nombre: "", abreviatura: "" });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [catsRes, unidadesRes] = await Promise.all([
      fetch("/api/categorias?detalle=1"),
      fetch("/api/unidades-medida?detalle=1"),
    ]);
    if (catsRes.ok) setCategorias(await catsRes.json());
    if (unidadesRes.ok) setUnidades(await unidadesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function crearCategoria(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;

    setSaving(true);
    setFlash(null);
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: nuevaCategoria.trim() }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear categoría" });
      return;
    }

    setCategorias((prev) =>
      [...prev.filter((c) => c.id !== data.id), data].sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      })
    );
    setNuevaCategoria("");
    setFlash({ type: "success", message: "Categoría creada" });
  }

  async function crearUnidad(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevaUnidad.nombre.trim() || !nuevaUnidad.abreviatura.trim()) return;

    setSaving(true);
    setFlash(null);
    const res = await fetch("/api/unidades-medida", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevaUnidad),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al crear unidad" });
      return;
    }

    setUnidades((prev) =>
      [...prev.filter((u) => u.id !== data.id), data].sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      })
    );
    setNuevaUnidad({ nombre: "", abreviatura: "" });
    setFlash({ type: "success", message: "Unidad creada" });
  }

  async function guardarCategoria(id: string) {
    setSaving(true);
    setFlash(null);
    const res = await fetch(`/api/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editCategoriaNombre }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al actualizar" });
      return;
    }

    setCategorias((prev) =>
      prev.map((c) => (c.id === id ? data : c)).sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      })
    );
    setEditCategoriaId(null);
    setFlash({ type: "success", message: "Categoría actualizada" });
  }

  async function guardarUnidad(id: string) {
    setSaving(true);
    setFlash(null);
    const res = await fetch(`/api/unidades-medida/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editUnidadForm),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al actualizar" });
      return;
    }

    setUnidades((prev) =>
      prev.map((u) => (u.id === id ? data : u)).sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;
        return a.nombre.localeCompare(b.nombre);
      })
    );
    setEditUnidadId(null);
    setFlash({ type: "success", message: "Unidad actualizada" });
  }

  async function reactivarCategoria(id: string) {
    setSaving(true);
    const res = await fetch(`/api/categorias/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al reactivar" });
      return;
    }
    setCategorias((prev) => prev.map((c) => (c.id === id ? data : c)));
    setFlash({ type: "success", message: "Categoría reactivada" });
  }

  async function reactivarUnidad(id: string) {
    setSaving(true);
    const res = await fetch(`/api/unidades-medida/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al reactivar" });
      return;
    }
    setUnidades((prev) => prev.map((u) => (u.id === id ? data : u)));
    setFlash({ type: "success", message: "Unidad reactivada" });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.type === "categoria" && deleteTarget.item.productosCount > 0) {
      setFlash({
        type: "error",
        message: "No se puede eliminar una categoría con productos asociados.",
      });
      setDeleteTarget(null);
      return;
    }

    setSaving(true);
    setFlash(null);

    const url =
      deleteTarget.type === "categoria"
        ? `/api/categorias/${deleteTarget.item.id}`
        : `/api/unidades-medida/${deleteTarget.item.id}`;

    const res = await fetch(url, { method: "DELETE" });
    const data = await res.json();
    setSaving(false);
    setDeleteTarget(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "No se pudo eliminar" });
      return;
    }

    if (deleteTarget.type === "categoria") {
      setCategorias((prev) => prev.filter((c) => c.id !== deleteTarget.item.id));
    } else {
      setUnidades((prev) => prev.filter((u) => u.id !== deleteTarget.item.id));
    }

    setFlash({
      type: "success",
      message: data.message ?? "Eliminado correctamente",
    });
  }

  if (loading) {
    return (
      <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
        Cargando catálogo…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {flash && (
        <FlashMessage type={flash.type} message={flash.message} onDismiss={() => setFlash(null)} />
      )}

      <p className="text-sm text-slate-600">
        Administra categorías y unidades de medida. Los productos y la importación Excel usan estos
        valores.{" "}
        <Link href="/supervisor/productos" className="font-medium text-blue-600">
          Ir a productos →
        </Link>
      </p>

      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-bold text-slate-900">Categorías</h2>
        <p className="mt-1 text-xs text-slate-500">
          Solo se pueden eliminar categorías sin productos. Para vaciar una categoría, cambia la
          categoría de sus productos en{" "}
          <Link href="/supervisor/productos" className="font-medium text-blue-600">
            Productos
          </Link>
          .
        </p>

        <form onSubmit={crearCategoria} className="mt-3 flex gap-2">
          <input
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            placeholder="Nueva categoría"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base"
          />
          <button
            type="submit"
            disabled={saving || !nuevaCategoria.trim()}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Crear
          </button>
        </form>

        {categorias.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No hay categorías registradas.</p>
        ) : (
          <CollapsibleList
            items={categorias}
            getKey={(c) => c.id}
            forceExpanded={!!editCategoriaId}
            className="mt-4 shadow-none ring-0"
            itemClassName="py-3"
            renderItem={(c) =>
              editCategoriaId === c.id ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    value={editCategoriaNombre}
                    onChange={(e) => setEditCategoriaNombre(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => guardarCategoria(c.id)}
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCategoriaId(null)}
                    className="rounded-lg border px-3 py-2 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={`font-medium ${c.activo ? "text-slate-900" : "text-slate-400"}`}
                    >
                      {c.nombre}
                      {!c.activo && (
                        <span className="ml-2 text-xs font-normal uppercase">Inactiva</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {c.productosCount} {c.productosCount === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {c.activo ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditCategoriaId(c.id);
                            setEditCategoriaNombre(c.nombre);
                          }}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: "categoria", item: c })}
                          disabled={c.productosCount > 0}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Eliminar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => reactivarCategoria(c.id)}
                        disabled={saving}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>
              )
            }
          />
        )}
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
        <h2 className="font-bold text-slate-900">Unidades de medida</h2>
        <p className="mt-1 text-xs text-slate-500">
          Define cómo se cuentan los productos (UN, KG, CJ, etc.). No se puede eliminar ni cambiar
          la abreviatura si hay productos que la usan.
        </p>

        <form onSubmit={crearUnidad} className="mt-3 flex flex-wrap gap-2">
          <input
            value={nuevaUnidad.nombre}
            onChange={(e) => setNuevaUnidad({ ...nuevaUnidad, nombre: e.target.value })}
            placeholder="Nombre (ej. Botella)"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base"
          />
          <input
            value={nuevaUnidad.abreviatura}
            onChange={(e) =>
              setNuevaUnidad({ ...nuevaUnidad, abreviatura: e.target.value.toUpperCase() })
            }
            placeholder="Abrev."
            maxLength={12}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2.5 text-base uppercase"
          />
          <button
            type="submit"
            disabled={saving || !nuevaUnidad.nombre.trim() || !nuevaUnidad.abreviatura.trim()}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Crear
          </button>
        </form>

        {unidades.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No hay unidades registradas.</p>
        ) : (
          <CollapsibleList
            items={unidades}
            getKey={(u) => u.id}
            forceExpanded={!!editUnidadId}
            className="mt-4 shadow-none ring-0"
            itemClassName="py-3"
            renderItem={(u) =>
              editUnidadId === u.id ? (
                <div className="space-y-2">
                  <input
                    value={editUnidadForm.nombre}
                    onChange={(e) =>
                      setEditUnidadForm({ ...editUnidadForm, nombre: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                    placeholder="Nombre"
                  />
                  <input
                    value={editUnidadForm.abreviatura}
                    onChange={(e) =>
                      setEditUnidadForm({
                        ...editUnidadForm,
                        abreviatura: e.target.value.toUpperCase(),
                      })
                    }
                    disabled={u.productosCount > 0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-base uppercase disabled:bg-slate-50"
                    placeholder="Abreviatura"
                  />
                  {u.productosCount > 0 && (
                    <p className="text-xs text-amber-700">
                      La abreviatura no se puede cambiar: {u.productosCount} producto(s) la usan.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => guardarUnidad(u.id)}
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditUnidadId(null)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={`font-medium ${u.activo ? "text-slate-900" : "text-slate-400"}`}
                    >
                      {u.nombre}{" "}
                      <span className="font-mono text-sm text-slate-500">({u.abreviatura})</span>
                      {!u.activo && (
                        <span className="ml-2 text-xs font-normal uppercase">Inactiva</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {u.productosCount} {u.productosCount === 1 ? "producto" : "productos"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {u.activo ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditUnidadId(u.id);
                            setEditUnidadForm({
                              nombre: u.nombre,
                              abreviatura: u.abreviatura,
                            });
                          }}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ type: "unidad", item: u })}
                          disabled={u.productosCount > 0}
                          className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40"
                        >
                          Eliminar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => reactivarUnidad(u.id)}
                        disabled={saving}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>
              )
            }
          />
        )}
      </section>

      <ConfirmDialog
        open={!!deleteTarget}
        title={
          deleteTarget?.type === "categoria" ? "Eliminar categoría" : "Eliminar unidad"
        }
        message={
          deleteTarget?.type === "categoria"
            ? deleteTarget.item.productosCount > 0
              ? `"${deleteTarget.item.nombre}" tiene ${deleteTarget.item.productosCount} producto(s). Cambia la categoría de esos productos antes de eliminarla.`
              : `¿Eliminar la categoría "${deleteTarget.item.nombre}"? Esta acción no se puede deshacer.`
            : `¿Eliminar la unidad "${deleteTarget?.item.nombre}" (${deleteTarget?.item.abreviatura})?`
        }
        confirmLabel="Confirmar"
        loading={saving}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
