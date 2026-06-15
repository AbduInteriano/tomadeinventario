import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import {
  findUnidadByAbreviatura,
  serializeUnidadMedida,
  serializeUnidadDetalle,
  validateUnidadInput,
} from "@/lib/catalogo";

export async function GET(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const detalle = request.nextUrl.searchParams.get("detalle") === "1";

  if (detalle) {
    const unidades = await prisma.unidadMedida.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        _count: { select: { productos: { where: { activo: true } } } },
      },
    });

    return NextResponse.json(
      unidades.map((u) => serializeUnidadDetalle(u, u._count.productos))
    );
  }

  const unidades = await prisma.unidadMedida.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(unidades.map(serializeUnidadMedida));
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: { nombre?: string; abreviatura?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validated = validateUnidadInput(body);
  if (validated.error || !validated.data) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { nombre, abreviatura } = validated.data;
  const existing = await findUnidadByAbreviatura(abreviatura);
  if (existing) {
    if (!existing.activo) {
      const reactivated = await prisma.unidadMedida.update({
        where: { id: existing.id },
        data: { activo: true, nombre, abreviatura },
        include: {
          _count: { select: { productos: { where: { activo: true } } } },
        },
      });
      return NextResponse.json(
        serializeUnidadDetalle(reactivated, reactivated._count.productos),
        { status: 201 }
      );
    }
    return NextResponse.json({ error: "Ya existe una unidad con esa abreviatura" }, { status: 409 });
  }

  const unidad = await prisma.unidadMedida.create({
    data: { nombre, abreviatura },
    include: {
      _count: { select: { productos: { where: { activo: true } } } },
    },
  });

  return NextResponse.json(
    serializeUnidadDetalle(unidad, unidad._count.productos),
    { status: 201 }
  );
}
