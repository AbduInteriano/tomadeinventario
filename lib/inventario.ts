import { AsignacionEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ESTADOS_TOMA_ABIERTA: AsignacionEstado[] = [
  AsignacionEstado.PENDIENTE,
  AsignacionEstado.EN_PROGRESO,
  AsignacionEstado.PAUSADA,
];

export async function findTomaActivaEnArea(areaId: string) {
  return prisma.asignacionInventarioArea.findFirst({
    where: {
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

  if (asignacion.estado === AsignacionEstado.COMPLETADA) {
    return { error: "Esta toma ya fue finalizada", status: 403 as const };
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

export function parseFechaParam(value: string | null): Date | undefined {
  if (!value?.trim()) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  return new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`);
}

export function fechaToIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function hoyUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
