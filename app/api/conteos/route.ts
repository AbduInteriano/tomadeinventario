import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/inventario";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { AsignacionEstado, Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;

  let body: {
    asignacionId: string;
    productoId: string;
    cantidad: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { asignacionId, productoId, cantidad } = body;

  if (!asignacionId || !productoId || cantidad == null) {
    return NextResponse.json(
      { error: "asignacionId, productoId y cantidad son requeridos" },
      { status: 400 }
    );
  }

  if (typeof cantidad !== "number" || cantidad <= 0 || !Number.isFinite(cantidad)) {
    return NextResponse.json(
      { error: "La cantidad debe ser un número mayor a 0" },
      { status: 400 }
    );
  }

  const cantidadDecimal = new Prisma.Decimal(cantidad);

  try {
    const conteo = await prisma.$transaction(async (tx) => {
      const asignacion = await tx.asignacionInventarioArea.findUnique({
        where: { id: asignacionId },
        select: {
          estado: true,
          usuarioId: true,
        },
      });

      if (!asignacion) {
        throw new Error("NOT_FOUND");
      }
      if (asignacion.estado === AsignacionEstado.COMPLETADA) {
        throw new Error("FINALIZADA");
      }
      if (!asignacion.usuarioId || asignacion.usuarioId !== session.user.id) {
        throw new Error("FORBIDDEN");
      }
      if (asignacion.estado !== AsignacionEstado.EN_PROGRESO) {
        throw new Error(
          asignacion.estado === AsignacionEstado.PAUSADA ? "PAUSADA" : "NO_INICIADA"
        );
      }

      const producto = await tx.producto.findFirst({
        where: { id: productoId, activo: true },
        select: {
          id: true,
          codigoBarras: true,
          descripcion: true,
          unidadMedida: { select: { abreviatura: true } },
        },
      });

      if (!producto) {
        throw new Error("PRODUCTO");
      }

      return tx.conteoInventario.create({
        data: {
          asignacionId,
          productoId,
          cantidadContada: cantidadDecimal,
          usuarioId: session.user.id,
        },
        select: {
          id: true,
          productoId: true,
          cantidadContada: true,
          timestamp: true,
          producto: {
            select: {
              codigoBarras: true,
              descripcion: true,
              unidadMedida: { select: { abreviatura: true } },
            },
          },
        },
      });
    });

    return NextResponse.json({
      id: conteo.id,
      productoId: conteo.productoId,
      codigoBarras: conteo.producto.codigoBarras,
      descripcion: conteo.producto.descripcion,
      unidadMedida: conteo.producto.unidadMedida.abreviatura,
      cantidadContada: decimalToNumber(conteo.cantidadContada),
      timestamp: conteo.timestamp,
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Toma no encontrada" }, { status: 404 });
    }
    if (code === "FINALIZADA") {
      return NextResponse.json({ error: "Esta toma ya fue finalizada" }, { status: 403 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: "No tienes acceso a esta toma" }, { status: 403 });
    }
    if (code === "PAUSADA") {
      return NextResponse.json(
        { error: "La toma está pausada. Reanúdala para continuar contando." },
        { status: 403 }
      );
    }
    if (code === "NO_INICIADA") {
      return NextResponse.json(
        { error: "Debes iniciar la toma antes de registrar conteos." },
        { status: 403 }
      );
    }
    if (code === "PRODUCTO") {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    console.error("[conteos POST]", err);
    return NextResponse.json({ error: "Error al guardar el conteo" }, { status: 500 });
  }
}
