import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSupervisorApi,
  normalizeNombre,
  validateNombre,
} from "@/lib/api-auth";
import {
  findPuntoNombreDuplicado,
  puntoTieneHistorial,
} from "@/lib/puntos";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const punto = await prisma.punto.findUnique({ where: { id: params.id } });
  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 });
  }

  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombreError = validateNombre(body.nombre ?? "");
  if (nombreError) {
    return NextResponse.json({ error: nombreError }, { status: 400 });
  }

  const nombre = normalizeNombre(body.nombre!);
  const duplicado = await findPuntoNombreDuplicado(nombre, params.id);
  if (duplicado) {
    return NextResponse.json(
      { error: "Ya existe un punto con ese nombre" },
      { status: 409 }
    );
  }

  const updated = await prisma.punto.update({
    where: { id: params.id },
    data: { nombre },
    include: {
      _count: { select: { areas: { where: { activo: true } } } },
    },
  });

  return NextResponse.json({
    id: updated.id,
    nombre: updated.nombre,
    activo: updated.activo,
    areasCount: updated._count.areas,
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const punto = await prisma.punto.findUnique({
    where: { id: params.id },
    include: { areas: { where: { activo: true } } },
  });

  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 });
  }

  const tieneHistorial = await puntoTieneHistorial(params.id);

  if (tieneHistorial) {
    await prisma.$transaction([
      prisma.area.updateMany({
        where: { puntoId: params.id, activo: true },
        data: { activo: false },
      }),
      prisma.punto.update({
        where: { id: params.id },
        data: { activo: false },
      }),
    ]);

    return NextResponse.json({
      id: params.id,
      softDeleted: true,
      message:
        "El punto fue desactivado porque tiene áreas con inventarios o conteos asociados. No aparecerá en los listados.",
    });
  }

  await prisma.punto.delete({ where: { id: params.id } });

  return NextResponse.json({
    id: params.id,
    softDeleted: false,
    message: "Punto eliminado correctamente",
  });
}
