import { NextResponse } from "next/server";
import { InventarioEstado } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { getInventarioActivo } from "@/lib/inventario";
import { serializeInventarioListItem } from "@/lib/inventarios-admin";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const inventarios = await prisma.inventario.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { asignaciones: true } },
      asignaciones: { select: { estado: true } },
    },
  });

  const activo = await getInventarioActivo();

  return NextResponse.json({
    inventarios: inventarios.map(serializeInventarioListItem),
    inventarioActivoId: activo?.id ?? null,
  });
}

export async function POST() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const inventario = await prisma.inventario.create({
    data: {
      estado: InventarioEstado.ABIERTO,
      creadoPorId: auth.session.user.id,
    },
  });

  return NextResponse.json(
    {
      id: inventario.id,
      estado: inventario.estado,
      createdAt: inventario.createdAt.toISOString(),
      tomasTotal: 0,
      tomasFinalizadas: 0,
    },
    { status: 201 }
  );
}
