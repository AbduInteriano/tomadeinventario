import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAsignacionAccess, decimalToNumber } from "@/lib/inventario";
import { Role } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.TOMADOR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const access = await assertAsignacionAccess(params.id, session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { asignacion } = access;

  const [conteos, noCatalogados, totalProductos] = await Promise.all([
    prisma.conteoInventario.findMany({
      where: { asignacionId: asignacion.id },
      include: { producto: true },
      orderBy: { timestamp: "desc" },
    }),
    prisma.productoNoCatalogado.findMany({
      where: { asignacionId: asignacion.id },
      orderBy: { timestamp: "desc" },
    }),
    prisma.producto.count({ where: { activo: true } }),
  ]);

  return NextResponse.json({
    asignacion: {
      id: asignacion.id,
      estado: asignacion.estado,
      area: {
        id: asignacion.area.id,
        nombre: asignacion.area.nombre,
        punto: asignacion.area.punto.nombre,
      },
      inventarioEstado: asignacion.inventario.estado,
    },
    conteos: conteos.map((c) => ({
      id: c.id,
      productoId: c.productoId,
      codigoBarras: c.producto.codigoBarras,
      descripcion: c.producto.descripcion,
      unidadMedida: c.producto.unidadMedida,
      cantidadContada: decimalToNumber(c.cantidadContada),
      timestamp: c.timestamp,
    })),
    noCatalogados: noCatalogados.map((n) => ({
      id: n.id,
      codigoEscaneado: n.codigoEscaneado,
      descripcionLibre: n.descripcionLibre,
      cantidad: decimalToNumber(n.cantidad),
      timestamp: n.timestamp,
    })),
    totalProductos,
  });
}
