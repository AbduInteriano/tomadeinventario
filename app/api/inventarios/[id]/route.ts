import { NextRequest, NextResponse } from "next/server";
import { AsignacionEstado, InventarioEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { buildInventarioDetalle } from "@/lib/inventarios-admin";

type RouteParams = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const detalle = await buildInventarioDetalle(params.id);
  if (!detalle) {
    return NextResponse.json({ error: "Inventario no encontrado" }, { status: 404 });
  }

  return NextResponse.json(detalle);
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: { estado?: string; forzar?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (body.estado !== InventarioEstado.CERRADO) {
    return NextResponse.json(
      { error: "Solo se permite cambiar el estado a CERRADO" },
      { status: 400 }
    );
  }

  const inventario = await prisma.inventario.findUnique({
    where: { id: params.id },
    include: { asignaciones: { select: { estado: true } } },
  });

  if (!inventario) {
    return NextResponse.json({ error: "Inventario no encontrado" }, { status: 404 });
  }

  if (inventario.estado === InventarioEstado.CERRADO) {
    return NextResponse.json({ error: "El inventario ya está cerrado" }, { status: 400 });
  }

  const pendientes = inventario.asignaciones.filter(
    (a) => a.estado !== AsignacionEstado.COMPLETADA
  );

  if (pendientes.length > 0 && !body.forzar) {
    return NextResponse.json(
      {
        error: "Hay tomas sin finalizar",
        pendientes: pendientes.length,
        requiereConfirmacion: true,
      },
      { status: 409 }
    );
  }

  const updated = await prisma.inventario.update({
    where: { id: params.id },
    data: { estado: InventarioEstado.CERRADO },
  });

  return NextResponse.json({
    id: updated.id,
    estado: updated.estado,
    message: "Inventario cerrado. Los conteos quedan bloqueados.",
  });
}
