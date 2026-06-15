import { AsignacionEstado, InventarioEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ESTADOS_TOMA_ABIERTA: AsignacionEstado[] = [
  AsignacionEstado.PENDIENTE,
  AsignacionEstado.EN_PROGRESO,
  AsignacionEstado.PAUSADA,
];

export async function getInventarioActivo() {
  return prisma.inventario.findFirst({
    where: { estado: { in: [InventarioEstado.ABIERTO, InventarioEstado.EN_PROCESO] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getInventariosAbiertos() {
  return prisma.inventario.findMany({
    where: { estado: { in: [InventarioEstado.ABIERTO, InventarioEstado.EN_PROCESO] } },
    orderBy: { createdAt: "desc" },
  });
}

export async function findTomaActivaEnArea(inventarioId: string, areaId: string) {
  return prisma.asignacionInventarioArea.findFirst({
    where: {
      inventarioId,
      areaId,
      estado: { in: ESTADOS_TOMA_ABIERTA },
    },
  });
}

export async function assertAsignacionAccess(
  asignacionId: string,
  userId: string,
  options: { requireEnProgreso?: boolean } = {}
) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
    select: {
      id: true,
      estado: true,
      usuarioId: true,
      inventarioId: true,
      inventario: { select: { estado: true } },
      area: {
        select: {
          id: true,
          nombre: true,
          punto: { select: { nombre: true } },
        },
      },
    },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.inventario.estado === InventarioEstado.CERRADO) {
    return { error: "El ciclo de inventario está cerrado", status: 403 as const };
  }

  if (asignacion.estado === AsignacionEstado.COMPLETADA) {
    return { error: "Esta toma ya fue finalizada", status: 403 as const };
  }

  if (!asignacion.usuarioId) {
    return { error: "Esta toma no tiene usuario asignado", status: 403 as const };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "Esta toma pertenece a otro usuario", status: 403 as const };
  }

  if (options.requireEnProgreso && asignacion.estado !== AsignacionEstado.EN_PROGRESO) {
    if (asignacion.estado === AsignacionEstado.PAUSADA) {
      return { error: "La toma está pausada. Reanúdala para continuar contando.", status: 403 as const };
    }
    if (asignacion.estado === AsignacionEstado.PENDIENTE) {
      return { error: "Debes iniciar la toma antes de registrar conteos.", status: 403 as const };
    }
  }

  return { asignacion };
}

export function decimalToNumber(value: { toNumber(): number } | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}

export function puedeContar(estado: AsignacionEstado): boolean {
  return estado === AsignacionEstado.EN_PROGRESO;
}

export function puedeIniciar(estado: AsignacionEstado): boolean {
  return estado === AsignacionEstado.PENDIENTE || estado === AsignacionEstado.PAUSADA;
}
