"use client";

import { useCallback, useEffect, useState } from "react";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface ProductoItem {
  id: string;
  codigoBarras: string;
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: string;
  categoria: string | null;
}

interface GrupoCategoria {
  categoria: string;
  productos: ProductoItem[];
  total: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ImportPreview {
  creados: number;
  modificados: number;
  sinCambios: number;
  errores: { fila: number; motivo: string }[];
  totalFilas: number;
}

type ImportResult = ImportPreview;

type Flash = { type: "success" | "error"; message: string } | null;

const emptyForm = {
  codigoBarras: "",
  codigoInterno: "",
  descripcion: "",
  unidadMedida: "UN",
  categoria: "",
};

export function ProductosClient() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [grupos, setGrupos] = useState<GrupoCategoria[]>([]);
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<Flash>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductoItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ProductoItem | null>(null);

  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const fetchData = useCallback(async (search: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      q: search,
      page: String(p),
      limit: "50",
    });
    if (!search.trim()) {
      params.set("groupBy", "categoria");
    }

    const res = await fetch(`/api/productos?${params}`);
    if (res.ok) {
      const data = await res.json();
      if (data.grupos) {
        setGrupos(data.grupos);
        setProductos([]);
      } else {
        setProductos(data.productos);
        setGrupos([]);
      }
      setPagination(data.pagination);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(debouncedQ, page);
  }, [debouncedQ, page, fetchData]);

  function toggleGrupo(categoria: string) {
    setOpenGrupos((prev) => {
      const next = new Set(prev);
      if (next.has(categoria)) next.delete(categoria);
      else next.add(categoria);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(producto: ProductoItem) {
    setEditing(producto);
    setForm({
      codigoBarras: producto.codigoBarras,
      codigoInterno: producto.codigoInterno ?? "",
      descripcion: producto.descripcion,
      unidadMedida: producto.unidadMedida,
      categoria: producto.categoria ?? "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFlash(null);

    const payload = {
      codigoBarras: form.codigoBarras,
      codigoInterno: form.codigoInterno || null,
      descripcion: form.descripcion,
      unidadMedida: form.unidadMedida,
      categoria: form.categoria || null,
    };

    const url = editing ? `/api/productos/${editing.id}` : "/api/productos";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al guardar" });
      return;
    }

    setShowForm(false);
    setFlash({ type: "success", message: editing ? "Producto actualizado" : "Producto creado" });
    fetchData(debouncedQ, page);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    const res = await fetch(`/api/productos/${deleteTarget.id}`, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    setDeleteTarget(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al eliminar" });
      return;
    }

    setFlash({ type: "success", message: data.message ?? "Producto eliminado" });
    fetchData(debouncedQ, page);
  }

  async function handleImportSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setFlash(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/productos/importar/preview", {
      method: "POST",
      body: formData,
    });

    const preview = await res.json();
    setImporting(false);

    if (!res.ok) {
      setFlash({ type: "error", message: preview.error ?? "Error en la vista previa" });
      return;
    }

    if (preview.modificados > 0) {
      setImportPreview(preview);
      setPendingImportFile(file);
      return;
    }

    await runImport(file);
  }

  async function runImport(file: File) {
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/productos/importar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setImporting(false);
    setImportPreview(null);
    setPendingImportFile(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error en la importación" });
      return;
    }

    setImportResult(data);
    fetchData(debouncedQ, 1);
    setPage(1);
  }

  function renderProductoItem(p: ProductoItem) {
    return (
      <li key={p.id} className="border-b border-slate-100 px-3 py-2.5 last:border-b-0">
        <p className="font-medium text-slate-900">{p.descripcion}</p>
        <p className="font-mono text-xs text-slate-500">{p.codigoBarras}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
          {p.codigoInterno && <span>Int: {p.codigoInterno}</span>}
          <span>{p.unidadMedida}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(p)}
            className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(p)}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600"
          >
            Eliminar
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      {flash && (
        <FlashMessage type={flash.type} message={flash.message} onDismiss={() => setFlash(null)} />
      )}

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por código o nombre…"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white"
        >
          + Agregar
        </button>
        <a
          href="/api/productos/exportar"
          className="flex items-center justify-center rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700"
        >
          Descargar Excel
        </a>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href="/api/productos/plantilla"
          className="flex items-center justify-center rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700"
        >
          Plantilla
        </a>
        <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-600">
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleImportSelect}
            disabled={importing}
          />
          {importing ? "Procesando…" : "Subir Excel"}
        </label>
      </div>

      {importResult && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h3 className="font-bold text-slate-900">Importación completada</h3>
          <p className="mt-2 text-sm text-slate-600">
            {importResult.creados} creados · {importResult.modificados} actualizados ·{" "}
            {importResult.errores.length} errores
          </p>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h3 className="mb-3 font-bold text-slate-900">
            {editing ? "Editar producto" : "Nuevo producto"}
          </h3>
          <div className="space-y-3">
            <Field label="Código de barras *" value={form.codigoBarras} onChange={(v) => setForm({ ...form, codigoBarras: v })} required />
            <Field label="Código interno" value={form.codigoInterno} onChange={(v) => setForm({ ...form, codigoInterno: v })} />
            <Field label="Descripción *" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
            <Field label="Unidad *" value={form.unidadMedida} onChange={(v) => setForm({ ...form, unidadMedida: v })} required />
            <Field label="Categoría" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} />
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border py-3 font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-60">
              Guardar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
      ) : debouncedQ.trim() ? (
        productos.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            No se encontraron productos.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
              {productos.map(renderProductoItem)}
            </ul>
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="text-sm font-medium text-blue-600 disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-sm text-slate-600">
                  {page}/{pagination.totalPages} ({pagination.total})
                </span>
                <button
                  type="button"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="text-sm font-medium text-blue-600 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )
      ) : grupos.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No hay productos.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {pagination.total} productos en {grupos.length} categorías. Toca una categoría para expandir.
          </p>
          {grupos.map((g) => {
            const isOpen = openGrupos.has(g.categoria);
            return (
              <div key={g.categoria} className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                <button
                  type="button"
                  onClick={() => toggleGrupo(g.categoria)}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left active:bg-slate-50"
                >
                  <span className={`text-slate-400 ${isOpen ? "rotate-90" : ""}`}>▶</span>
                  <span className="flex-1 font-semibold text-slate-900">{g.categoria}</span>
                  <span className="text-xs text-slate-500">{g.total}</span>
                </button>
                {isOpen && (
                  <ul className="max-h-80 overflow-y-auto border-t border-slate-100">
                    {g.productos.map(renderProductoItem)}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!importPreview && importPreview.modificados > 0}
        title="Confirmar actualización"
        message={
          importPreview
            ? `Se crearán ${importPreview.creados} producto(s) nuevo(s) y se modificarán ${importPreview.modificados} existente(s). ${importPreview.sinCambios} fila(s) sin cambios. ¿Continuar?`
            : ""
        }
        confirmLabel="Importar"
        loading={importing}
        onConfirm={() => pendingImportFile && runImport(pendingImportFile)}
        onCancel={() => {
          setImportPreview(null);
          setPendingImportFile(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar producto"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.descripcion}"?` : ""}
        loading={loading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
      />
    </label>
  );
}
