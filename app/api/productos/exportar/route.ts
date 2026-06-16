import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { createProductosExportBuffer } from "@/lib/excel-productos";
import { productoSelect } from "@/lib/productos";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const productos = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { descripcion: "asc" },
    select: productoSelect,
  });

  const buffer = await createProductosExportBuffer(
    productos.map((p) => ({
      codigoBarras: p.codigoBarras,
      codigoArticulo: p.codigoArticulo,
      descripcion: p.descripcion,
      unidadMedida: p.unidadMedida.abreviatura,
      categoria: p.categoria?.nombre ?? null,
    }))
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="productos-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
