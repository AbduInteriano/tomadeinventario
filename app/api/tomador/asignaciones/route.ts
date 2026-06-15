import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInventarioActivo } from "@/lib/inventario";
import { Role } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.TOMADOR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const inventario = await getInventarioActivo();
  if (!inventario) {
    return NextResponse.json({ inventario: null, asignaciones: [] });
  }

  const asignaciones = await prisma.asignacionInventarioArea.findMany({
    where: {
      inventarioId: inventario.id,
      usuarioId: session.user.id,
    },
    include: {
      area: { include: { punto: true } },
      _count: { select: { conteos: true, noCatalogados: true } },
    },
    orderBy: { area: { nombre: "asc" } },
  });

  const totalProductos = await prisma.producto.count({ where: { activo: true } });

  return NextResponse.json({
    inventario: {
      id: inventario.id,
      estado: inventario.estado,
      createdAt: inventario.createdAt,
    },
    asignaciones: asignaciones.map((a) => ({
      id: a.id,
      estado: a.estado,
      area: {
        id: a.area.id,
        nombre: a.area.nombre,
        punto: a.area.punto.nombre,
      },
      conteosCount: a._count.conteos,
      noCatalogadosCount: a._count.noCatalogados,
    })),
    totalProductos,
  });
}
