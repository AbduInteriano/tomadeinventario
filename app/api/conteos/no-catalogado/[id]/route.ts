import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/inventario";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { assertLineaNoCatalogadoEditable } from "@/lib/conteo-linea";
import { Prisma } from "@prisma/client";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  let body: { cantidad?: number; descripcionLibre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const access = await assertLineaNoCatalogadoEditable(params.id, auth.session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const data: { cantidad?: Prisma.Decimal; descripcionLibre?: string } = {};

  if (body.cantidad != null) {
    if (typeof body.cantidad !== "number" || body.cantidad <= 0 || !Number.isFinite(body.cantidad)) {
      return NextResponse.json(
        { error: "La cantidad debe ser un número mayor a 0" },
        { status: 400 }
      );
    }
    data.cantidad = new Prisma.Decimal(body.cantidad);
  }

  if (body.descripcionLibre != null) {
    const desc = body.descripcionLibre.trim();
    if (!desc) {
      return NextResponse.json({ error: "La descripción es obligatoria" }, { status: 400 });
    }
    data.descripcionLibre = desc;
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
      cantidad: decimalToNumber(updated.cantidad),
      timestamp: updated.timestamp,
    });
  } catch (err) {
    console.error("[conteos/no-catalogado PATCH]", err);
    return NextResponse.json({ error: "Error al actualizar el registro" }, { status: 500 });
  }
}
