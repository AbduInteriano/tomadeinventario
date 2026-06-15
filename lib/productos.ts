import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";

export const EXCEL_HEADERS = [
  "Código Barras",
  "Código Interno",
  "Descripción",
  "Unidad",
  "Categoría",
] as const;

export interface ProductoInput {
  codigoBarras: string;
  codigoInterno?: string | null;
  descripcion: string;
  unidadMedida: string;
  categoria?: string | null;
}

export interface ProductoResponse {
  id: string;
  codigoBarras: string;
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: string;
  categoria: string | null;
  conteosCount?: number;
}

export function serializeProducto(
  p: {
    id: string;
    codigoBarras: string;
    codigoInterno: string | null;
    descripcion: string;
    unidadMedida: string;
    categoria: string | null;
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

  const codigoInterno = input.codigoInterno?.trim() || null;
  const categoria = input.categoria?.trim() || null;

  return {
    data: {
      codigoBarras,
      codigoInterno,
      descripcion,
      unidadMedida: unidadMedida || "UN",
      categoria,
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

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text: string }).text).trim();
  }
  return String(value).trim();
}
