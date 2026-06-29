import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { canViewAsignacion } from "@/lib/tomas";
import {
  buildConteoBlockLabel,
  createConsolidatedConteoExportBuffer,
} from "@/lib/excel-conteo";
import { fechaToIsoDate } from "@/lib/inventario";

export async function POST(request: NextRequest) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.filter(Boolean)))
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecciona al menos una toma" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ error: "Máximo 50 tomas por descarga" }, { status: 400 });
  }

  for (const id of ids) {
    const access = await canViewAsignacion(
      id,
      auth.session.user.id,
      auth.session.user.role
    );
    if ("error" in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
  }

  const asignaciones = await prisma.asignacionInventarioArea.findMany({
    where: { id: { in: ids } },
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
        orderBy: { timestamp: "desc" },
      },
      noCatalogados: {
        orderBy: { timestamp: "desc" },
      },
    },
    orderBy: [{ fecha: "asc" }, { updatedAt: "asc" }],
  });

  if (asignaciones.length === 0) {
    return NextResponse.json({ error: "No se encontraron las tomas seleccionadas" }, { status: 404 });
  }

  const orderMap = new Map(ids.map((id, i) => [id, i]));
  asignaciones.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

  try {
    const blocks = asignaciones.map((a) => ({
    label: buildConteoBlockLabel({
      punto: a.area.punto.nombre,
      area: a.area.nombre,
      usuario: a.usuario.nombre,
      fecha: fechaToIsoDate(a.fecha),
    }),
    conteos: a.conteos.map((c) => ({
      codigoBarras: c.producto.codigoBarras,
      codigoArticulo: c.producto.codigoArticulo,
      descripcion: c.producto.descripcion,
      unidadMedida: c.producto.unidadMedida.abreviatura,
      cantidadContada: c.cantidadContada,
      comentario: c.comentario,
    })),
    noCatalogados: a.noCatalogados.map((n) => ({
      codigoEscaneado: n.codigoEscaneado,
      descripcionLibre: n.descripcionLibre,
      cantidad: n.cantidad,
      comentario: n.comentario,
    })),
  }));

  const fechaStr = fechaToIsoDate(asignaciones[0].fecha);
  const filename =
    asignaciones.length === 1
      ? `conteo-${asignaciones.length}-toma-${fechaStr}.xlsx`
      : `conteos-${asignaciones.length}-tomas-${fechaStr}.xlsx`;

  const buffer = await createConsolidatedConteoExportBuffer(blocks);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[conteos/exportar]", err);
    return NextResponse.json(
      { error: "No se pudo generar el Excel del conteo" },
      { status: 500 }
    );
  }
}
