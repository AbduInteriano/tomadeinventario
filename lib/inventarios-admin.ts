import {
  AsignacionEstado,
  InventarioEstado,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function getInventarioActivoId() {
  const inv = await prisma.inventario.findFirst({
    where: {
      estado: { in: [InventarioEstado.ABIERTO, InventarioEstado.EN_PROCESO] },
    },
    select: { id: true },
  });
  return inv?.id ?? null;
}

export async function ensureAsignacionesParaAreasActivas(inventarioId: string) {
  const areasActivas = await prisma.area.findMany({
    where: { activo: true, punto: { activo: true } },
    select: { id: true },
  });

  const existentes = await prisma.asignacionInventarioArea.findMany({
    where: { inventarioId },
    select: { areaId: true },
  });

  const existenteSet = new Set(existentes.map((a) => a.areaId));
  const faltantes = areasActivas.filter((a) => !existenteSet.has(a.id));

  if (faltantes.length > 0) {
    await prisma.asignacionInventarioArea.createMany({
      data: faltantes.map((a) => ({
        inventarioId,
        areaId: a.id,
        estado: AsignacionEstado.PENDIENTE,
      })),
    });
  }
}

export async function buildInventarioDetalle(inventarioId: string) {
  await ensureAsignacionesParaAreasActivas(inventarioId);

  const inventario = await prisma.inventario.findUnique({
    where: { id: inventarioId },
    include: {
      asignaciones: {
        include: {
          area: { include: { punto: true } },
          usuario: { select: { id: true, nombre: true, email: true } },
          conteos: { select: { timestamp: true }, orderBy: { timestamp: "desc" }, take: 1 },
          noCatalogados: { select: { timestamp: true }, orderBy: { timestamp: "desc" }, take: 1 },
          _count: { select: { conteos: true } },
        },
      },
    },
  });

  if (!inventario) return null;

  const asignacionesActivas = inventario.asignaciones.filter(
    (a) => a.area.activo && a.area.punto.activo
  );

  const puntosMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      areas: Array<{
        asignacionId: string;
        areaId: string;
        areaNombre: string;
        estado: AsignacionEstado;
        usuarioId: string | null;
        usuarioNombre: string | null;
        conteosCount: number;
        ultimaActividad: string | null;
        editable: boolean;
      }>;
    }
  >();

  for (const a of asignacionesActivas) {
    const puntoId = a.area.punto.id;
    if (!puntosMap.has(puntoId)) {
      puntosMap.set(puntoId, {
        id: puntoId,
        nombre: a.area.punto.nombre,
        areas: [],
      });
    }

    const ultimoConteo = a.conteos[0]?.timestamp ?? null;
    const ultimoNoCat = a.noCatalogados[0]?.timestamp ?? null;
    let ultimaActividad: Date | null = null;
    if (ultimoConteo && ultimoNoCat) {
      ultimaActividad = ultimoConteo > ultimoNoCat ? ultimoConteo : ultimoNoCat;
    } else {
      ultimaActividad = ultimoConteo ?? ultimoNoCat;
    }

    puntosMap.get(puntoId)!.areas.push({
      asignacionId: a.id,
      areaId: a.areaId,
      areaNombre: a.area.nombre,
      estado: a.estado,
      usuarioId: a.usuarioId,
      usuarioNombre: a.usuario?.nombre ?? null,
      conteosCount: a._count.conteos,
      ultimaActividad: ultimaActividad?.toISOString() ?? null,
      editable: a.estado === AsignacionEstado.PENDIENTE,
    });
  }

  const puntos = Array.from(puntosMap.values())
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((p) => ({
      ...p,
      areas: p.areas.sort((a, b) => a.areaNombre.localeCompare(b.areaNombre)),
    }));

  const stats = {
    total: asignacionesActivas.length,
    completadas: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.COMPLETADA
    ).length,
    enProgreso: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.EN_PROGRESO
    ).length,
    pendientes: asignacionesActivas.filter(
      (a) => a.estado === AsignacionEstado.PENDIENTE
    ).length,
    sinAsignar: asignacionesActivas.filter((a) => !a.usuarioId).length,
  };

  const tomadores = await prisma.user.findMany({
    where: { role: Role.TOMADOR, activo: true },
    select: { id: true, nombre: true, email: true },
    orderBy: { nombre: "asc" },
  });

  return {
    inventario: {
      id: inventario.id,
      estado: inventario.estado,
      createdAt: inventario.createdAt.toISOString(),
    },
    stats,
    puntos,
    tomadores,
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
    areasAsignadas: inv._count.asignaciones,
    areasCompletadas: inv.asignaciones.filter(
      (a) => a.estado === AsignacionEstado.COMPLETADA
    ).length,
  };
}
