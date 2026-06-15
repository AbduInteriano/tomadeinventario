import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSupervisorApi,
  normalizeNombre,
  validateNombre,
} from "@/lib/api-auth";
import { findAreaNombreDuplicado, areaTieneHistorial } from "@/lib/puntos";

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const punto = await prisma.punto.findUnique({
    where: { id: params.id },
  });

  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 });
  }

  const areas = await prisma.area.findMany({
    where: { puntoId: params.id, activo: true },
    include: {
      _count: { select: { asignaciones: true } },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json({
    punto: { id: punto.id, nombre: punto.nombre },
    areas: areas.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      activo: a.activo,
      asignacionesCount: a._count.asignaciones,
    })),
  });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
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
  const duplicado = await findAreaNombreDuplicado(params.id, nombre);
  if (duplicado) {
    return NextResponse.json(
      { error: "Ya existe un área con ese nombre en este punto" },
      { status: 409 }
    );
  }

  const area = await prisma.area.create({
    data: { nombre, puntoId: params.id },
  });

  return NextResponse.json(
    {
      id: area.id,
      nombre: area.nombre,
      activo: area.activo,
      asignacionesCount: 0,
    },
    { status: 201 }
  );
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const punto = await prisma.punto.findUnique({ where: { id: params.id } });
  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 });
  }

  let body: { areaId?: string; nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.areaId) {
    return NextResponse.json({ error: "areaId es requerido" }, { status: 400 });
  }

  const area = await prisma.area.findFirst({
    where: { id: body.areaId, puntoId: params.id, activo: true },
  });

  if (!area) {
    return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
  }

  const nombreError = validateNombre(body.nombre ?? "");
  if (nombreError) {
    return NextResponse.json({ error: nombreError }, { status: 400 });
  }

  const nombre = normalizeNombre(body.nombre!);
  const duplicado = await findAreaNombreDuplicado(params.id, nombre, body.areaId);
  if (duplicado) {
    return NextResponse.json(
      { error: "Ya existe un área con ese nombre en este punto" },
      { status: 409 }
    );
  }

  const updated = await prisma.area.update({
    where: { id: body.areaId },
    data: { nombre },
    include: { _count: { select: { asignaciones: true } } },
  });

  return NextResponse.json({
    id: updated.id,
    nombre: updated.nombre,
    activo: updated.activo,
    asignacionesCount: updated._count.asignaciones,
  });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const punto = await prisma.punto.findUnique({ where: { id: params.id } });
  if (!punto || !punto.activo) {
    return NextResponse.json({ error: "Punto no encontrado" }, { status: 404 });
  }

  let body: { areaId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.areaId) {
    return NextResponse.json({ error: "areaId es requerido" }, { status: 400 });
  }

  const area = await prisma.area.findFirst({
    where: { id: body.areaId, puntoId: params.id, activo: true },
  });

  if (!area) {
    return NextResponse.json({ error: "Área no encontrada" }, { status: 404 });
  }

  const tieneHistorial = await areaTieneHistorial(body.areaId);

  if (tieneHistorial) {
    await prisma.area.update({
      where: { id: body.areaId },
      data: { activo: false },
    });

    return NextResponse.json({
      id: body.areaId,
      softDeleted: true,
      message:
        "El área fue desactivada porque tiene asignaciones o conteos de inventario. No aparecerá en los listados.",
    });
  }

  await prisma.area.delete({ where: { id: body.areaId } });

  return NextResponse.json({
    id: body.areaId,
    softDeleted: false,
    message: "Área eliminada correctamente",
  });
}
