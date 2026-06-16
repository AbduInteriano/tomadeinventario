import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi } from "@/lib/api-auth";
import { resolveCategoriaId, resolveUnidadMedidaId } from "@/lib/catalogo";
import {
  findProductoCodigoDuplicado,
  productoSelect,
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
    select: productoSelect,
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

  const unidadMedidaId =
    (body.unidadMedidaId as string | undefined) ?? producto.unidadMedida.id;
  const categoriaId =
    body.categoriaId !== undefined
      ? (body.categoriaId as string | null)
      : producto.categoria?.id ?? null;

  const unidad = await resolveUnidadMedidaId(unidadMedidaId);
  if (unidad.error || !unidad.id) {
    return NextResponse.json({ error: unidad.error ?? "Unidad no válida" }, { status: 400 });
  }

  const categoria = await resolveCategoriaId(categoriaId ?? undefined);
  if (categoria.error) {
    return NextResponse.json({ error: categoria.error }, { status: 400 });
  }

  const validated = validateProductoInput(
    {
      codigoBarras: (body.codigoBarras as string) ?? producto.codigoBarras,
      codigoArticulo:
        body.codigoArticulo !== undefined
          ? (body.codigoArticulo as string | null)
          : producto.codigoArticulo,
      descripcion: (body.descripcion as string) ?? producto.descripcion,
      unidadMedidaId: unidad.id,
      categoriaId: categoria.id,
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
      codigoArticulo: data.codigoArticulo,
      descripcion: data.descripcion,
      unidadMedidaId: data.unidadMedidaId,
      categoriaId: data.categoriaId,
    },
    select: productoSelect,
  });

  return NextResponse.json(serializeProducto(updated));
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
