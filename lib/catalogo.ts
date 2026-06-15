import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";

export const productoInclude = {
  unidadMedida: { select: { id: true, nombre: true, abreviatura: true } },
  categoria: { select: { id: true, nombre: true } },
} as const;

export function serializeCategoria(c: { id: string; nombre: string; activo: boolean }) {
  return { id: c.id, nombre: c.nombre, activo: c.activo };
}

export function serializeCategoriaDetalle(
  c: { id: string; nombre: string; activo: boolean },
  productosCount: number
) {
  return { ...serializeCategoria(c), productosCount };
}

export function serializeUnidadMedida(u: {
  id: string;
  nombre: string;
  abreviatura: string;
  activo: boolean;
}) {
  return {
    id: u.id,
    nombre: u.nombre,
    abreviatura: u.abreviatura,
    activo: u.activo,
  };
}

export function serializeUnidadDetalle(
  u: { id: string; nombre: string; abreviatura: string; activo: boolean },
  productosCount: number
) {
  return { ...serializeUnidadMedida(u), productosCount };
}

export async function countProductosActivosPorCategoria(categoriaId: string) {
  return prisma.producto.count({
    where: { categoriaId, activo: true },
  });
}

export async function countProductosActivosPorUnidad(unidadMedidaId: string) {
  return prisma.producto.count({
    where: { unidadMedidaId, activo: true },
  });
}

export async function findCategoriaDuplicada(nombre: string, excludeId?: string) {
  return prisma.categoria.findFirst({
    where: {
      nombre: { equals: normalizeNombre(nombre), mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function findUnidadDuplicada(abreviatura: string, excludeId?: string) {
  return prisma.unidadMedida.findFirst({
    where: {
      abreviatura: { equals: abreviatura.trim().toUpperCase(), mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export function validateCategoriaNombre(nombre: string): string | null {
  const n = normalizeNombre(nombre);
  if (!n) return "El nombre de la categoría es obligatorio";
  if (n.length > 80) return "La categoría no puede superar 80 caracteres";
  return null;
}

export function validateUnidadInput(input: {
  nombre?: string;
  abreviatura?: string;
}): { data?: { nombre: string; abreviatura: string }; error?: string } {
  const nombre = normalizeNombre(input.nombre ?? "");
  const abreviatura = (input.abreviatura ?? "").trim().toUpperCase();

  if (!nombre) return { error: "El nombre de la unidad es obligatorio" };
  if (!abreviatura) return { error: "La abreviatura es obligatoria" };
  if (abreviatura.length > 12) return { error: "La abreviatura no puede superar 12 caracteres" };
  if (!/^[A-Z0-9._-]+$/.test(abreviatura)) {
    return { error: "La abreviatura solo puede tener letras, números, punto, guión y guión bajo" };
  }

  return { data: { nombre, abreviatura } };
}

export async function findCategoriaByNombre(nombre: string) {
  return prisma.categoria.findFirst({
    where: { nombre: { equals: normalizeNombre(nombre), mode: "insensitive" } },
  });
}

export async function findUnidadByAbreviatura(abreviatura: string) {
  return prisma.unidadMedida.findFirst({
    where: { abreviatura: { equals: abreviatura.trim().toUpperCase(), mode: "insensitive" } },
  });
}

export async function resolveUnidadMedidaId(
  unidadMedidaId?: string | null,
  abreviaturaFallback?: string | null
): Promise<{ id?: string; error?: string }> {
  if (unidadMedidaId) {
    const u = await prisma.unidadMedida.findFirst({
      where: { id: unidadMedidaId, activo: true },
    });
    if (!u) return { error: "Unidad de medida no válida" };
    return { id: u.id };
  }

  const abrev = (abreviaturaFallback ?? "UN").trim().toUpperCase();
  const u = await findUnidadByAbreviatura(abrev);
  if (!u) return { error: `Unidad "${abrev}" no existe. Créala primero en el catálogo.` };
  return { id: u.id };
}

export async function resolveCategoriaId(
  categoriaId?: string | null,
  nombreFallback?: string | null
): Promise<{ id?: string | null; error?: string }> {
  if (categoriaId) {
    const c = await prisma.categoria.findFirst({
      where: { id: categoriaId, activo: true },
    });
    if (!c) return { error: "Categoría no válida" };
    return { id: c.id };
  }

  const nombre = nombreFallback?.trim();
  if (!nombre) return { id: null };

  const c = await findCategoriaByNombre(nombre);
  if (!c) return { error: `La categoría "${nombre}" no existe. Créala primero.` };
  return { id: c.id };
}
