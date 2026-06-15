import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/inventario";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { canViewAsignacion } from "@/lib/tomas";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;

  const access = await canViewAsignacion(params.id, session.user.id, session.user.role);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      estado: true,
      usuarioId: true,
      area: {
        select: {
          id: true,
          nombre: true,
          punto: { select: { nombre: true } },
        },
      },
      fecha: true,
    },
  });

  if (!asignacion) {
    return NextResponse.json({ error: "Toma no encontrada" }, { status: 404 });
  }

  const [conteos, noCatalogados] = await Promise.all([
    prisma.conteoInventario.findMany({
      where: { asignacionId: asignacion.id },
      include: {
        producto: {
          include: {
            unidadMedida: { select: { abreviatura: true } },
          },
        },
      },
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
      esPropia: asignacion.usuarioId === session.user.id,
      fecha: asignacion.fecha.toISOString().slice(0, 10),
      area: {
        id: asignacion.area.id,
        nombre: asignacion.area.nombre,
        punto: asignacion.area.punto.nombre,
      },
    },
    conteos: conteos.map((c) => ({
      id: c.id,
      productoId: c.productoId,
      codigoBarras: c.producto.codigoBarras,
      descripcion: c.producto.descripcion,
      unidadMedida: c.producto.unidadMedida.abreviatura,
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
