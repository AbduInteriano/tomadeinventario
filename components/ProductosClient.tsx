"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FlashMessage } from "@/components/FlashMessage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CollapsibleList } from "@/components/CollapsibleList";

export interface ProductoItem {
  id: string;
  codigoBarras: string;
  codigoArticulo: string | null;
  descripcion: string;
  unidadMedida: string;
  unidadMedidaId: string;
  categoria: string | null;
  categoriaId: string | null;
}

interface CategoriaItem {
  id: string;
  nombre: string;
}

interface UnidadItem {
  id: string;
  nombre: string;
  abreviatura: string;
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
  filasValidas: number;
}

type ImportResult = ImportPreview & { actualizados?: number };

type Flash = { type: "success" | "error"; message: string } | null;

const emptyForm = {
  codigoBarras: "",
  codigoArticulo: "",
  descripcion: "",
  unidadMedidaId: "",
  categoriaId: "",
};

export function ProductosClient() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [productos, setProductos] = useState<ProductoItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
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
  const [categorias, setCategorias] = useState<CategoriaItem[]>([]);
  const [unidades, setUnidades] = useState<UnidadItem[]>([]);

  async function loadCatalogo() {
    const [catsRes, unidadesRes] = await Promise.all([
      fetch("/api/categorias"),
      fetch("/api/unidades-medida"),
    ]);
    if (catsRes.ok) setCategorias(await catsRes.json());
    if (unidadesRes.ok) setUnidades(await unidadesRes.json());
  }

  useEffect(() => {
    loadCatalogo();
  }, []);

  useEffect(() => {
    if (showForm) loadCatalogo();
  }, [showForm]);

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

    const res = await fetch(`/api/productos?${params}`);
    if (res.ok) {
      const data = await res.json();
      setProductos(data.productos ?? []);
      setPagination(data.pagination);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(debouncedQ, page);
  }, [debouncedQ, page, fetchData]);

  function openCreate() {
    setEditing(null);
    const defaultUnidad =
      unidades.find((u) => u.abreviatura === "UN")?.id ?? unidades[0]?.id ?? "";
    setForm({ ...emptyForm, unidadMedidaId: defaultUnidad });
    setShowForm(true);
  }

  function openEdit(producto: ProductoItem) {
    setEditing(producto);
    setForm({
      codigoBarras: producto.codigoBarras,
      codigoArticulo: producto.codigoArticulo ?? "",
      descripcion: producto.descripcion,
      unidadMedidaId: producto.unidadMedidaId,
      categoriaId: producto.categoriaId ?? "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFlash(null);

    const payload = {
      codigoBarras: form.codigoBarras,
      codigoArticulo: form.codigoArticulo || null,
      descripcion: form.descripcion,
      unidadMedidaId: form.unidadMedidaId,
      categoriaId: form.categoriaId || null,
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
    setPage(1);
    setFlash({ type: "success", message: editing ? "Producto actualizado" : "Producto creado" });
    fetchData(debouncedQ, 1);
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

    setImportPreview(preview);

    if ((preview.filasValidas ?? 0) === 0) {
      setFlash({
        type: "error",
        message:
          "Ninguna fila cumple los requisitos. Registra categorías y unidades en Catálogo y revisa la plantilla.",
      });
      return;
    }

    setPendingImportFile(file);

    if (preview.modificados > 0) {
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
      <>
        <p className="font-medium text-slate-900">{p.descripcion}</p>
        <p className="font-mono text-xs text-slate-500">{p.codigoBarras}</p>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-slate-500">
          {p.codigoArticulo && <span>Art: {p.codigoArticulo}</span>}
          <span>{p.unidadMedida}</span>
          {p.categoria && <span>· {p.categoria}</span>}
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
      </>
    );
  }

  return (
    <div className="space-y-4">
      {flash && (
        <FlashMessage type={flash.type} message={flash.message} onDismiss={() => setFlash(null)} />
      )}

      <Link
        href="/supervisor/catalogo"
        className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
      >
        Antes de importar Excel: crea todas las{" "}
        <span className="font-semibold">categorías y unidades</span> en Catálogo →
      </Link>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por código de barras, código artículo o nombre…"
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
            {importResult.creados} creados ·{" "}
            {importResult.actualizados ?? importResult.modificados} actualizados ·{" "}
            {importResult.sinCambios} sin cambios · {importResult.errores.length} fila(s) con
            error
          </p>
          <ImportErroresList errores={importResult.errores} />
        </div>
      )}

      {importPreview && importPreview.errores.length > 0 && !importResult && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            Vista previa — {importPreview.errores.length} fila(s) con error
          </h3>
          <p className="mt-1 text-xs text-amber-800">
            Se importarán {importPreview.filasValidas} de {importPreview.totalFilas} filas si
            continúas.
          </p>
          <ImportErroresList errores={importPreview.errores} />
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h3 className="mb-3 font-bold text-slate-900">
            {editing ? "Editar producto" : "Nuevo producto"}
          </h3>
          <div className="space-y-3">
            <Field label="Código de barras *" value={form.codigoBarras} onChange={(v) => setForm({ ...form, codigoBarras: v })} required />
            <Field label="Código Artículo" value={form.codigoArticulo} onChange={(v) => setForm({ ...form, codigoArticulo: v })} />
            <Field label="Descripción *" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />

            <label className="block text-sm font-medium text-slate-700">
              Unidad de medida *
              <select
                required
                value={form.unidadMedidaId}
                onChange={(e) => setForm({ ...form, unidadMedidaId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              >
                <option value="">Seleccionar…</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.abreviatura})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Categoría
              <select
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {editing && (
                <span className="mt-1 block text-xs text-slate-500">
                  Puedes mover el producto a otra categoría o dejarlo sin categoría.
                </span>
              )}
            </label>

            {(unidades.length === 0 || categorias.length === 0) && (
              <p className="text-sm text-amber-800">
                Falta configurar el catálogo.{" "}
                <Link href="/supervisor/catalogo" className="font-medium underline">
                  Crear categorías o unidades
                </Link>
              </p>
            )}
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
      ) : productos.length === 0 && pagination.total === 0 ? (
        <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          {debouncedQ.trim() ? "No se encontraron productos." : "No hay productos. Agrega uno o importa desde Excel."}
        </p>
      ) : (
        <>
          {!debouncedQ.trim() && pagination.total > 0 && (
            <p className="text-xs text-slate-500">
              {pagination.total} producto{pagination.total === 1 ? "" : "s"} en total
            </p>
          )}
          <CollapsibleList
            items={productos}
            getKey={(p) => p.id}
            forceExpanded={!!debouncedQ.trim()}
            itemClassName="px-3 py-2.5"
            renderItem={renderProductoItem}
          />
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
      )}

      <ConfirmDialog
        open={!!importPreview && !!pendingImportFile && importPreview.modificados > 0}
        title="Confirmar importación"
        message={
          importPreview
            ? `Se crearán ${importPreview.creados} producto(s) nuevo(s) y se actualizarán ${importPreview.modificados} existente(s). ${importPreview.sinCambios} sin cambios.${importPreview.errores.length > 0 ? ` ${importPreview.errores.length} fila(s) se omitirán por error.` : ""} ¿Continuar?`
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

function ImportErroresList({
  errores,
}: {
  errores: { fila: number; motivo: string }[];
}) {
  if (errores.length === 0) return null;

  const visibles = errores.slice(0, 25);

  return (
    <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 font-medium">Fila</th>
            <th className="px-3 py-2 font-medium">Motivo</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((e) => (
            <tr key={`${e.fila}-${e.motivo}`} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-700">{e.fila}</td>
              <td className="px-3 py-2 text-slate-600">{e.motivo}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {errores.length > 25 && (
        <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          … y {errores.length - 25} error(es) más
        </p>
      )}
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
