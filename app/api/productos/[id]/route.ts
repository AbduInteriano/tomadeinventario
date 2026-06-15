import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import {
  findProductoCodigoDuplicado,
  productoTieneConteos,
  serializeProducto,
  validateProductoInput,
} from "@/lib/productos";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
  });

  if (!producto || !producto.activo) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const validated = validateProductoInput(
    {
      codigoBarras: (body.codigoBarras as string) ?? producto.codigoBarras,
      codigoInterno:
        body.codigoInterno !== undefined
          ? (body.codigoInterno as string | null)
          : producto.codigoInterno,
      descripcion: (body.descripcion as string) ?? producto.descripcion,
      unidadMedida: (body.unidadMedida as string) ?? producto.unidadMedida,
      categoria:
        body.categoria !== undefined
          ? (body.categoria as string | null)
          : producto.categoria,
      stockGlobal:
        body.stockGlobal !== undefined
          ? Number(body.stockGlobal)
          : producto.stockGlobal.toNumber(),
    },
    true
  );

  if (validated.error || !validated.data) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { data } = validated;

  const duplicado = await findProductoCodigoDuplicado(data.codigoBarras, params.id);
  if (duplicado) {
    return NextResponse.json(
      { error: "Ya existe otro producto con ese código de barras" },
      { status: 409 }
    );
  }

  const updated = await prisma.producto.update({
    where: { id: params.id },
    data: {
      codigoBarras: data.codigoBarras,
      codigoInterno: data.codigoInterno,
      descripcion: data.descripcion,
      unidadMedida: data.unidadMedida,
      categoria: data.categoria,
      stockGlobal: new Prisma.Decimal(data.stockGlobal),
    },
    include: { _count: { select: { conteos: true } } },
  });

  return NextResponse.json(serializeProducto(updated, updated._count.conteos));
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const producto = await prisma.producto.findUnique({
    where: { id: params.id },
  });

  if (!producto || !producto.activo) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const tieneConteos = await productoTieneConteos(params.id);

  if (tieneConteos) {
    await prisma.producto.update({
      where: { id: params.id },
      data: { activo: false },
    });

    return NextResponse.json({
      id: params.id,
      softDeleted: true,
      message:
        "El producto fue desactivado porque tiene conteos de inventario asociados.",
    });
  }

  await prisma.producto.delete({ where: { id: params.id } });

  return NextResponse.json({
    id: params.id,
    softDeleted: false,
    message: "Producto eliminado correctamente",
  });
}
