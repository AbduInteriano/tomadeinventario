import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const codigo = request.nextUrl.searchParams.get("codigo")?.trim();
  if (!codigo) {
    return NextResponse.json({ error: "Código requerido" }, { status: 400 });
  }

  const producto = await prisma.producto.findFirst({
    where: {
      activo: true,
      OR: [{ codigoBarras: codigo }, { codigoInterno: codigo }],
    },
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
