import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { resolveCategoriaId, resolveUnidadMedidaId } from "@/lib/catalogo";
import {
  buildProductoSearchWhere,
  findProductoCodigoDuplicado,
  productoSelect,
  serializeProducto,
  validateProductoInput,
} from "@/lib/productos";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
  const groupBy = searchParams.get("groupBy") === "categoria";

  const where = buildProductoSearchWhere(q);

  if (groupBy && !q.trim()) {
    const productos = await prisma.producto.findMany({
      where,
      orderBy: [{ categoria: { nombre: "asc" } }, { descripcion: "asc" }],
      select: productoSelect,
    });

    const gruposMap = new Map<string, ReturnType<typeof serializeProducto>[]>();
    for (const p of productos) {
      const key = p.categoria?.nombre ?? "Sin categoría";
      if (!gruposMap.has(key)) gruposMap.set(key, []);
      gruposMap.get(key)!.push(serializeProducto(p));
    }

    const grupos = Array.from(gruposMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([categoria, items]) => ({ categoria, productos: items, total: items.length }));

    return NextResponse.json({
      grupos,
      pagination: { page: 1, limit: productos.length, total: productos.length, totalPages: 1 },
    });
  }

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: { descripcion: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: productoSelect,
    }),
    prisma.producto.count({ where }),
  ]);

  return NextResponse.json({
    productos: productos.map(serializeProducto),
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

  const unidad = await resolveUnidadMedidaId(body.unidadMedidaId as string | undefined);
  if (unidad.error || !unidad.id) {
    return NextResponse.json({ error: unidad.error ?? "Unidad no válida" }, { status: 400 });
  }

  const categoria = await resolveCategoriaId(body.categoriaId as string | null | undefined);
  if (categoria.error) {
    return NextResponse.json({ error: categoria.error }, { status: 400 });
  }

  const validated = validateProductoInput({
    codigoBarras: body.codigoBarras as string,
    codigoInterno: body.codigoInterno as string | null,
    descripcion: body.descripcion as string,
    unidadMedidaId: unidad.id,
    categoriaId: categoria.id,
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
        unidadMedidaId: data.unidadMedidaId,
        categoriaId: data.categoriaId,
        activo: true,
      },
      select: productoSelect,
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
      unidadMedidaId: data.unidadMedidaId,
      categoriaId: data.categoriaId,
    },
    select: productoSelect,
  });

  return NextResponse.json(serializeProducto(producto), { status: 201 });
}
