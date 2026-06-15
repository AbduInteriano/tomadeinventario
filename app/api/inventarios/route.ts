import { NextResponse } from "next/server";
import { AsignacionEstado, InventarioEstado } from "@prisma/client";
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

  const activo = await getInventarioActivo();
  if (activo) {
    return NextResponse.json(
      {
        error:
          "Ya existe un inventario activo. Ciérralo antes de crear uno nuevo.",
        inventarioActivoId: activo.id,
      },
      { status: 409 }
    );
  }

  const areasActivas = await prisma.area.findMany({
    where: { activo: true, punto: { activo: true } },
    select: { id: true },
  });

  const inventario = await prisma.$transaction(async (tx) => {
    const inv = await tx.inventario.create({
      data: {
        estado: InventarioEstado.ABIERTO,
        creadoPorId: auth.session.user.id,
      },
    });

    if (areasActivas.length > 0) {
      await tx.asignacionInventarioArea.createMany({
        data: areasActivas.map((a) => ({
          inventarioId: inv.id,
          areaId: a.id,
          estado: AsignacionEstado.PENDIENTE,
        })),
      });
    }

    return inv;
  });

  return NextResponse.json(
    {
      id: inventario.id,
      estado: inventario.estado,
      createdAt: inventario.createdAt.toISOString(),
      areasAsignadas: areasActivas.length,
      areasCompletadas: 0,
    },
    { status: 201 }
  );
}
