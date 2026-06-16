import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertAsignacionAccess } from "@/lib/inventario";
import { formatCantidad, parseCantidadBody } from "@/lib/cantidad";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { AsignacionEstado } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;

  let body: {
    asignacionId: string;
    codigoEscaneado: string;
    descripcionLibre: string;
    cantidad: string | number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { asignacionId, codigoEscaneado, descripcionLibre, cantidad } = body;
  const codigo = codigoEscaneado?.trim();

  if (!asignacionId || !codigo || !descripcionLibre?.trim()) {
    return NextResponse.json(
      { error: "asignacionId, codigoEscaneado y descripcionLibre son requeridos" },
      { status: 400 }
    );
  }

  const parsedCantidad = parseCantidadBody(cantidad);
  if ("error" in parsedCantidad) {
    return NextResponse.json({ error: parsedCantidad.error }, { status: 400 });
  }

  const access = await assertAsignacionAccess(asignacionId, session.user.id, {
    requireEnProgreso: true,
  });
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const cantidadDecimal = parsedCantidad.decimal;
  const descripcion = descripcionLibre.trim();

  try {
    const registro = await prisma.$transaction(async (tx) => {
      const asignacion = await tx.asignacionInventarioArea.findUnique({
        where: { id: asignacionId },
        select: { estado: true },
      });
      if (!asignacion || asignacion.estado !== AsignacionEstado.EN_PROGRESO) {
        throw new Error("NO_INICIADA");
      }

      return tx.productoNoCatalogado.create({
        data: {
          asignacionId,
          codigoEscaneado: codigo,
          descripcionLibre: descripcion,
          cantidad: cantidadDecimal,
          usuarioId: session.user.id,
        },
      });
    });

    return NextResponse.json({
      id: registro.id,
      codigoEscaneado: registro.codigoEscaneado,
      descripcionLibre: registro.descripcionLibre,
      cantidad: formatCantidad(registro.cantidad),
      timestamp: registro.timestamp,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NO_INICIADA") {
      return NextResponse.json(
        { error: "La toma debe estar en progreso para registrar conteos" },
        { status: 403 }
      );
    }
    console.error("[conteos/no-catalogado]", err);
    return NextResponse.json({ error: "Error al guardar el registro" }, { status: 500 });
  }
}
