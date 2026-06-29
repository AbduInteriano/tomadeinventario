import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCantidad, parseCantidadBody } from "@/lib/cantidad";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { assertLineaConteoEditable } from "@/lib/conteo-linea";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  let body: { cantidad?: string | number; comentario?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { cantidad, comentario } = body;
  if (cantidad == null && comentario === undefined) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const data: { cantidadContada?: Prisma.Decimal; comentario?: string | null } = {};

  if (cantidad != null) {
    const parsedCantidad = parseCantidadBody(cantidad);
    if ("error" in parsedCantidad) {
      return NextResponse.json({ error: parsedCantidad.error }, { status: 400 });
    }
    data.cantidadContada = parsedCantidad.decimal;
  }

  if (comentario !== undefined) {
    data.comentario = comentario?.trim() || null;
  }

  const access = await assertLineaConteoEditable(params.id, auth.session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const updated = await prisma.conteoInventario.update({
      where: { id: params.id },
      data,
      select: {
        id: true,
        productoId: true,
        cantidadContada: true,
        comentario: true,
        timestamp: true,
        producto: {
          select: {
            codigoBarras: true,
            descripcion: true,
            unidadMedida: { select: { abreviatura: true } },
          },
        },
      },
    });

    return NextResponse.json({
      id: updated.id,
      productoId: updated.productoId,
      codigoBarras: updated.producto.codigoBarras,
      descripcion: updated.producto.descripcion,
      unidadMedida: updated.producto.unidadMedida.abreviatura,
      cantidadContada: formatCantidad(updated.cantidadContada),
      comentario: updated.comentario,
      timestamp: updated.timestamp,
    });
  } catch (err) {
    console.error("[conteos PATCH]", err);
    return NextResponse.json({ error: "Error al actualizar el conteo" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  const access = await assertLineaConteoEditable(params.id, auth.session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    await prisma.conteoInventario.delete({ where: { id: params.id } });
    return NextResponse.json({ id: params.id, deleted: true });
  } catch (err) {
    console.error("[conteos DELETE]", err);
    return NextResponse.json({ error: "Error al eliminar el registro" }, { status: 500 });
  }
}
