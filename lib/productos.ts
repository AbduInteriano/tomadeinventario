import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";
import { productoInclude } from "@/lib/catalogo";
import { stripLeadingZerosNumerico } from "@/lib/codigo";

export const EXCEL_HEADERS = [
  "Código Barras",
  "Código Artículo",
  "Descripción",
  "Unidad",
  "Categoría",
] as const;

export interface ProductoInput {
  codigoBarras: string;
  codigoArticulo?: string | null;
  descripcion: string;
  unidadMedidaId: string;
  categoriaId?: string | null;
}

export interface ProductoResponse {
  id: string;
  codigoBarras: string;
  codigoArticulo: string | null;
  descripcion: string;
  unidadMedida: string;
  unidadMedidaId: string;
  unidadMedidaNombre: string;
  categoria: string | null;
  categoriaId: string | null;
}

type ProductoWithRelations = {
  id: string;
  codigoBarras: string;
  codigoArticulo: string | null;
  descripcion: string;
  unidadMedida: { id: string; nombre: string; abreviatura: string };
  categoria: { id: string; nombre: string } | null;
};

export function serializeProducto(p: ProductoWithRelations): ProductoResponse {
  return {
    id: p.id,
    codigoBarras: p.codigoBarras,
    codigoArticulo: p.codigoArticulo,
    descripcion: p.descripcion,
    unidadMedida: p.unidadMedida.abreviatura,
    unidadMedidaId: p.unidadMedida.id,
    unidadMedidaNombre: p.unidadMedida.nombre,
    categoria: p.categoria?.nombre ?? null,
    categoriaId: p.categoria?.id ?? null,
  };
}

export const productoSelect = {
  id: true,
  codigoBarras: true,
  codigoArticulo: true,
  descripcion: true,
  activo: true,
  ...productoInclude,
} as const;

export function normalizeCodigoBarras(value: string): string {
  return stripLeadingZerosNumerico(value.trim());
}

export function normalizeCodigoArticulo(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return stripLeadingZerosNumerico(trimmed);
}

export function validateProductoInput(
  input: Partial<ProductoInput> & { unidadMedidaId?: string | null },
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

  const unidadMedidaId = input.unidadMedidaId?.trim() ?? "";
  if (!unidadMedidaId && !isUpdate) {
    return { error: "Selecciona una unidad de medida" };
  }
  if (!unidadMedidaId && isUpdate) {
    return { error: "La unidad de medida es obligatoria" };
  }

  const codigoArticulo = normalizeCodigoArticulo(input.codigoArticulo);
  const categoriaId = input.categoriaId?.trim() || null;

  return {
    data: {
      codigoBarras,
      codigoArticulo,
      descripcion,
      unidadMedidaId,
      categoriaId,
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
      { codigoArticulo: { contains: term, mode: "insensitive" as const } },
      { descripcion: { contains: term, mode: "insensitive" as const } },
    ],
  };
}

/** Búsqueda para conteo: códigos (exacto o parcial) y nombre por palabras (AND, sin distinguir mayúsculas). */
export function buildProductoConteoBuscarWhere(q: string) {
  const term = q.trim();
  if (!term) return null;

  const words = term.split(/\s+/).filter(Boolean);
  const normalized = stripLeadingZerosNumerico(term);
  const OR: Record<string, unknown>[] = [
    { codigoBarras: { equals: term, mode: "insensitive" as const } },
    { codigoArticulo: { equals: term, mode: "insensitive" as const } },
    { codigoBarras: { contains: term, mode: "insensitive" as const } },
    { codigoArticulo: { contains: term, mode: "insensitive" as const } },
  ];

  if (normalized !== term) {
    OR.push(
      { codigoBarras: { equals: normalized, mode: "insensitive" as const } },
      { codigoArticulo: { equals: normalized, mode: "insensitive" as const } }
    );
  }

  if (words.length > 0) {
    OR.push({
      AND: words.map((w) => ({
        descripcion: { contains: w, mode: "insensitive" as const },
      })),
    });
  }

  return { activo: true, OR };
}

export function productoDataChanged(
  existing: {
    codigoBarras: string;
    codigoArticulo: string | null;
    descripcion: string;
    unidadMedidaId: string;
    categoriaId: string | null;
    activo: boolean;
  },
  data: ProductoInput
): boolean {
  return (
    existing.codigoBarras.toLowerCase() !== data.codigoBarras.toLowerCase() ||
    (existing.codigoArticulo ?? "") !== (data.codigoArticulo ?? "") ||
    existing.descripcion !== data.descripcion ||
    existing.unidadMedidaId !== data.unidadMedidaId ||
    (existing.categoriaId ?? "") !== (data.categoriaId ?? "") ||
    !existing.activo
  );
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
  const col1 = normalizeExcelHeader(row[1]);
  const col1Ok =
    col1 === normalizeExcelHeader("Código Artículo") ||
    col1 === normalizeExcelHeader("Código Interno");
  if (!col1Ok) return false;

  const col3 = normalizeExcelHeader(row[3]);
  const col3Ok =
    col3 === normalizeExcelHeader("Unidad") ||
    col3 === normalizeExcelHeader("Unidad de medida");
  if (!col3Ok) return false;

  const col0 = normalizeExcelHeader(row[0]);
  const col2 = normalizeExcelHeader(row[2]);
  const col4 = normalizeExcelHeader(row[4]);
  if (col0 !== normalizeExcelHeader("Código Barras")) return false;
  if (col2 !== normalizeExcelHeader("Descripción")) return false;
  if (col4 !== normalizeExcelHeader("Categoría")) return false;

  return true;
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value !== null) {
    if ("text" in value && (value as { text: string }).text != null) {
      return String((value as { text: string }).text).trim();
    }
    if ("result" in value) {
      return cellToString((value as { result: unknown }).result);
    }
    if ("richText" in value && Array.isArray((value as { richText: { text: string }[] }).richText)) {
      return (value as { richText: { text: string }[] }).richText
        .map((r) => r.text)
        .join("")
        .trim();
    }
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const int = Math.trunc(value);
    if (int >= 0 && int < 1e13) {
      return String(int);
    }
    return String(value);
  }
  return String(value).trim();
}
