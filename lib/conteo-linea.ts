import { AsignacionEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function assertLineaConteoEditable(
  conteoId: string,
  userId: string
): Promise<
  | { error: string; status: 403 | 404 | 400 }
  | { conteo: { id: string; asignacionId: string } }
> {
  const conteo = await prisma.conteoInventario.findUnique({
    where: { id: conteoId },
    select: {
      id: true,
      asignacionId: true,
      asignacion: { select: { estado: true, usuarioId: true } },
    },
  });

  if (!conteo) {
    return { error: "Registro no encontrado", status: 404 };
  }
  if (conteo.asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a este conteo", status: 403 };
  }
  if (conteo.asignacion.estado === AsignacionEstado.COMPLETADA) {
    return { error: "La toma ya fue finalizada", status: 403 };
  }
  if (conteo.asignacion.estado !== AsignacionEstado.EN_PROGRESO) {
    return { error: "Solo puedes editar conteos con la toma en progreso", status: 400 };
  }

  return { conteo: { id: conteo.id, asignacionId: conteo.asignacionId } };
}

export async function assertLineaNoCatalogadoEditable(
  registroId: string,
  userId: string
): Promise<
  | { error: string; status: 403 | 404 | 400 }
  | { registro: { id: string; asignacionId: string } }
> {
  const registro = await prisma.productoNoCatalogado.findUnique({
    where: { id: registroId },
    select: {
      id: true,
      asignacionId: true,
      asignacion: { select: { estado: true, usuarioId: true } },
    },
  });

  if (!registro) {
    return { error: "Registro no encontrado", status: 404 };
  }
  if (registro.asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a este conteo", status: 403 };
  }
  if (registro.asignacion.estado === AsignacionEstado.COMPLETADA) {
    return { error: "La toma ya fue finalizada", status: 403 };
  }
  if (registro.asignacion.estado !== AsignacionEstado.EN_PROGRESO) {
    return { error: "Solo puedes editar conteos con la toma en progreso", status: 400 };
  }

  return { registro: { id: registro.id, asignacionId: registro.asignacionId } };
}
