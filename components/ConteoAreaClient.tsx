"use client";

import { useState, useCallback } from "react";
import { BarcodeScanner } from "@/components/BarcodeScanner";

interface ProductoEncontrado {
  id: string;
  codigoBarras: string;
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: string;
}

interface ConteoItem {
  id: string;
  codigoBarras: string;
  descripcion: string;
  unidadMedida: string;
  cantidadContada: number;
}

interface NoCatalogadoItem {
  id: string;
  codigoEscaneado: string;
  descripcionLibre: string;
  cantidad: number;
}

interface ConteoAreaClientProps {
  asignacionId: string;
  areaNombre: string;
  puntoNombre: string;
  estadoInicial: string;
  conteosIniciales: ConteoItem[];
  noCatalogadosIniciales: NoCatalogadoItem[];
  totalProductos: number;
}

type PendingAction =
  | { type: "catalogado"; producto: ProductoEncontrado; codigo: string }
  | { type: "no-catalogado"; codigo: string };

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastError;
}

export function ConteoAreaClient({
  asignacionId,
  areaNombre,
  puntoNombre,
  estadoInicial,
  conteosIniciales,
  noCatalogadosIniciales,
  totalProductos,
}: ConteoAreaClientProps) {
  const [conteos, setConteos] = useState(conteosIniciales);
  const [noCatalogados, setNoCatalogados] = useState(noCatalogadosIniciales);
  const [estado, setEstado] = useState(estadoInicial);
  const [codigoManual, setCodigoManual] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [descripcionLibre, setDescripcionLibre] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [completando, setCompletando] = useState(false);

  const procesarCodigo = useCallback(async (codigo: string) => {
    const trimmed = codigo.trim();
    if (!trimmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetchWithRetry(
        `/api/productos/buscar?codigo=${encodeURIComponent(trimmed)}`,
        { method: "GET" }
      );
      const data = await res.json();

      if (data.encontrado) {
        setPending({ type: "catalogado", producto: data.producto, codigo: trimmed });
        setCantidad("1");
        setShowScanner(false);
      } else {
        setPending({ type: "no-catalogado", codigo: trimmed });
        setCantidad("1");
        setDescripcionLibre("");
        setShowScanner(false);
      }
    } catch {
      setMessage({ type: "err", text: "Error de conexión. Reintenta." });
    } finally {
      setLoading(false);
    }
  }, []);

  async function guardarConteo() {
    if (!pending) return;
    const qty = parseFloat(cantidad.replace(",", "."));
    if (!qty || qty <= 0) {
      setMessage({ type: "err", text: "Ingresa una cantidad válida mayor a 0" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (pending.type === "catalogado") {
        const res = await fetchWithRetry("/api/conteos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asignacionId,
            productoId: pending.producto.id,
            cantidad: qty,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Error al guardar");
        }

        const saved = await res.json();
        setConteos((prev) => {
          const idx = prev.findIndex((c) => c.id === saved.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = saved;
            return next;
          }
          return [saved, ...prev];
        });
        setEstado((e) => (e === "PENDIENTE" ? "EN_PROGRESO" : e));
        setMessage({ type: "ok", text: `Guardado: ${saved.descripcion} (${saved.cantidadContada} ${saved.unidadMedida})` });
      } else {
        if (!descripcionLibre.trim()) {
          setMessage({ type: "err", text: "Describe el producto no catalogado" });
          setLoading(false);
          return;
        }

        const res = await fetchWithRetry("/api/conteos/no-catalogado", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asignacionId,
            codigoEscaneado: pending.codigo,
            descripcionLibre: descripcionLibre.trim(),
            cantidad: qty,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Error al guardar");
        }

        const saved = await res.json();
        setNoCatalogados((prev) => [saved, ...prev]);
        setEstado((e) => (e === "PENDIENTE" ? "EN_PROGRESO" : e));
        setMessage({ type: "ok", text: "Producto no catalogado registrado para revisión" });
      }

      setPending(null);
      setCodigoManual("");
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al guardar",
      });
    } finally {
      setLoading(false);
    }
  }

  async function marcarCompletada() {
    if (!confirm("¿Marcar esta área como completada? No podrás agregar más conteos.")) {
      return;
    }

    setCompletando(true);
    try {
      const res = await fetch(`/api/asignaciones/${asignacionId}/completar`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error");
      }
      setEstado("COMPLETADA");
      setMessage({ type: "ok", text: "Área marcada como completada" });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al completar",
      });
    } finally {
      setCompletando(false);
    }
  }

  const bloqueado = estado === "COMPLETADA";
  const progreso = totalProductos > 0 ? Math.round((conteos.length / totalProductos) * 100) : 0;

  return (
    <div className="pb-28">
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => procesarCodigo(code)}
          onClose={() => setShowScanner(false)}
        />
      )}

      <div className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">{puntoNombre}</p>
          <p className="text-xl font-bold text-slate-900">{areaNombre}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Productos contados</span>
              <span className="font-medium text-slate-900">
                {conteos.length} / {totalProductos}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(progreso, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {!bloqueado && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-semibold text-white shadow active:bg-blue-700 disabled:opacity-60"
            >
              <span className="text-2xl">📷</span>
              Escanear código
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ingresar código manualmente"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") procesarCodigo(codigoManual);
                }}
                className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
              <button
                type="button"
                onClick={() => procesarCodigo(codigoManual)}
                disabled={loading || !codigoManual.trim()}
                className="shrink-0 rounded-xl bg-slate-800 px-5 py-3 font-semibold text-white active:bg-slate-900 disabled:opacity-60"
              >
                Buscar
              </button>
            </div>
          </div>
        )}

        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              message.type === "ok"
                ? "bg-green-50 text-green-800"
                : "bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {pending && (
          <div className="rounded-xl border-2 border-blue-500 bg-blue-50 p-4">
            {pending.type === "catalogado" ? (
              <>
                <p className="text-xs font-medium uppercase text-blue-600">Producto encontrado</p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {pending.producto.descripcion}
                </p>
                <p className="text-sm text-slate-600">
                  {pending.producto.codigoBarras} · {pending.producto.unidadMedida}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium uppercase text-amber-600">No catalogado</p>
                <p className="mt-1 font-mono text-lg text-slate-900">{pending.codigo}</p>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  Descripción
                  <input
                    type="text"
                    value={descripcionLibre}
                    onChange={(e) => setDescripcionLibre(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
                    placeholder="Describe el producto"
                    autoFocus
                  />
                </label>
              </>
            )}

            <label className="mt-3 block text-sm font-medium text-slate-700">
              Cantidad
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-xl font-semibold"
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="flex-1 rounded-xl border border-slate-300 py-3 font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarConteo}
                disabled={loading}
                className="flex-1 rounded-xl bg-green-600 py-3 font-semibold text-white active:bg-green-700 disabled:opacity-60"
              >
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Conteos ({conteos.length})
          </h2>
          {conteos.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">
              Aún no hay productos contados en esta área.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              {conteos.map((c) => (
                <li key={c.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{c.descripcion}</p>
                      <p className="text-xs text-slate-500">{c.codigoBarras}</p>
                    </div>
                    <span className="shrink-0 text-lg font-bold text-blue-600">
                      {c.cantidadContada} {c.unidadMedida}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {noCatalogados.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-600">
              No catalogados ({noCatalogados.length})
            </h2>
            <ul className="divide-y divide-amber-100 rounded-xl bg-amber-50 shadow-sm ring-1 ring-amber-200">
              {noCatalogados.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <p className="font-medium text-slate-900">{n.descripcionLibre}</p>
                  <p className="text-xs text-slate-500">
                    {n.codigoEscaneado} · {n.cantidad} uds.
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {!bloqueado && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={marcarCompletada}
            disabled={completando}
            className="mx-auto block w-full max-w-lg rounded-xl border-2 border-green-600 py-3.5 font-semibold text-green-700 active:bg-green-50 disabled:opacity-60"
          >
            {completando ? "Completando…" : "Marcar área como completada"}
          </button>
        </div>
      )}
    </div>
  );
}
