import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";

export const EXCEL_HEADERS = [
  "Código Barras",
  "Código Interno",
  "Descripción",
  "Unidad",
  "Categoría",
  "Stock Global",
] as const;

export interface ProductoInput {
  codigoBarras: string;
  codigoInterno?: string | null;
  descripcion: string;
  unidadMedida: string;
  categoria?: string | null;
  stockGlobal: number;
}

export interface ProductoResponse {
  id: string;
  codigoBarras: string;
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: string;
  categoria: string | null;
  stockGlobal: number;
  conteosCount?: number;
}

export function decimalToNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

export function serializeProducto(
  p: {
    id: string;
    codigoBarras: string;
    codigoInterno: string | null;
    descripcion: string;
    unidadMedida: string;
    categoria: string | null;
    stockGlobal: Prisma.Decimal;
  },
  conteosCount?: number
): ProductoResponse {
  return {
    id: p.id,
    codigoBarras: p.codigoBarras,
    codigoInterno: p.codigoInterno,
    descripcion: p.descripcion,
    unidadMedida: p.unidadMedida,
    categoria: p.categoria,
    stockGlobal: decimalToNumber(p.stockGlobal),
    ...(conteosCount !== undefined ? { conteosCount } : {}),
  };
}

export function normalizeCodigoBarras(value: string): string {
  return value.trim();
}

export function validateProductoInput(
  input: Partial<ProductoInput>,
  isUpdate = false
): { data?: ProductoInput; error?: string } {
  const codigoBarras = normalizeCodigoBarras(input.codigoBarras ?? "");
  if (!codigoBarras) {
    return { error: "El código de barras es obligatorio" };
  }
  if (codigoBarras.length > 64) {
    return { error: "El código de barras no puede superar 64 caracteres" };
  }

  const descripcion = normalizeNombre(input.descripcion ?? "");
  if (!descripcion) {
    return { error: "La descripción es obligatoria" };
  }
  if (descripcion.length > 255) {
    return { error: "La descripción no puede superar 255 caracteres" };
  }

  const unidadMedida = normalizeNombre(input.unidadMedida ?? "");
  if (!unidadMedida && !isUpdate) {
    return { error: "La unidad de medida es obligatoria" };
  }

  const stockGlobal = input.stockGlobal ?? 0;
  if (typeof stockGlobal !== "number" || !Number.isFinite(stockGlobal) || stockGlobal < 0) {
    return { error: "El stock global debe ser un número mayor o igual a 0" };
  }

  const codigoInterno = input.codigoInterno?.trim() || null;
  const categoria = input.categoria?.trim() || null;

  return {
    data: {
      codigoBarras,
      codigoInterno,
      descripcion,
      unidadMedida: unidadMedida || "UN",
      categoria,
      stockGlobal,
    },
  };
}

export async function findProductoCodigoDuplicado(
  codigoBarras: string,
  excludeId?: string
) {
  return prisma.producto.findFirst({
    where: {
      activo: true,
      codigoBarras: { equals: codigoBarras, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function productoTieneConteos(productoId: string): Promise<boolean> {
  const count = await prisma.conteoInventario.count({ where: { productoId } });
  return count > 0;
}

export function buildProductoSearchWhere(q: string) {
  if (!q.trim()) {
    return { activo: true };
  }
  const term = q.trim();
  return {
    activo: true,
    OR: [
      { codigoBarras: { contains: term, mode: "insensitive" as const } },
      { codigoInterno: { contains: term, mode: "insensitive" as const } },
      { descripcion: { contains: term, mode: "insensitive" as const } },
    ],
  };
}

export function normalizeExcelHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function validateExcelHeaders(row: unknown[]): boolean {
  if (row.length < EXCEL_HEADERS.length) return false;
  return EXCEL_HEADERS.every(
    (expected, i) => normalizeExcelHeader(row[i]) === normalizeExcelHeader(expected)
  );
}

export function parseStockGlobal(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return 0;
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(",", "."));
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}
