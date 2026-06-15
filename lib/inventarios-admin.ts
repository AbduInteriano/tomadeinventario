import { AsignacionEstado, InventarioEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listAreasDisponiblesParaSupervisor } from "@/lib/tomas";

export async function buildInventarioDetalle(inventarioId: string) {
  const inventario = await prisma.inventario.findUnique({
    where: { id: inventarioId },
    include: {
      asignaciones: {
        include: {
          area: { include: { punto: true } },
          usuario: { select: { id: true, nombre: true, email: true } },
          _count: { select: { conteos: true } },
        },
        orderBy: [{ area: { punto: { nombre: "asc" } } }, { area: { nombre: "asc" } }],
      },
    },
  });

  if (!inventario) return null;

  const asignacionesActivas = inventario.asignaciones.filter(
    (a) => a.area.activo && a.area.punto.activo
  );

  const tomas = asignacionesActivas.map((a) => ({
    asignacionId: a.id,
    areaId: a.areaId,
    areaNombre: a.area.nombre,
    puntoId: a.area.punto.id,
    puntoNombre: a.area.punto.nombre,
    estado: a.estado,
    usuarioId: a.usuarioId,
    usuarioNombre: a.usuario?.nombre ?? null,
    conteosCount: a._count.conteos,
    ultimaActividad: a.updatedAt.toISOString(),
    editable: a.estado === AsignacionEstado.PENDIENTE,
  }));

  const puntosMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      areas: typeof tomas;
    }
  >();

  for (const t of tomas) {
    if (!puntosMap.has(t.puntoId)) {
      puntosMap.set(t.puntoId, {
        id: t.puntoId,
        nombre: t.puntoNombre,
        areas: [],
      });
    }
    puntosMap.get(t.puntoId)!.areas.push(t);
  }

  const puntos = Array.from(puntosMap.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre)
  );

  const stats = {
    total: asignacionesActivas.length,
    completadas: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.COMPLETADA
    ).length,
    enProgreso: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.EN_PROGRESO
    ).length,
    pausadas: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.PAUSADA
    ).length,
    pendientes: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.PENDIENTE
    ).length,
    sinAsignar: asignacionesActivas.filter((a) => !a.usuarioId).length,
  };

  const usuariosAsignables = await prisma.user.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, email: true, role: true },
    orderBy: { nombre: "asc" },
  });

  const areasDisponibles =
    inventario.estado !== InventarioEstado.CERRADO
      ? await listAreasDisponiblesParaSupervisor(inventarioId)
      : [];

  return {
    inventario: {
      id: inventario.id,
      estado: inventario.estado,
      createdAt: inventario.createdAt.toISOString(),
    },
    stats,
    tomas,
    puntos,
    areasDisponibles,
    usuariosAsignables,
  };
}

export function serializeInventarioListItem(
  inv: {
    id: string;
    estado: InventarioEstado;
    createdAt: Date;
    _count: { asignaciones: number };
    asignaciones: { estado: AsignacionEstado }[];
  }
) {
  return {
    id: inv.id,
    estado: inv.estado,
    createdAt: inv.createdAt.toISOString(),
    tomasTotal: inv._count.asignaciones,
    tomasFinalizadas: inv.asignaciones.filter(
      (a) => a.estado === AsignacionEstado.COMPLETADA
    ).length,
  };
}
