import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRODUCTO_SELECT = {
  id: true,
  codigoBarras: true,
  codigoInterno: true,
  descripcion: true,
  unidadMedida: true,
  categoria: true,
  activo: true,
} as const;

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const codigo = request.nextUrl.searchParams.get("codigo")?.trim();
  if (!codigo) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  const byBarras = await prisma.producto.findUnique({
    where: { codigoBarras: codigo },
    select: PRODUCTO_SELECT,
  });

  const producto =
    byBarras?.activo === true
      ? byBarras
      : await prisma.producto.findFirst({
          where: { codigoInterno: codigo, activo: true },
          select: PRODUCTO_SELECT,
        });

  if (!producto) {
    return NextResponse.json({ encontrado: false });
  }

  return NextResponse.json({
    encontrado: true,
    producto: {
      id: producto.id,
      codigoBarras: producto.codigoBarras,
      codigoInterno: producto.codigoInterno,
      descripcion: producto.descripcion,
      unidadMedida: producto.unidadMedida,
      categoria: producto.categoria,
    },
  });
}
