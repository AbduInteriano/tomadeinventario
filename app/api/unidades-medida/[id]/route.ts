import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi, normalizeNombre } from "@/lib/api-auth";
import {
  findUnidadDuplicada,
  serializeUnidadDetalle,
  validateUnidadInput,
} from "@/lib/catalogo";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const unidad = await prisma.unidadMedida.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { productos: { where: { activo: true } } } },
    },
  });

  if (!unidad) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  let body: { nombre?: string; abreviatura?: string; activo?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const updateData: { nombre?: string; abreviatura?: string; activo?: boolean } = {};
  const enUso = unidad._count.productos > 0;

  if (body.nombre !== undefined) {
    const nombre = normalizeNombre(body.nombre);
    if (!nombre) {
      return NextResponse.json({ error: "El nombre de la unidad es obligatorio" }, { status: 400 });
    }
    updateData.nombre = nombre;
  }

  if (body.abreviatura !== undefined) {
    if (enUso) {
      return NextResponse.json(
        { error: "No se puede cambiar la abreviatura: hay productos que la usan" },
        { status: 400 }
      );
    }
    const validated = validateUnidadInput({
      nombre: body.nombre ?? unidad.nombre,
      abreviatura: body.abreviatura,
    });
    if (validated.error || !validated.data) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const duplicado = await findUnidadDuplicada(validated.data.abreviatura, params.id);
    if (duplicado) {
      return NextResponse.json({ error: "Ya existe otra unidad con esa abreviatura" }, { status: 409 });
    }
    updateData.abreviatura = validated.data.abreviatura;
  }

  if (body.activo !== undefined) {
    if (body.activo === false && enUso) {
      return NextResponse.json(
        {
          error: `No se puede desactivar: ${unidad._count.productos} producto(s) usan esta unidad`,
        },
        { status: 400 }
      );
    }
    updateData.activo = body.activo;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
  }

  const updated = await prisma.unidadMedida.update({
    where: { id: params.id },
    data: updateData,
    include: {
      _count: { select: { productos: { where: { activo: true } } } },
    },
  });

  return NextResponse.json(
    serializeUnidadDetalle(updated, updated._count.productos)
  );
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const unidad = await prisma.unidadMedida.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { productos: { where: { activo: true } } } },
    },
  });

  if (!unidad) {
    return NextResponse.json({ error: "Unidad no encontrada" }, { status: 404 });
  }

  if (unidad._count.productos > 0) {
    return NextResponse.json(
      {
        error: `No se puede eliminar: ${unidad._count.productos} producto(s) usan esta unidad`,
      },
      { status: 400 }
    );
  }

  await prisma.unidadMedida.delete({ where: { id: params.id } });

  return NextResponse.json({
    id: params.id,
    message: "Unidad eliminada correctamente",
  });
}
