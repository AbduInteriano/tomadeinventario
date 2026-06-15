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
    productoId: string;
    cantidad: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { asignacionId, productoId, cantidad } = body;

  if (!asignacionId || !productoId || cantidad == null) {
    return NextResponse.json(
      { error: "asignacionId, productoId y cantidad son requeridos" },
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

  const producto = await prisma.producto.findUnique({
    where: { id: productoId },
  });

  if (!producto || !producto.activo) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const cantidadDecimal = new Prisma.Decimal(cantidad);

  const conteo = await prisma.$transaction(async (tx) => {
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

    return tx.conteoInventario.upsert({
      where: {
        asignacionId_productoId: { asignacionId, productoId },
      },
      create: {
        asignacionId,
        productoId,
        cantidadContada: cantidadDecimal,
        usuarioId: session.user.id,
      },
      update: {
        cantidadContada: { increment: cantidadDecimal },
        usuarioId: session.user.id,
        timestamp: new Date(),
      },
      include: { producto: true },
    });
  });

  return NextResponse.json({
    id: conteo.id,
    productoId: conteo.productoId,
    codigoBarras: conteo.producto.codigoBarras,
    descripcion: conteo.producto.descripcion,
    unidadMedida: conteo.producto.unidadMedida,
    cantidadContada: decimalToNumber(conteo.cantidadContada),
    timestamp: conteo.timestamp,
  });
}
