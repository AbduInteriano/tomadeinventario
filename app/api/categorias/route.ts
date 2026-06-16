import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi, normalizeNombre } from "@/lib/api-auth";
import {
  findCategoriaByNombre,
  serializeCategoria,
  serializeCategoriaDetalle,
  validateCategoriaNombre,
  categoriaProductosActivosCount,
} from "@/lib/catalogo";

export async function GET(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const detalle = request.nextUrl.searchParams.get("detalle") === "1";

  if (detalle) {
    const categorias = await prisma.categoria.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: {
        _count: { select: { productos: categoriaProductosActivosCount.productos } },
      },
    });

    return NextResponse.json(
      categorias.map((c) =>
        serializeCategoriaDetalle(c, c._count.productos)
      )
    );
  }

  const categorias = await prisma.categoria.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(categorias.map(serializeCategoria));
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const error = validateCategoriaNombre(body.nombre ?? "");
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  const nombre = normalizeNombre(body.nombre!);
  const existing = await findCategoriaByNombre(nombre);
  if (existing) {
    if (!existing.activo) {
      const reactivated = await prisma.categoria.update({
        where: { id: existing.id },
        data: { activo: true, nombre },
        include: {
          _count: { select: { productos: categoriaProductosActivosCount.productos } },
        },
      });
      return NextResponse.json(
        serializeCategoriaDetalle(reactivated, reactivated._count.productos),
        { status: 201 }
      );
    }
    return NextResponse.json({ error: "Ya existe esa categoría" }, { status: 409 });
  }

  const categoria = await prisma.categoria.create({
    data: { nombre },
    include: {
      _count: { select: { productos: { where: { activo: true } } } },
    },
  });

  return NextResponse.json(
    serializeCategoriaDetalle(categoria, categoria._count.productos),
    { status: 201 }
  );
}
