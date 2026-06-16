import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi, normalizeNombre } from "@/lib/api-auth";
import {
  findCategoriaDuplicada,
  serializeCategoriaDetalle,
  validateCategoriaNombre,
  categoriaProductosActivosCount,
  countProductosActivosPorCategoria,
} from "@/lib/catalogo";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const categoria = await prisma.categoria.findUnique({ where: { id: params.id } });
  if (!categoria) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  let body: { nombre?: string; activo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const updateData: { nombre?: string; activo?: boolean } = {};

  if (body.nombre !== undefined) {
    const nombreError = validateCategoriaNombre(body.nombre);
    if (nombreError) {
      return NextResponse.json({ error: nombreError }, { status: 400 });
    }
    const nombre = normalizeNombre(body.nombre);
    const duplicado = await findCategoriaDuplicada(nombre, params.id);
    if (duplicado) {
      return NextResponse.json({ error: "Ya existe otra categoría con ese nombre" }, { status: 409 });
    }
    updateData.nombre = nombre;
  }

  if (body.activo !== undefined) {
    updateData.activo = body.activo;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
  }

  const updated = await prisma.categoria.update({
    where: { id: params.id },
    data: updateData,
      include: {
        _count: { select: { productos: categoriaProductosActivosCount.productos } },
      },
  });

  return NextResponse.json(
    serializeCategoriaDetalle(updated, updated._count.productos)
  );
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const activos = await countProductosActivosPorCategoria(params.id);

  const categoria = await prisma.categoria.findUnique({
    where: { id: params.id },
  });

  if (!categoria) {
    return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
  }

  if (activos > 0) {
    return NextResponse.json(
      {
        error: `No se puede eliminar: hay ${activos} producto(s) activo(s) en esta categoría. Cambia la categoría de esos productos primero.`,
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.producto.updateMany({
      where: { categoriaId: params.id, activo: false },
      data: { categoriaId: null },
    }),
    prisma.categoria.delete({ where: { id: params.id } }),
  ]);

  return NextResponse.json({
    id: params.id,
    message: "Categoría eliminada correctamente",
  });
}
