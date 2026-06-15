import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { ProductosClient } from "@/components/ProductosClient";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { buildProductoSearchWhere, serializeProducto } from "@/lib/productos";
import { Role } from "@prisma/client";

const LIMIT = 20;

export default async function ProductosPage() {
  const session = await requireRole(Role.SUPERVISOR);

  const where = buildProductoSearchWhere("");

  const [productos, total] = await Promise.all([
    prisma.producto.findMany({
      where,
      orderBy: { descripcion: "asc" },
      take: LIMIT,
      include: { _count: { select: { conteos: true } } },
    }),
    prisma.producto.count({ where }),
  ]);

  return (
    <>
      <AppHeader title="Productos" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/productos" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver al panel
        </Link>

        <ProductosClient
          initialProductos={productos.map((p) =>
            serializeProducto(p, p._count.conteos)
          )}
          initialPagination={{
            page: 1,
            limit: LIMIT,
            total,
            totalPages: Math.ceil(total / LIMIT) || 1,
          }}
        />
      </main>
    </>
  );
}
