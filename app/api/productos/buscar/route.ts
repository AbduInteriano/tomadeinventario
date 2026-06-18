import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildProductoConteoBuscarWhere,
  productoSelect,
  serializeProducto,
} from "@/lib/productos";

const MAX_RESULTADOS = 20;

function toProductoBusqueda(serialized: ReturnType<typeof serializeProducto>) {
  return {
    id: serialized.id,
    codigoBarras: serialized.codigoBarras,
    codigoArticulo: serialized.codigoArticulo,
    descripcion: serialized.descripcion,
    unidadMedida: serialized.unidadMedida,
    categoria: serialized.categoria,
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const q =
    request.nextUrl.searchParams.get("q")?.trim() ??
    request.nextUrl.searchParams.get("codigo")?.trim() ??
    "";

  if (!q) {
    return NextResponse.json({ error: "Término de búsqueda requerido" }, { status: 400 });
  }

  const where = buildProductoConteoBuscarWhere(q);
  if (!where) {
    return NextResponse.json({ error: "Término de búsqueda requerido" }, { status: 400 });
  }

  const productos = await prisma.producto.findMany({
    where,
    select: productoSelect,
    orderBy: { descripcion: "asc" },
    take: MAX_RESULTADOS,
  });

  if (productos.length === 0) {
    return NextResponse.json({ encontrado: false });
  }

  const serializados = productos.map((p) => toProductoBusqueda(serializeProducto(p)));

  if (serializados.length === 1) {
    return NextResponse.json({
      encontrado: true,
      producto: serializados[0],
    });
  }

  return NextResponse.json({
    encontrado: true,
    multiple: true,
    productos: serializados,
  });
}
