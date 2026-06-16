"use client";

import { useState, useCallback, useMemo } from "react";
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
  productoId: string;
  codigoBarras: string;
  descripcion: string;
  unidadMedida: string;
  cantidadContada: number;
  timestamp: string;
}

interface NoCatalogadoItem {
  id: string;
  codigoEscaneado: string;
  descripcionLibre: string;
  cantidad: number;
  timestamp: string;
}

type RegistroLinea =
  | { kind: "catalogado"; item: ConteoItem }
  | { kind: "no-catalogado"; item: NoCatalogadoItem };

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

type DuplicateAlert = PendingAction;

function mergeRegistros(
  conteos: ConteoItem[],
  noCatalogados: NoCatalogadoItem[]
): RegistroLinea[] {
  const lineas: RegistroLinea[] = [
    ...conteos.map((item) => ({ kind: "catalogado" as const, item })),
    ...noCatalogados.map((item) => ({ kind: "no-catalogado" as const, item })),
  ];
  return lineas.sort(
    (a, b) =>
      new Date(b.item.timestamp).getTime() - new Date(a.item.timestamp).getTime()
  );
}

function codigoYaContado(
  codigo: string,
  productoId: string | null,
  conteos: ConteoItem[],
  noCatalogados: NoCatalogadoItem[]
): boolean {
  const norm = codigo.trim().toLowerCase();
  if (productoId && conteos.some((c) => c.productoId === productoId)) return true;
  if (conteos.some((c) => c.codigoBarras.toLowerCase() === norm)) return true;
  if (noCatalogados.some((n) => n.codigoEscaneado.toLowerCase() === norm)) return true;
  return false;
}

export function ConteoAreaClient({
  asignacionId,
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
  const [duplicateAlert, setDuplicateAlert] = useState<DuplicateAlert | null>(null);
  const [cantidad, setCantidad] = useState("1");
  const [descripcionLibre, setDescripcionLibre] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [completando, setCompletando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [editing, setEditing] = useState<{
    kind: "catalogado" | "no-catalogado";
    id: string;
    cantidad: string;
    descripcion?: string;
  } | null>(null);

  const registros = useMemo(
    () => mergeRegistros(conteos, noCatalogados),
    [conteos, noCatalogados]
  );

  const puedeEditar = estado === "EN_PROGRESO" && !soloLectura;

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

  const abrirPendiente = useCallback((action: PendingAction) => {
    setDuplicateAlert(null);
    setPending(action);
    setCantidad("1");
    if (action.type === "no-catalogado") {
      setDescripcionLibre("");
    }
    setShowScanner(false);
  }, []);

  const procesarCodigo = useCallback(
    async (codigo: string) => {
      const trimmed = codigo.trim();
      if (!trimmed) return;

      setLoading(true);
      setMessage(null);
      setDuplicateAlert(null);

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
          const producto = data.producto as ProductoEncontrado;
          const action: PendingAction = {
            type: "catalogado",
            producto,
            codigo: trimmed,
          };
          if (codigoYaContado(trimmed, producto.id, conteos, noCatalogados)) {
            setDuplicateAlert(action);
            setShowScanner(false);
            return;
          }
          abrirPendiente(action);
        } else {
          const action: PendingAction = { type: "no-catalogado", codigo: trimmed };
          if (codigoYaContado(trimmed, null, conteos, noCatalogados)) {
            setDuplicateAlert(action);
            setShowScanner(false);
            return;
          }
          abrirPendiente(action);
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
    },
    [abrirPendiente, conteos, noCatalogados]
  );

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
        const producto = pending.producto;

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
          throw new Error(err.error ?? "Error al guardar");
        }

        const saved = await res.json();
        const item: ConteoItem = {
          id: saved.id,
          productoId: saved.productoId,
          codigoBarras: saved.codigoBarras,
          descripcion: saved.descripcion,
          unidadMedida: saved.unidadMedida,
          cantidadContada: saved.cantidadContada,
          timestamp:
            typeof saved.timestamp === "string"
              ? saved.timestamp
              : new Date(saved.timestamp).toISOString(),
        };
        setConteos((prev) => [item, ...prev]);
        setMessage({
          type: "ok",
          text: `Registrado: ${item.descripcion} (${item.cantidadContada} ${item.unidadMedida})`,
        });
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
        const item: NoCatalogadoItem = {
          id: saved.id,
          codigoEscaneado: saved.codigoEscaneado,
          descripcionLibre: saved.descripcionLibre,
          cantidad: saved.cantidad,
          timestamp:
            typeof saved.timestamp === "string"
              ? saved.timestamp
              : new Date(saved.timestamp).toISOString(),
        };
        setNoCatalogados((prev) => [item, ...prev]);
        setMessage({ type: "ok", text: "Producto no catalogado registrado" });
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

  function iniciarEdicion(linea: RegistroLinea) {
    if (linea.kind === "catalogado") {
      setEditing({
        kind: "catalogado",
        id: linea.item.id,
        cantidad: String(linea.item.cantidadContada),
      });
    } else {
      setEditing({
        kind: "no-catalogado",
        id: linea.item.id,
        cantidad: String(linea.item.cantidad),
        descripcion: linea.item.descripcionLibre,
      });
    }
  }

  async function guardarEdicion() {
    if (!editing) return;
    const qty = parseFloat(editing.cantidad.replace(",", "."));
    if (!qty || qty <= 0) {
      setMessage({ type: "err", text: "Ingresa una cantidad válida mayor a 0" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (editing.kind === "catalogado") {
        const res = await fetch(`/api/conteos/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidad: qty }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Error al actualizar");
        }
        const saved = await res.json();
        setConteos((prev) =>
          prev.map((c) =>
            c.id === editing.id
              ? {
                  ...c,
                  cantidadContada: saved.cantidadContada,
                  timestamp:
                    typeof saved.timestamp === "string"
                      ? saved.timestamp
                      : new Date(saved.timestamp).toISOString(),
                }
              : c
          )
        );
      } else {
        const desc = editing.descripcion?.trim();
        if (!desc) {
          setMessage({ type: "err", text: "La descripción es obligatoria" });
          setLoading(false);
          return;
        }
        const res = await fetch(`/api/conteos/no-catalogado/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cantidad: qty, descripcionLibre: desc }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Error al actualizar");
        }
        const saved = await res.json();
        setNoCatalogados((prev) =>
          prev.map((n) =>
            n.id === editing.id
              ? {
                  ...n,
                  cantidad: saved.cantidad,
                  descripcionLibre: saved.descripcionLibre,
                  timestamp:
                    typeof saved.timestamp === "string"
                      ? saved.timestamp
                      : new Date(saved.timestamp).toISOString(),
                }
              : n
          )
        );
      }
      setEditing(null);
      setMessage({ type: "ok", text: "Cantidad actualizada" });
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Error al actualizar",
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
    if (!confirm("¿Finalizar esta toma? No podrás agregar ni editar conteos.")) {
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

  function renderLinea(linea: RegistroLinea, index: number) {
    const isEditing =
      editing?.id === (linea.kind === "catalogado" ? linea.item.id : linea.item.id);
    const esUltimo = index === 0;

    if (linea.kind === "catalogado") {
      const c = linea.item;
      if (isEditing && editing?.kind === "catalogado") {
        return (
          <li
            key={c.id}
            className="bg-blue-50/60 px-3 py-2"
          >
            <p className="truncate text-sm font-medium text-slate-900">{c.descripcion}</p>
            <p className="text-xs text-slate-500">{c.codigoBarras}</p>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={editing.cantidad}
                onChange={(e) => setEditing({ ...editing, cantidad: e.target.value })}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold"
                autoFocus
              />
              <span className="text-xs text-slate-500">{c.unidadMedida}</span>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-xs text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarEdicion}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          </li>
        );
      }

      return (
        <li
          key={c.id}
          className={`flex items-start justify-between gap-2 px-3 py-2 ${esUltimo ? "bg-blue-50/40" : ""}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {esUltimo && (
                <span className="mr-1.5 text-[10px] font-bold uppercase text-blue-600">
                  Último
                </span>
              )}
              {c.descripcion}
            </p>
            <p className="text-xs text-slate-500">{c.codigoBarras}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-semibold text-blue-600">
              {c.cantidadContada} {c.unidadMedida}
            </span>
            {puedeEditar && (
              <button
                type="button"
                onClick={() => iniciarEdicion(linea)}
                className="text-xs text-slate-500 underline"
              >
                Editar
              </button>
            )}
          </div>
        </li>
      );
    }

    const n = linea.item;
    if (isEditing && editing?.kind === "no-catalogado") {
      return (
        <li key={n.id} className="bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-700">{n.codigoEscaneado} · no cat.</p>
          <input
            type="text"
            value={editing.descripcion ?? ""}
            onChange={(e) => setEditing({ ...editing, descripcion: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0.001"
              step="any"
              value={editing.cantidad}
              onChange={(e) => setEditing({ ...editing, cantidad: e.target.value })}
              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-semibold"
            />
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-xs text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarEdicion}
              disabled={loading}
              className="rounded-lg bg-amber-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </li>
      );
    }

    return (
      <li
        key={n.id}
        className={`flex items-start justify-between gap-2 px-3 py-2 ${esUltimo ? "bg-amber-50/80" : "bg-amber-50/30"}`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-900">
            {esUltimo && (
              <span className="mr-1.5 text-[10px] font-bold uppercase text-amber-700">
                Último
              </span>
            )}
            {n.descripcionLibre}
          </p>
          <p className="text-xs text-amber-700">{n.codigoEscaneado} · no cat.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold text-slate-700">{n.cantidad}</span>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => iniciarEdicion(linea)}
              className="text-xs text-slate-500 underline"
            >
              Editar
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="pb-16">
      {showScanner && (
        <BarcodeScanner
          onScan={(code) => procesarCodigo(code)}
          onClose={() => setShowScanner(false)}
        />
      )}

      {duplicateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-lg">
            <p className="font-semibold text-amber-800">Producto ya escaneado</p>
            <p className="mt-2 text-sm text-slate-600">
              {duplicateAlert.type === "catalogado"
                ? `«${duplicateAlert.producto.descripcion}» ya tiene un registro en este conteo.`
                : `El código «${duplicateAlert.codigo}» ya fue registrado en este conteo.`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Si escaneas de todos modos se creará una línea nueva (no se sumará la cantidad).
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDuplicateAlert(null)}
                className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => abrirPendiente(duplicateAlert)}
                className="flex-1 rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white"
              >
                Escanear de todos modos
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-lg space-y-3 px-4 py-3">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            {registros.length} {registros.length === 1 ? "registro" : "registros"}
          </span>
          {(registros.length > 0 || estado === "COMPLETADA") && (
            <button
              type="button"
              onClick={descargarExcel}
              disabled={exportando}
              className="text-green-700 disabled:opacity-60"
            >
              {exportando ? "Generando…" : "Excel"}
            </button>
          )}
        </div>

        {soloLectura && estado !== "COMPLETADA" && (
          <p className="text-xs text-slate-500">Solo lectura</p>
        )}

        {!bloqueado && estado === "PENDIENTE" && puedeGestionar && (
          <button
            type="button"
            onClick={iniciarToma}
            disabled={completando}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {completando ? "Iniciando…" : "Iniciar toma"}
          </button>
        )}

        {!bloqueado && estado === "PAUSADA" && puedeGestionar && (
          <button
            type="button"
            onClick={iniciarToma}
            disabled={completando}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {completando ? "Reanudando…" : "Reanudar toma"}
          </button>
        )}

        {puedeEscanear && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Escanear código
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="Código manual"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") procesarCodigo(codigoManual);
                }}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600"
              />
              <button
                type="button"
                onClick={() => procesarCodigo(codigoManual)}
                disabled={loading || !codigoManual.trim()}
                className="shrink-0 rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            {pending.type === "catalogado" ? (
              <>
                <p className="font-medium text-slate-900">{pending.producto.descripcion}</p>
                <p className="text-xs text-slate-500">
                  {pending.producto.codigoBarras} · {pending.producto.unidadMedida}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-amber-700">No catalogado · {pending.codigo}</p>
                <input
                  type="text"
                  value={descripcionLibre}
                  onChange={(e) => setDescripcionLibre(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Descripción"
                  autoFocus
                />
              </>
            )}

            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0.001"
                step="any"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-base font-semibold"
                aria-label="Cantidad"
              />
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarConteo}
                disabled={loading}
                className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "…" : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {registros.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Sin registros aún</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg bg-white ring-1 ring-slate-200">
            {registros.map((linea, index) => renderLinea(linea, index))}
          </ul>
        )}
      </div>

      {!bloqueado && estado === "EN_PROGRESO" && puedeGestionar && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-4 py-2">
          <div className="mx-auto flex max-w-lg justify-center gap-4 text-sm">
            <button
              type="button"
              onClick={pausarToma}
              disabled={completando}
              className="text-amber-700 disabled:opacity-50"
            >
              Pausar
            </button>
            <button
              type="button"
              onClick={finalizarToma}
              disabled={completando}
              className="text-green-700 disabled:opacity-50"
            >
              Finalizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
