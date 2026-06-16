import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productoSelect, serializeProducto } from "@/lib/productos";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const codigo = request.nextUrl.searchParams.get("codigo")?.trim();
  if (!codigo) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  const byBarras = await prisma.producto.findFirst({
    where: {
      activo: true,
      codigoBarras: { equals: codigo, mode: "insensitive" },
    },
    select: productoSelect,
  });

  const producto =
    byBarras ??
    (await prisma.producto.findFirst({
      where: {
        activo: true,
        codigoArticulo: { equals: codigo, mode: "insensitive" },
      },
      select: productoSelect,
    }));

  if (!producto) {
    return NextResponse.json({ encontrado: false });
  }

  const serialized = serializeProducto(producto);

  return NextResponse.json({
    encontrado: true,
    producto: {
      id: serialized.id,
      codigoBarras: serialized.codigoBarras,
      codigoArticulo: serialized.codigoArticulo,
      descripcion: serialized.descripcion,
      unidadMedida: serialized.unidadMedida,
      categoria: serialized.categoria,
    },
  });
}
