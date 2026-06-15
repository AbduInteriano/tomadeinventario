"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  soloLectura?: boolean;
  conteosIniciales: ConteoItem[];
  noCatalogadosIniciales: NoCatalogadoItem[];
}

type PendingAction =
  | { type: "catalogado"; producto: ProductoEncontrado; codigo: string }
  | { type: "no-catalogado"; codigo: string };

export function ConteoAreaClient({
  asignacionId,
  areaNombre,
  puntoNombre,
  estadoInicial,
  soloLectura = false,
  conteosIniciales,
  noCatalogadosIniciales,
}: ConteoAreaClientProps) {
  const [conteos, setConteos] = useState(conteosIniciales);
  const [noCatalogados, setNoCatalogados] = useState(noCatalogadosIniciales);
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [codigoManual, setCodigoManual] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [descripcionLibre, setDescripcionLibre] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [completando, setCompletando] = useState(false);
  const [exportando, setExportando] = useState(false);

  async function descargarExcel() {
    setExportando(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/asignaciones/${asignacionId}/exportar`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          typeof err.error === "string"
            ? err.error
            : "No se pudo generar el Excel del conteo"
        );
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `conteo-${asignacionId}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: "ok", text: "Excel descargado correctamente" });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al descargar Excel",
      });
    } finally {
      setExportando(false);
    }
  }

  const procesarCodigo = useCallback(async (codigo: string) => {
    const trimmed = codigo.trim();
    if (!trimmed) return;

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(
        `/api/productos/buscar?codigo=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          data && typeof data.error === "string"
            ? data.error
            : `No se pudo buscar el código (${res.status}). Reintenta o ingresa manualmente.`;
        setMessage({ type: "err", text: msg });
        return;
      }

      if (!data) {
        setMessage({
          type: "err",
          text: "Respuesta inválida del servidor al buscar el producto.",
        });
        return;
      }

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
    } catch (err) {
      setMessage({
        type: "err",
        text:
          err instanceof Error
            ? `Error al buscar: ${err.message}`
            : "Error de conexión. Revisa tu internet e intenta de nuevo.",
      });
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
    const previousConteos = conteos;

    try {
      if (pending.type === "catalogado") {
        const producto = pending.producto;
        const optimisticId = `tmp-${producto.id}`;
        setConteos((prev) => {
          const idx = prev.findIndex((c) => c.codigoBarras === producto.codigoBarras);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              cantidadContada: next[idx].cantidadContada + qty,
            };
            return next;
          }
          return [
            {
              id: optimisticId,
              codigoBarras: producto.codigoBarras,
              descripcion: producto.descripcion,
              unidadMedida: producto.unidadMedida,
              cantidadContada: qty,
            },
            ...prev,
          ];
        });
        setPending(null);
        setCodigoManual("");

        const res = await fetch("/api/conteos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            asignacionId,
            productoId: producto.id,
            cantidad: qty,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          setConteos(previousConteos);
          throw new Error(err.error ?? "Error al guardar");
        }

        const saved = await res.json();
        setConteos((prev) => {
          const withoutTmp = prev.filter((c) => c.id !== optimisticId);
          const idx = withoutTmp.findIndex((c) => c.id === saved.id);
          if (idx >= 0) {
            const next = [...withoutTmp];
            next[idx] = saved;
            return next;
          }
          return [saved, ...withoutTmp];
        });
        setMessage({ type: "ok", text: `Guardado: ${saved.descripcion} (${saved.cantidadContada} ${saved.unidadMedida})` });
      } else {
        if (!descripcionLibre.trim()) {
          setMessage({ type: "err", text: "Describe el producto no catalogado" });
          setLoading(false);
          return;
        }

        const res = await fetch("/api/conteos/no-catalogado", {
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

  async function iniciarToma() {
    setCompletando(true);
    try {
      const res = await fetch(`/api/asignaciones/${asignacionId}/iniciar`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error");
      }
      setEstado("EN_PROGRESO");
      setMessage({ type: "ok", text: "Toma iniciada. Ya puedes registrar conteos." });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al iniciar",
      });
    } finally {
      setCompletando(false);
    }
  }

  async function pausarToma() {
    setCompletando(true);
    try {
      const res = await fetch(`/api/asignaciones/${asignacionId}/pausar`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error");
      }
      setEstado("PAUSADA");
      setMessage({ type: "ok", text: "Toma pausada. Puedes volver más tarde." });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al pausar",
      });
    } finally {
      setCompletando(false);
    }
  }

  async function finalizarToma() {
    if (!confirm("¿Finalizar esta toma? No podrás agregar más conteos.")) {
      return;
    }

    setCompletando(true);
    try {
      const res = await fetch(`/api/asignaciones/${asignacionId}/finalizar`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error");
      }
      setEstado("COMPLETADA");
      setMessage({ type: "ok", text: "Toma finalizada correctamente" });
      router.push("/tomador");
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al finalizar",
      });
    } finally {
      setCompletando(false);
    }
  }

  const puedeEscanear = estado === "EN_PROGRESO" && !soloLectura;
  const bloqueado = estado === "COMPLETADA" || soloLectura;
  const puedeGestionar = !soloLectura && estado !== "COMPLETADA";

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
          <p className="mt-2 text-sm text-slate-600">
            {conteos.length}{" "}
            {conteos.length === 1 ? "producto registrado" : "productos registrados"}
          </p>
          {(conteos.length > 0 || noCatalogados.length > 0 || estado === "COMPLETADA") && (
            <button
              type="button"
              onClick={descargarExcel}
              disabled={exportando}
              className="mt-3 w-full rounded-lg border border-green-600 py-2.5 text-sm font-semibold text-green-700 active:bg-green-50 disabled:opacity-60"
            >
              {exportando ? "Generando Excel…" : "Descargar Excel del conteo"}
            </button>
          )}
        </div>

        {soloLectura && estado !== "COMPLETADA" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Vista de solo lectura. Solo el usuario asignado puede modificar esta toma.
          </div>
        )}

        {!bloqueado && estado === "PENDIENTE" && puedeGestionar && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
            <p className="text-sm text-blue-900">
              Debes iniciar la toma antes de registrar conteos.
            </p>
            <button
              type="button"
              onClick={iniciarToma}
              disabled={completando}
              className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-60"
            >
              {completando ? "Iniciando…" : "Iniciar toma"}
            </button>
          </div>
        )}

        {!bloqueado && estado === "PAUSADA" && puedeGestionar && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <p className="text-sm text-amber-900">
              Esta toma está pausada. Reanúdala para seguir contando.
            </p>
            <button
              type="button"
              onClick={iniciarToma}
              disabled={completando}
              className="mt-3 w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:opacity-60"
            >
              {completando ? "Reanudando…" : "Reanudar toma"}
            </button>
          </div>
        )}

        {puedeEscanear && (
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

      {!bloqueado && estado === "EN_PROGRESO" && puedeGestionar && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-lg gap-2">
            <button
              type="button"
              onClick={pausarToma}
              disabled={completando}
              className="flex-1 rounded-xl border-2 border-amber-500 py-3.5 font-semibold text-amber-700 active:bg-amber-50 disabled:opacity-60"
            >
              {completando ? "…" : "Pausar"}
            </button>
            <button
              type="button"
              onClick={finalizarToma}
              disabled={completando}
              className="flex-1 rounded-xl border-2 border-green-600 py-3.5 font-semibold text-green-700 active:bg-green-50 disabled:opacity-60"
            >
              {completando ? "…" : "Finalizar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
