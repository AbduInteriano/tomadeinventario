import { NextResponse } from "next/server";
import { createProductoTemplateBuffer } from "@/lib/excel-productos";
import { requireSupervisorApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const [categorias, unidades] = await Promise.all([
    prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { nombre: true },
    }),
    prisma.unidadMedida.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { nombre: true, abreviatura: true },
    }),
  ]);

  const buffer = await createProductoTemplateBuffer({ categorias, unidades });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-productos.xlsx"',
    },
  });
}
