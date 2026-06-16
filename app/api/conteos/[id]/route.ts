import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/inventario";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { assertLineaConteoEditable } from "@/lib/conteo-linea";
import { Prisma } from "@prisma/client";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  let body: { cantidad?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { cantidad } = body;
  if (typeof cantidad !== "number" || cantidad <= 0 || !Number.isFinite(cantidad)) {
    return NextResponse.json(
      { error: "La cantidad debe ser un número mayor a 0" },
      { status: 400 }
    );
  }

  const access = await assertLineaConteoEditable(params.id, auth.session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const updated = await prisma.conteoInventario.update({
      where: { id: params.id },
      data: { cantidadContada: new Prisma.Decimal(cantidad) },
      select: {
        id: true,
        productoId: true,
        cantidadContada: true,
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
      cantidadContada: decimalToNumber(updated.cantidadContada),
      timestamp: updated.timestamp,
    });
  } catch (err) {
    console.error("[conteos PATCH]", err);
    return NextResponse.json({ error: "Error al actualizar el conteo" }, { status: 500 });
  }
}
