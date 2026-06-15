import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { canViewAsignacion } from "@/lib/tomas";
import {
  buildConteoBlockLabel,
  createConteoExportBuffer,
} from "@/lib/excel-conteo";
import { fechaToIsoDate } from "@/lib/inventario";

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  const access = await canViewAsignacion(
    params.id,
    auth.session.user.id,
    auth.session.user.role
  );
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const asignacion = await prisma.asignacionInventarioArea.findUnique({
    where: { id: params.id },
    include: {
      area: { include: { punto: true } },
      usuario: { select: { nombre: true } },
      conteos: {
        include: {
          producto: {
            include: {
              unidadMedida: { select: { abreviatura: true } },
            },
          },
        },
        orderBy: { producto: { descripcion: "asc" } },
      },
    },
  });

  if (!asignacion) {
    return NextResponse.json({ error: "Toma no encontrada" }, { status: 404 });
  }

  const fechaStr = fechaToIsoDate(asignacion.fecha);
  const safeName = `${asignacion.area.punto.nombre}-${asignacion.area.nombre}`
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);

  const buffer = await createConteoExportBuffer({
    label: buildConteoBlockLabel({
      punto: asignacion.area.punto.nombre,
      area: asignacion.area.nombre,
      usuario: asignacion.usuario.nombre,
      fecha: fechaStr,
    }),
    conteos: asignacion.conteos.map((c) => ({
      codigoBarras: c.producto.codigoBarras,
      codigoInterno: c.producto.codigoInterno,
      descripcion: c.producto.descripcion,
      unidadMedida: c.producto.unidadMedida.abreviatura,
      cantidadContada: c.cantidadContada,
    })),
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="conteo-${safeName}-${fechaStr}.xlsx"`,
    },
  });
}
