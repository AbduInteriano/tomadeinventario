import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import {
  buildProductoSearchWhere,
  findProductoCodigoDuplicado,
  serializeProducto,
  validateProductoInput,
} from "@/lib/productos";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
  );

  const where = buildProductoSearchWhere(q);

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: { descripcion: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { conteos: true } } },
    }),
    prisma.producto.count({ where }),
  ]);

  return NextResponse.json({
    productos: productos.map((p) =>
      serializeProducto(p, p._count.conteos)
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validated = validateProductoInput({
    codigoBarras: body.codigoBarras as string,
    codigoInterno: body.codigoInterno as string | null,
    descripcion: body.descripcion as string,
    unidadMedida: body.unidadMedida as string,
    categoria: body.categoria as string | null,
    stockGlobal: Number(body.stockGlobal ?? 0),
  });

  if (validated.error || !validated.data) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data } = validated;

  const existingInactive = await prisma.producto.findFirst({
    where: {
      codigoBarras: { equals: data.codigoBarras, mode: "insensitive" },
      activo: false,
    },
  });

  if (existingInactive) {
    const updated = await prisma.producto.update({
      where: { id: existingInactive.id },
      data: {
        codigoBarras: data.codigoBarras,
        codigoInterno: data.codigoInterno,
        descripcion: data.descripcion,
        unidadMedida: data.unidadMedida,
        categoria: data.categoria,
        stockGlobal: new Prisma.Decimal(data.stockGlobal),
        activo: true,
      },
    });
    return NextResponse.json(serializeProducto(updated), { status: 201 });
  }

  const duplicado = await findProductoCodigoDuplicado(data.codigoBarras);
  if (duplicado) {
    return NextResponse.json(
      { error: "Ya existe un producto con ese código de barras" },
      { status: 409 }
    );
  }

  const producto = await prisma.producto.create({
    data: {
      codigoBarras: data.codigoBarras,
      codigoInterno: data.codigoInterno,
      descripcion: data.descripcion,
      unidadMedida: data.unidadMedida,
      categoria: data.categoria,
      stockGlobal: new Prisma.Decimal(data.stockGlobal),
    },
  });

  return NextResponse.json(serializeProducto(producto), { status: 201 });
}
