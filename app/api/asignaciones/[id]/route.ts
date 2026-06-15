import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAsignacionAccess, decimalToNumber } from "@/lib/inventario";
import { requireConteoSessionApi } from "@/lib/conteo-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;

  const access = await assertAsignacionAccess(params.id, session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const { asignacion } = access;

  const [conteos, noCatalogados] = await Promise.all([
    prisma.conteoInventario.findMany({
      where: { asignacionId: asignacion.id },
      include: { producto: true },
      orderBy: { timestamp: "desc" },
    }),
    prisma.productoNoCatalogado.findMany({
      where: { asignacionId: asignacion.id },
      orderBy: { timestamp: "desc" },
    }),
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
  });
}
