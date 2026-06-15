import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAsignacionAccess, decimalToNumber } from "@/lib/inventario";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;

  let body: {
    asignacionId: string;
    codigoEscaneado: string;
    descripcionLibre: string;
    cantidad: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { asignacionId, codigoEscaneado, descripcionLibre, cantidad } = body;

  if (!asignacionId || !codigoEscaneado?.trim() || !descripcionLibre?.trim()) {
    return NextResponse.json(
      { error: "asignacionId, codigoEscaneado y descripcionLibre son requeridos" },
      { status: 400 }
    );
  }

  if (typeof cantidad !== "number" || cantidad <= 0 || !Number.isFinite(cantidad)) {
    return NextResponse.json(
      { error: "La cantidad debe ser un número mayor a 0" },
      { status: 400 }
    );
  }

  const access = await assertAsignacionAccess(asignacionId, session.user.id, {
    requireEnProgreso: true,
  });
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cantidadDecimal = new Prisma.Decimal(cantidad);

  const registro = await prisma.productoNoCatalogado.create({
      data: {
        asignacionId,
        codigoEscaneado: codigoEscaneado.trim(),
        descripcionLibre: descripcionLibre.trim(),
        cantidad: cantidadDecimal,
        usuarioId: session.user.id,
    },
  });

  return NextResponse.json({
    id: registro.id,
    codigoEscaneado: registro.codigoEscaneado,
    descripcionLibre: registro.descripcionLibre,
    cantidad: decimalToNumber(registro.cantidad),
    timestamp: registro.timestamp,
  });
}
