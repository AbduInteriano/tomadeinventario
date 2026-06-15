import { AsignacionEstado, InventarioEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ESTADOS_TOMA_ABIERTA, findTomaActivaEnArea } from "@/lib/inventario";

export async function crearToma(params: {
  inventarioId: string;
  areaId: string;
  usuarioId: string | null;
  estado?: AsignacionEstado;
}) {
  const inventario = await prisma.inventario.findUnique({
    where: { id: params.inventarioId },
  });

  if (!inventario || inventario.estado === InventarioEstado.CERRADO) {
    return { error: "El ciclo de inventario no está disponible" };
  }

  const area = await prisma.area.findFirst({
    where: { id: params.areaId, activo: true, punto: { activo: true } },
  });

  if (!area) {
    return { error: "Área no encontrada o inactiva" };
  }

  const existente = await findTomaActivaEnArea(params.inventarioId, params.areaId);
  if (existente) {
    return {
      error: "Ya existe una toma activa para esta área en este ciclo",
      asignacionId: existente.id,
    };
  }

  if (params.usuarioId) {
    const usuario = await prisma.user.findFirst({
      where: { id: params.usuarioId, activo: true },
    });
    if (!usuario) {
      return { error: "Usuario no válido o inactivo" };
    }
  }

  const toma = await prisma.asignacionInventarioArea.create({
    data: {
      inventarioId: params.inventarioId,
      areaId: params.areaId,
      usuarioId: params.usuarioId,
      estado: params.estado ?? AsignacionEstado.PENDIENTE,
    },
    include: {
      area: { include: { punto: true } },
      usuario: { select: { id: true, nombre: true } },
    },
  });

  return { toma };
}

export async function iniciarToma(asignacionId: string, userId: string, isSupervisor: boolean) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
    include: { inventario: true },
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

  if (
    asignacion.estado !== AsignacionEstado.PENDIENTE &&
    asignacion.estado !== AsignacionEstado.PAUSADA
  ) {
    return { error: "La toma ya está en progreso", status: 400 as const };
  }

  if (asignacion.usuarioId && asignacion.usuarioId !== userId) {
    return { error: "Esta toma está asignada a otro usuario", status: 403 as const };
  }

  if (!asignacion.usuarioId) {
    if (!isSupervisor) {
      return { error: "Esta toma no tiene usuario asignado", status: 403 as const };
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.asignacionInventarioArea.update({
      where: { id: asignacionId },
      data: {
        estado: AsignacionEstado.EN_PROGRESO,
        usuarioId: asignacion.usuarioId ?? userId,
      },
    });

    if (asignacion.inventario.estado === InventarioEstado.ABIERTO) {
      await tx.inventario.update({
        where: { id: asignacion.inventarioId },
        data: { estado: InventarioEstado.EN_PROCESO },
      });
    }

    return result;
  });

  return { toma: updated };
}

export async function pausarToma(asignacionId: string, userId: string) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
    include: { inventario: true },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a esta toma", status: 403 as const };
  }

  if (asignacion.estado !== AsignacionEstado.EN_PROGRESO) {
    return { error: "Solo puedes pausar tomas en progreso", status: 400 as const };
  }

  const updated = await prisma.asignacionInventarioArea.update({
    where: { id: asignacionId },
    data: { estado: AsignacionEstado.PAUSADA },
  });

  return { toma: updated };
}

export async function finalizarToma(asignacionId: string, userId: string) {
  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: asignacionId },
    include: { inventario: true },
  });

  if (!asignacion) {
    return { error: "Toma no encontrada", status: 404 as const };
  }

  if (asignacion.usuarioId !== userId) {
    return { error: "No tienes acceso a esta toma", status: 403 as const };
  }

  if (
    asignacion.estado !== AsignacionEstado.EN_PROGRESO &&
    asignacion.estado !== AsignacionEstado.PAUSADA
  ) {
    return { error: "La toma debe estar en progreso o pausada para finalizar", status: 400 as const };
  }

  const updated = await prisma.asignacionInventarioArea.update({
    where: { id: asignacionId },
    data: { estado: AsignacionEstado.COMPLETADA },
  });

  return { toma: updated };
}

export async function listTomadorTomorias(userId: string) {
  return prisma.asignacionInventarioArea.findMany({
    where: {
      usuarioId: userId,
      estado: { in: ESTADOS_TOMA_ABIERTA },
      inventario: {
        estado: { in: [InventarioEstado.ABIERTO, InventarioEstado.EN_PROCESO] },
      },
    },
    select: {
      id: true,
      estado: true,
      inventarioId: true,
      area: {
        select: {
          id: true,
          nombre: true,
          punto: { select: { nombre: true } },
        },
      },
      _count: { select: { conteos: true } },
    },
    orderBy: [{ estado: "asc" }, { updatedAt: "desc" }],
  });
}

export async function listAreasDisponiblesParaSupervisor(inventarioId: string) {
  const [areas, tomoriasActivas] = await Promise.all([
    prisma.area.findMany({
      where: { activo: true, punto: { activo: true } },
      select: {
        id: true,
        nombre: true,
        punto: { select: { nombre: true } },
      },
      orderBy: [{ punto: { nombre: "asc" } }, { nombre: "asc" }],
    }),
    prisma.asignacionInventarioArea.findMany({
      where: {
        inventarioId,
        estado: { in: ESTADOS_TOMA_ABIERTA },
      },
      select: { areaId: true },
    }),
  ]);

  const ocupadas = new Set(tomoriasActivas.map((t) => t.areaId));

  return areas.map((a) => ({
    id: a.id,
    nombre: a.nombre,
    punto: a.punto.nombre,
    tieneTomaActiva: ocupadas.has(a.id),
  }));
}

export async function getOrCreateInventarioDefault(supervisorId: string) {
  let inv = await prisma.inventario.findFirst({
    where: { estado: { in: [InventarioEstado.ABIERTO, InventarioEstado.EN_PROCESO] } },
    orderBy: { createdAt: "desc" },
  });

  if (!inv) {
    inv = await prisma.inventario.create({
      data: {
        estado: InventarioEstado.ABIERTO,
        creadoPorId: supervisorId,
      },
    });
  }

  return inv;
}
