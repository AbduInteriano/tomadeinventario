"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface ProductoItem {
  id: string;
  codigoBarras: string;
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: string;
  categoria: string | null;
  stockGlobal: number;
  conteosCount?: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ImportResult {
  creados: number;
  actualizados: number;
  errores: { fila: number; motivo: string }[];
  totalFilas: number;
}

interface ProductosClientProps {
  initialProductos: ProductoItem[];
  initialPagination: Pagination;
}

type Flash = { type: "success" | "error"; message: string } | null;

const emptyForm = {
  codigoBarras: "",
  codigoInterno: "",
  descripcion: "",
  unidadMedida: "UN",
  categoria: "",
  stockGlobal: "0",
};

export function ProductosClient({
  initialProductos,
  initialPagination,
}: ProductosClientProps) {
  const [productos, setProductos] = useState(initialProductos);
  const [pagination, setPagination] = useState(initialPagination);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ProductoItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<ProductoItem | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const skipInitialFetch = useRef(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const fetchProductos = useCallback(async (search: string, p: number) => {
    setLoading(true);
    const params = new URLSearchParams({
      q: search,
      page: String(p),
      limit: String(pagination.limit),
    });
    const res = await fetch(`/api/productos?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProductos(data.productos);
      setPagination(data.pagination);
    }
    setLoading(false);
  }, [pagination.limit]);

  useEffect(() => {
    if (skipInitialFetch.current && debouncedQ === "" && page === 1) {
      skipInitialFetch.current = false;
      return;
    }
    fetchProductos(debouncedQ, page);
  }, [debouncedQ, page, fetchProductos]);

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
      stockGlobal: String(producto.stockGlobal),
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
      stockGlobal: parseFloat(form.stockGlobal.replace(",", ".")) || 0,
    };

    const url = editing ? `/api/productos/${editing.id}` : "/api/productos";
    const method = editing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
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
    setFlash({
      type: "success",
      message: editing ? "Producto actualizado" : "Producto creado",
    });
    fetchProductos(debouncedQ, page);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);

    const res = await fetch(`/api/productos/${deleteTarget.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setLoading(false);
    setDeleteTarget(null);

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error al eliminar" });
      return;
    }

    setFlash({ type: "success", message: data.message ?? "Producto eliminado" });
    fetchProductos(debouncedQ, page);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setFlash(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/productos/importar", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setImporting(false);
    e.target.value = "";

    if (!res.ok) {
      setFlash({ type: "error", message: data.error ?? "Error en la importación" });
      return;
    }

    setImportResult(data);
    fetchProductos(debouncedQ, 1);
    setPage(1);
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por código o descripción…"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={openCreate}
          className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white active:bg-blue-700"
        >
          + Agregar
        </button>
        <a
          href="/api/productos/plantilla"
          className="flex items-center justify-center rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
        >
          Plantilla
        </a>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white py-4 text-sm font-medium text-slate-600 active:bg-slate-50">
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleImport}
          disabled={importing}
        />
        {importing ? "Importando…" : "📤 Cargar Excel (.xlsx)"}
      </label>

      {importResult && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h3 className="font-bold text-slate-900">Resultado de importación</h3>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-green-50 py-2">
              <p className="text-lg font-bold text-green-700">{importResult.creados}</p>
              <p className="text-green-600">Creados</p>
            </div>
            <div className="rounded-lg bg-blue-50 py-2">
              <p className="text-lg font-bold text-blue-700">{importResult.actualizados}</p>
              <p className="text-blue-600">Actualizados</p>
            </div>
            <div className="rounded-lg bg-red-50 py-2">
              <p className="text-lg font-bold text-red-700">{importResult.errores.length}</p>
              <p className="text-red-600">Errores</p>
            </div>
          </div>
          {importResult.errores.length > 0 && (
            <div className="mt-3 max-h-48 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-1 pr-2">Fila</th>
                    <th className="py-1">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.errores.map((err) => (
                    <tr key={`${err.fila}-${err.motivo}`} className="border-b border-slate-100">
                      <td className="py-1.5 pr-2 font-mono">{err.fila}</td>
                      <td className="py-1.5 text-red-700">{err.motivo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
        >
          <h3 className="mb-3 font-bold text-slate-900">
            {editing ? "Editar producto" : "Nuevo producto"}
          </h3>
          <div className="space-y-3">
            <Field label="Código de barras *" value={form.codigoBarras} onChange={(v) => setForm({ ...form, codigoBarras: v })} required />
            <Field label="Código interno" value={form.codigoInterno} onChange={(v) => setForm({ ...form, codigoInterno: v })} />
            <Field label="Descripción *" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
            <Field label="Unidad *" value={form.unidadMedida} onChange={(v) => setForm({ ...form, unidadMedida: v })} required />
            <Field label="Categoría" value={form.categoria} onChange={(v) => setForm({ ...form, categoria: v })} />
            <Field label="Stock global" value={form.stockGlobal} onChange={(v) => setForm({ ...form, stockGlobal: v })} inputMode="decimal" />
          </div>
          <div className="mt-4 flex gap-2">
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

      {loading && productos.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Cargando…</p>
      ) : productos.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
          No se encontraron productos.
        </p>
      ) : (
        <ul className={`divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${loading ? "opacity-60" : ""}`}>
          {productos.map((p) => (
            <li key={p.id} className="p-4">
              <p className="font-bold text-slate-900">{p.descripcion}</p>
              <p className="mt-0.5 font-mono text-xs text-slate-500">{p.codigoBarras}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600">
                {p.codigoInterno && <span>Int: {p.codigoInterno}</span>}
                <span>{p.unidadMedida}</span>
                {p.categoria && <span>{p.categoria}</span>}
                <span className="font-semibold text-blue-600">
                  Stock: {p.stockGlobal}
                </span>
              </div>
              {(p.conteosCount ?? 0) > 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  {p.conteosCount} conteo(s) en inventarios
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="flex-1 rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-700 active:bg-slate-200"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  className="flex-1 rounded-lg bg-red-50 py-2.5 text-sm font-medium text-red-600 active:bg-red-100"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-sm text-slate-600">
            {page} / {pagination.totalPages} ({pagination.total} total)
          </span>
          <button
            type="button"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar producto"
        message={
          deleteTarget
            ? (deleteTarget.conteosCount ?? 0) > 0
              ? `"${deleteTarget.descripcion}" tiene conteos registrados. Se desactivará pero no se borrará del historial.`
              : `¿Eliminar "${deleteTarget.descripcion}"? Esta acción no se puede deshacer.`
            : ""
        }
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
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
      />
    </label>
  );
}
