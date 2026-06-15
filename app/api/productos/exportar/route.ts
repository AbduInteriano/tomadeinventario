import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { createProductosExportBuffer } from "@/lib/excel-productos";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const productos = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { descripcion: "asc" },
    select: {
      codigoBarras: true,
      codigoInterno: true,
      descripcion: true,
      unidadMedida: true,
      categoria: true,
    },
  });

  const buffer = await createProductosExportBuffer(productos);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="productos-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
