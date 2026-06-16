import { Prisma } from "@prisma/client";
import {
  CANTIDAD_MAX_DECIMALS,
  validateCantidadInput,
} from "@/lib/cantidad-input";

export { CANTIDAD_MAX_DECIMALS, CANTIDAD_INPUT_REGEX, normalizeCantidadInput, validateCantidadInput } from "@/lib/cantidad-input";

export function parseCantidadBody(
  value: unknown
): { decimal: Prisma.Decimal; display: string } | { error: string } {
  if (typeof value === "string") {
    const parsed = validateCantidadInput(value);
    if (!parsed.ok) return { error: parsed.error };
    const decimal = new Prisma.Decimal(parsed.normalized);
    return { decimal, display: formatCantidad(decimal) };
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      return { error: "La cantidad debe ser un número mayor a 0" };
    }
    const decimal = new Prisma.Decimal(value);
    const display = formatCantidad(decimal);
    const frac = display.split(".")[1];
    if (frac && frac.length > CANTIDAD_MAX_DECIMALS) {
      return { error: `Máximo ${CANTIDAD_MAX_DECIMALS} decimales` };
    }
    return { decimal, display };
  }

  return { error: "La cantidad debe ser un número mayor a 0" };
}

export function formatCantidad(
  value: { toString(): string } | number | string
): string {
  if (typeof value === "string") {
    return new Prisma.Decimal(value).toString();
  }
  if (typeof value === "number") {
    return new Prisma.Decimal(value).toString();
  }
  return value.toString();
}
