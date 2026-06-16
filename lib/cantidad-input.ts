export const CANTIDAD_MAX_DECIMALS = 3;

/** Acepta enteros o decimales con coma o punto (hasta 3 decimales). */
export const CANTIDAD_INPUT_REGEX = /^\d+([.,]\d{1,3})?$/;

export function normalizeCantidadInput(raw: string): string {
  return raw.trim().replace(",", ".");
}

export function validateCantidadInput(
  raw: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  const normalized = normalizeCantidadInput(raw);
  if (!normalized) {
    return { ok: false, error: "Ingresa una cantidad válida mayor a 0" };
  }
  if (!CANTIDAD_INPUT_REGEX.test(normalized)) {
    return {
      ok: false,
      error: "Usa un número mayor a 0 (hasta 3 decimales, ej. 0.5 o 1,25)",
    };
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) {
    return { ok: false, error: "Ingresa una cantidad válida mayor a 0" };
  }
  return { ok: true, normalized };
}
