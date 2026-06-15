import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAsignacionAccess, decimalToNumber } from "@/lib/inventario";
import { Role, AsignacionEstado, InventarioEstado } from "@prisma/client";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.TOMADOR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

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

  const access = await assertAsignacionAccess(asignacionId, session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cantidadDecimal = new Prisma.Decimal(cantidad);

  const registro = await prisma.$transaction(async (tx) => {
    if (access.asignacion.estado === AsignacionEstado.PENDIENTE) {
      await tx.asignacionInventarioArea.update({
        where: { id: asignacionId },
        data: { estado: AsignacionEstado.EN_PROGRESO },
      });
    }

    if (access.asignacion.inventario.estado === InventarioEstado.ABIERTO) {
      await tx.inventario.update({
        where: { id: access.asignacion.inventarioId },
        data: { estado: InventarioEstado.EN_PROCESO },
      });
    }

    return tx.productoNoCatalogado.create({
      data: {
        asignacionId,
        codigoEscaneado: codigoEscaneado.trim(),
        descripcionLibre: descripcionLibre.trim(),
        cantidad: cantidadDecimal,
        usuarioId: session.user.id,
      },
    });
  });

  return NextResponse.json({
    id: registro.id,
    codigoEscaneado: registro.codigoEscaneado,
    descripcionLibre: registro.descripcionLibre,
    cantidad: decimalToNumber(registro.cantidad),
    timestamp: registro.timestamp,
  });
}
