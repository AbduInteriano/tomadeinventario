import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCantidad, parseCantidadBody } from "@/lib/cantidad";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { assertLineaNoCatalogadoEditable } from "@/lib/conteo-linea";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  let body: {
    cantidad?: string | number;
    descripcionLibre?: string;
    comentario?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const access = await assertLineaNoCatalogadoEditable(params.id, auth.session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const data: {
    cantidad?: Prisma.Decimal;
    descripcionLibre?: string;
    comentario?: string | null;
  } = {};

  if (body.cantidad != null) {
    const parsedCantidad = parseCantidadBody(body.cantidad);
    if ("error" in parsedCantidad) {
      return NextResponse.json({ error: parsedCantidad.error }, { status: 400 });
    }
    data.cantidad = parsedCantidad.decimal;
  }

  if (body.descripcionLibre != null) {
    const desc = body.descripcionLibre.trim();
    if (!desc) {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }
    data.descripcionLibre = desc;
  }

  if (body.comentario !== undefined) {
    data.comentario = body.comentario?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  try {
    const updated = await prisma.productoNoCatalogado.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({
      id: updated.id,
      codigoEscaneado: updated.codigoEscaneado,
      descripcionLibre: updated.descripcionLibre,
      cantidad: formatCantidad(updated.cantidad),
      comentario: updated.comentario,
      timestamp: updated.timestamp,
    });
  } catch (err) {
    console.error("[conteos/no-catalogado PATCH]", err);
    return NextResponse.json({ error: "Error al actualizar el registro" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  const access = await assertLineaNoCatalogadoEditable(params.id, auth.session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    await prisma.productoNoCatalogado.delete({ where: { id: params.id } });
    return NextResponse.json({ id: params.id, deleted: true });
  } catch (err) {
    console.error("[conteos/no-catalogado DELETE]", err);
    return NextResponse.json({ error: "Error al eliminar el registro" }, { status: 500 });
  }
}
