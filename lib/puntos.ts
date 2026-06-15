import { prisma } from "@/lib/prisma";

export async function puntoTieneHistorial(puntoId: string): Promise<boolean> {
  const count = await prisma.asignacionInventarioArea.count({
    where: { area: { puntoId } },
  });
  return count > 0;
}

export async function areaTieneHistorial(areaId: string): Promise<boolean> {
  const asignaciones = await prisma.asignacionInventarioArea.count({
    where: { areaId },
  });
  if (asignaciones > 0) return true;

  const conteos = await prisma.conteoInventario.count({
    where: { asignacion: { areaId } },
  });
  return conteos > 0;
}

export async function findPuntoNombreDuplicado(
  nombre: string,
  excludeId?: string
) {
  return prisma.punto.findFirst({
    where: {
      activo: true,
      nombre: { equals: nombre, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function findAreaNombreDuplicado(
  puntoId: string,
  nombre: string,
  excludeId?: string
) {
  return prisma.area.findFirst({
    where: {
      activo: true,
      puntoId,
      nombre: { equals: nombre, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}
