import { NextRequest, NextResponse } from "next/server";
import { AsignacionEstado, InventarioEstado, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { buildInventarioDetalle } from "@/lib/inventarios-admin";

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const detalle = await buildInventarioDetalle(params.id);
  if (!detalle) {
    return NextResponse.json({ error: "Inventario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    asignaciones: detalle.puntos.flatMap((p) =>
      p.areas.map((a) => ({
        ...a,
        puntoNombre: p.nombre,
      }))
    ),
    tomadores: detalle.tomadores,
  });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: {
    asignacionId?: string;
    usuarioId?: string | null;
    asignaciones?: { asignacionId: string; usuarioId: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const inventario = await prisma.inventario.findUnique({
    where: { id: params.id },
  });

  if (!inventario) {
    return NextResponse.json({ error: "Inventario no encontrado" }, { status: 404 });
  }

  if (inventario.estado === InventarioEstado.CERRADO) {
    return NextResponse.json(
      { error: "No se pueden modificar asignaciones de un inventario cerrado" },
      { status: 403 }
    );
  }

  const items =
    body.asignaciones ??
    (body.asignacionId
      ? [{ asignacionId: body.asignacionId, usuarioId: body.usuarioId ?? "" }]
      : []);

  if (items.length === 0) {
    return NextResponse.json(
      { error: "asignacionId y usuarioId son requeridos" },
      { status: 400 }
    );
  }

  const warnings: string[] = [];

  for (const item of items) {
    if (!item.asignacionId) {
      return NextResponse.json({ error: "asignacionId requerido" }, { status: 400 });
    }

    const asignacion = await prisma.asignacionInventarioArea.findFirst({
      where: { id: item.asignacionId, inventarioId: params.id },
      include: { _count: { select: { conteos: true } } },
    });

    if (!asignacion) {
      return NextResponse.json(
        { error: "Asignación no encontrada en este inventario" },
        { status: 404 }
      );
    }

    if (asignacion.estado !== AsignacionEstado.PENDIENTE) {
      return NextResponse.json(
        {
          error: `Solo se puede asignar en áreas pendientes (${asignacion.id})`,
        },
        { status: 400 }
      );
    }

    if (asignacion._count.conteos > 0) {
      warnings.push(
        "Esta área tiene conteos registrados; no se transferirán al nuevo tomador."
      );
    }

    if (!item.usuarioId) {
      await prisma.asignacionInventarioArea.update({
        where: { id: item.asignacionId },
        data: { usuarioId: null },
      });
      continue;
    }

    const tomador = await prisma.user.findFirst({
      where: { id: item.usuarioId, role: Role.TOMADOR, activo: true },
    });

    if (!tomador) {
      return NextResponse.json({ error: "Tomador no válido o inactivo" }, { status: 400 });
    }

    if (
      asignacion.usuarioId &&
      asignacion.usuarioId !== item.usuarioId &&
      asignacion._count.conteos > 0
    ) {
      warnings.push(
        "Los conteos existentes permanecen asociados al tomador que los registró."
      );
    }

    await prisma.asignacionInventarioArea.update({
      where: { id: item.asignacionId },
      data: { usuarioId: item.usuarioId },
    });
  }

  const detalle = await buildInventarioDetalle(params.id);

  return NextResponse.json({
    ok: true,
    warnings: Array.from(new Set(warnings)),
    ...(detalle ? { stats: detalle.stats, puntos: detalle.puntos } : {}),
  });
}
