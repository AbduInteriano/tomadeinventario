import { AsignacionEstado, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ESTADOS_TOMA_ABIERTA,
  hoyApp,
  parseFechaParam,
  fechaToIsoDate,
} from "@/lib/inventario";

const tomaSelectFields = {
  id: true,
  estado: true,
  fecha: true,
  archivada: true,
  usuarioId: true,
  creadoPorId: true,
  usuario: { select: { id: true, nombre: true } },
  area: {
    select: {
      id: true,
      nombre: true,
      punto: { select: { id: true, nombre: true } },
    },
  },
  _count: { select: { conteos: true } },
} as const;

async function liberarTomaPendienteVacia(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  activa: {
    id: string;
    estado: AsignacionEstado;
    fecha: Date;
    _count: { conteos: number; noCatalogados: number };
  },
  nuevaFecha: Date
): Promise<boolean> {
  const registros = activa._count.conteos + activa._count.noCatalogados;
  if (
    activa.estado === AsignacionEstado.PENDIENTE &&
    registros === 0 &&
    activa.fecha.getTime() < nuevaFecha.getTime()
  ) {
    await tx.asignacionInventarioArea.update({
      where: { id: activa.id },
      data: { estado: AsignacionEstado.COMPLETADA },
    });
    return true;
  }
  return false;
}

export async function canViewAsignacion(
  asignacionId: string,
  userId: string,
  role: Role
) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
    select: {
      id: true,
      estado: true,
      usuarioId: true,
    },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (role === Role.SUPERVISOR || role === Role.ADMIN_TECNOLOGIA) {
    return { asignacion, canWrite: asignacion.usuarioId === userId };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "Esta toma pertenece a otro usuario", status: 403 as const };
  }

  return { asignacion, canWrite: true };
}

export async function crearTomas(params: {
  usuarioId: string;
  areaIds: string[];
  creadoPorId: string;
  fecha?: Date;
}) {
  const fecha = params.fecha ?? hoyApp();

  if (params.areaIds.length === 0) {
    return { error: "Selecciona al menos un área" };
  }

  const usuario = await prisma.user.findFirst({
    where: { id: params.usuarioId, activo: true },
  });
  if (!usuario) {
    return { error: "Usuario no válido o inactivo" };
  }

  const areas = await prisma.area.findMany({
    where: {
      id: { in: params.areaIds },
      activo: true,
      punto: { activo: true },
    },
    include: { punto: { select: { nombre: true } } },
  });

  if (areas.length !== params.areaIds.length) {
    return { error: "Una o más áreas no son válidas o están inactivas" };
  }

  const warnings: string[] = [];
  const creadas: string[] = [];
  const omitidas: string[] = [];

  for (const area of areas) {
    try {
      const tomaId = await prisma.$transaction(async (tx) => {
        const activa = await tx.asignacionInventarioArea.findFirst({
          where: {
            areaId: area.id,
            estado: { in: ESTADOS_TOMA_ABIERTA },
            archivada: false,
          },
          include: {
            _count: { select: { conteos: true, noCatalogados: true } },
          },
        });

        if (activa) {
          const liberada = await liberarTomaPendienteVacia(tx, activa, fecha);
          if (!liberada) {
            const fechaBloqueo = fechaToIsoDate(activa.fecha);
            throw new Error(
              `BLOQUEADA:${fechaBloqueo}:${activa.estado}`
            );
          }
        }

        const toma = await tx.asignacionInventarioArea.create({
          data: {
            areaId: area.id,
            usuarioId: params.usuarioId,
            creadoPorId: params.creadoPorId,
            fecha,
            estado: AsignacionEstado.PENDIENTE,
          },
        });
        return toma.id;
      });
      creadas.push(tomaId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.startsWith("BLOQUEADA:")) {
        const [, fechaBloqueo, estado] = msg.split(":");
        omitidas.push(
          `${area.punto.nombre} · ${area.nombre} (toma ${estado} del ${fechaBloqueo})`
        );
      } else {
        throw err;
      }
    }
  }

  if (creadas.length === 0) {
    return {
      error:
        "Ninguna área disponible. Finaliza o archiva las tomas activas antes de crear nuevas.",
      omitidas,
    };
  }

  if (omitidas.length > 0) {
    warnings.push(
      `${omitidas.length} área(s) omitida(s): ${omitidas.join("; ")}`
    );
  }

  return { creadas, warnings, fecha: fechaToIsoDate(fecha) };
}

export async function iniciarToma(asignacionId: string, userId: string, isSupervisor: boolean) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.estado === AsignacionEstado.COMPLETADA) {
    return { error: "Esta toma ya fue finalizada", status: 403 as const };
  }

  if (
    asignacion.estado !== AsignacionEstado.PENDIENTE &&
    asignacion.estado !== AsignacionEstado.PAUSADA
  ) {
    return { error: "La toma ya está en progreso", status: 400 as const };
  }

  if (asignacion.usuarioId !== userId && !isSupervisor) {
    return { error: "Esta toma está asignada a otro usuario", status: 403 as const };
  }

  if (isSupervisor && asignacion.usuarioId !== userId) {
    return { error: "Solo el tomador asignado puede iniciar esta toma", status: 403 as const };
  }

  const result = await prisma.asignacionInventarioArea.updateMany({
    where: {
      id: asignacionId,
      estado: { in: [AsignacionEstado.PENDIENTE, AsignacionEstado.PAUSADA] },
    },
    data: { estado: AsignacionEstado.EN_PROGRESO },
  });

  if (result.count === 0) {
    return { error: "No se pudo iniciar la toma (estado cambió)", status: 409 as const };
  }

  const updated = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  return { toma: updated! };
}

export async function pausarToma(asignacionId: string, userId: string) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a esta toma", status: 403 as const };
  }

  const result = await prisma.asignacionInventarioArea.updateMany({
    where: {
      id: asignacionId,
      estado: AsignacionEstado.EN_PROGRESO,
      usuarioId: userId,
    },
    data: { estado: AsignacionEstado.PAUSADA },
  });

  if (result.count === 0) {
    return { error: "Solo puedes pausar tomas en progreso", status: 400 as const };
  }

  const updated = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  return { toma: updated! };
}

export async function finalizarToma(asignacionId: string, userId: string) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a esta toma", status: 403 as const };
  }

  const result = await prisma.asignacionInventarioArea.updateMany({
    where: {
      id: asignacionId,
      estado: { in: [AsignacionEstado.EN_PROGRESO, AsignacionEstado.PAUSADA] },
      usuarioId: userId,
    },
    data: { estado: AsignacionEstado.COMPLETADA },
  });

  if (result.count === 0) {
    if (asignacion.estado === AsignacionEstado.PENDIENTE) {
      return {
        error: "Debes iniciar la toma antes de finalizarla",
        status: 400 as const,
      };
    }
    return { error: "Esta toma ya fue finalizada", status: 400 as const };
  }

  const updated = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  return { toma: updated! };
}

function buildListWhere(fecha?: Date, includeArchivadas = false) {
  return {
    ...(fecha ? { fecha } : {}),
    ...(!includeArchivadas ? { archivada: false } : {}),
  };
}

export async function listTomadorTomorias(
  userId: string,
  fecha?: Date,
  includeArchivadas = false
) {
  return prisma.asignacionInventarioArea.findMany({
    where: {
      usuarioId: userId,
      ...buildListWhere(fecha, includeArchivadas),
    },
    select: tomaSelectFields,
    orderBy: [{ estado: "asc" }, { updatedAt: "desc" }],
  });
}

export async function listSupervisorTomorias(fecha?: Date, includeArchivadas = false) {
  return prisma.asignacionInventarioArea.findMany({
    where: buildListWhere(fecha, includeArchivadas),
    select: tomaSelectFields,
    orderBy: [{ fecha: "desc" }, { updatedAt: "desc" }],
  });
}

export async function listFechasConTomas(includeArchivadas = false) {
  const rows = await prisma.asignacionInventarioArea.findMany({
    where: includeArchivadas ? {} : { archivada: false },
    select: { fecha: true },
    distinct: ["fecha"],
    orderBy: { fecha: "desc" },
    take: 60,
  });
  return rows.map((r) => fechaToIsoDate(r.fecha));
}

export async function archivarToma(asignacionId: string) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.estado !== AsignacionEstado.COMPLETADA) {
    return { error: "Solo se pueden archivar tomas finalizadas", status: 400 as const };
  }

  if (asignacion.archivada) {
    return { error: "Esta toma ya está archivada", status: 400 as const };
  }

  const updated = await prisma.asignacionInventarioArea.update({
    where: { id: asignacionId },
    data: { archivada: true },
  });

  return { toma: updated };
}

export function serializeTomaConteo(
  toma: {
    id: string;
    estado: AsignacionEstado;
    fecha: Date;
    archivada: boolean;
    usuarioId: string;
    usuario: { id: string; nombre: string };
    area: {
      id: string;
      nombre: string;
      punto: { id: string; nombre: string };
    };
    _count: { conteos: number };
  },
  viewerUserId: string
) {
  return {
    id: toma.id,
    estado: toma.estado,
    fecha: fechaToIsoDate(toma.fecha),
    archivada: toma.archivada,
    usuarioId: toma.usuarioId,
    usuarioNombre: toma.usuario.nombre,
    esPropia: toma.usuarioId === viewerUserId,
    area: {
      id: toma.area.id,
      nombre: toma.area.nombre,
      punto: toma.area.punto.nombre,
      puntoId: toma.area.punto.id,
    },
    conteosCount: toma._count.conteos,
  };
}

export async function getAreasParaAsignar() {
  const areas = await prisma.area.findMany({
    where: { activo: true, punto: { activo: true } },
    select: {
      id: true,
      nombre: true,
      punto: { select: { id: true, nombre: true } },
    },
    orderBy: [{ punto: { nombre: "asc" } }, { nombre: "asc" }],
  });

  const activas = await prisma.asignacionInventarioArea.findMany({
    where: { estado: { in: ESTADOS_TOMA_ABIERTA }, archivada: false },
    select: { areaId: true, fecha: true, estado: true },
  });
  const ocupadas = new Map(
    activas.map((t) => [t.areaId, { fecha: fechaToIsoDate(t.fecha), estado: t.estado }])
  );

  const puntosMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      areas: {
        id: string;
        nombre: string;
        disponible: boolean;
        bloqueo?: { fecha: string; estado: string };
      }[];
    }
  >();

  for (const a of areas) {
    if (!puntosMap.has(a.punto.id)) {
      puntosMap.set(a.punto.id, {
        id: a.punto.id,
        nombre: a.punto.nombre,
        areas: [],
      });
    }
    const bloqueo = ocupadas.get(a.id);
    puntosMap.get(a.punto.id)!.areas.push({
      id: a.id,
      nombre: a.nombre,
      disponible: !bloqueo,
      ...(bloqueo ? { bloqueo } : {}),
    });
  }

  return Array.from(puntosMap.values());
}

export { parseFechaParam, hoyApp as hoyUtc, fechaToIsoDate };
