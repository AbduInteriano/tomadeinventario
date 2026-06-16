import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";
import { productoInclude } from "@/lib/catalogo";

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
  unidadMedidaId: string;
  categoriaId?: string | null;
}

export interface ProductoResponse {
  id: string;
  codigoBarras: string;
  codigoInterno: string | null;
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
  codigoInterno: string | null;
  descripcion: string;
  unidadMedida: { id: string; nombre: string; abreviatura: string };
  categoria: { id: string; nombre: string } | null;
};

export function serializeProducto(p: ProductoWithRelations): ProductoResponse {
  return {
    id: p.id,
    codigoBarras: p.codigoBarras,
    codigoInterno: p.codigoInterno,
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
  codigoInterno: true,
  descripcion: true,
  activo: true,
  ...productoInclude,
} as const;

export function normalizeCodigoBarras(value: string): string {
  return value.trim();
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

  const codigoInterno = input.codigoInterno?.trim() || null;
  const categoriaId = input.categoriaId?.trim() || null;

  return {
    data: {
      codigoBarras,
      codigoInterno,
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
      { codigoInterno: { contains: term, mode: "insensitive" as const } },
      { descripcion: { contains: term, mode: "insensitive" as const } },
    ],
  };
}

export function productoDataChanged(
  existing: {
    codigoBarras: string;
    codigoInterno: string | null;
    descripcion: string;
    unidadMedidaId: string;
    categoriaId: string | null;
    activo: boolean;
  },
  data: ProductoInput
): boolean {
  return (
    existing.codigoBarras.toLowerCase() !== data.codigoBarras.toLowerCase() ||
    (existing.codigoInterno ?? "") !== (data.codigoInterno ?? "") ||
    existing.descripcion !== data.descripcion ||
    existing.unidadMedidaId !== data.unidadMedidaId ||
    (existing.categoriaId ?? "") !== (data.categoriaId ?? "") ||
    !existing.activo
  );
}

export async function previewImportRows(rows: unknown[][]) {
  let creados = 0;
  let modificados = 0;
  let sinCambios = 0;
  const errores: { fila: number; motivo: string }[] = [];

  const [unidadesDb, categoriasDb] = await Promise.all([
    prisma.unidadMedida.findMany({ where: { activo: true } }),
    prisma.categoria.findMany({ where: { activo: true } }),
  ]);

  const unidadMap = new Map(
    unidadesDb.map((u) => [u.abreviatura.toUpperCase(), u])
  );
  const categoriaMap = new Map(
    categoriasDb.map((c) => [normalizeNombre(c.nombre).toLowerCase(), c])
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fila = i + 2;

    const abreviatura = cellToString(row[3]) || "UN";
    const categoriaNombre = cellToString(row[4]) || null;

    const unidad = unidadMap.get(abreviatura.toUpperCase());
    if (!unidad) {
      errores.push({ fila, motivo: `Unidad "${abreviatura}" no existe` });
      continue;
    }

    let categoriaId: string | null = null;
    if (categoriaNombre) {
      const categoria = categoriaMap.get(normalizeNombre(categoriaNombre).toLowerCase());
      if (!categoria) {
        errores.push({ fila, motivo: `Categoría "${categoriaNombre}" no existe` });
        continue;
      }
      categoriaId = categoria.id;
    }

    const validated = validateProductoInput({
      codigoBarras: cellToString(row[0]),
      codigoInterno: cellToString(row[1]) || null,
      descripcion: cellToString(row[2]),
      unidadMedidaId: unidad.id,
      categoriaId,
    });

    if (validated.error || !validated.data) {
      errores.push({ fila, motivo: validated.error ?? "Datos inválidos" });
      continue;
    }

    const existing = await prisma.producto.findFirst({
      where: {
        codigoBarras: { equals: validated.data.codigoBarras, mode: "insensitive" },
      },
    });

    if (!existing) {
      creados++;
    } else if (productoDataChanged(existing, validated.data)) {
      modificados++;
    } else {
      sinCambios++;
    }
  }

  return { creados, modificados, sinCambios, errores, totalFilas: rows.length };
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
      const s = String(int);
      if (s.length <= 8) return s.padStart(8, "0");
      if (s.length < 13) return s.padStart(13, "0");
      return s;
    }
    return String(value);
  }
  return String(value).trim();
}
