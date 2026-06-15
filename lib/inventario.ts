import { InventarioEstado, AsignacionEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getInventarioActivo() {
  return prisma.inventario.findFirst({
    where: {
      estado: { in: [InventarioEstado.ABIERTO, InventarioEstado.EN_PROCESO] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function assertAsignacionAccess(
  asignacionId: string,
  userId: string
) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
    include: {
      inventario: true,
      area: { include: { punto: true } },
    },
  });

  if (!asignacion) {
    return { error: "Asignación no encontrada", status: 404 as const };
  }

  if (!asignacion.usuarioId) {
    return { error: "Esta área no tiene tomador asignado", status: 403 as const };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a esta área", status: 403 as const };
  }

  if (asignacion.inventario.estado === InventarioEstado.CERRADO) {
    return { error: "El inventario está cerrado", status: 403 as const };
  }

  if (asignacion.estado === AsignacionEstado.COMPLETADA) {
    return { error: "Esta área ya fue completada", status: 403 as const };
  }

  return { asignacion };
}

export function decimalToNumber(value: { toNumber(): number } | number): number {
  if (typeof value === "number") return value;
  return value.toNumber();
}
