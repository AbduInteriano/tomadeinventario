import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getInventarioActivo } from "@/lib/inventario";
import { AppHeader, EstadoBadge } from "@/components/AppHeader";
import { Role } from "@prisma/client";

export default async function TomadorDashboardPage() {
  const session = await requireRole(Role.TOMADOR);
  const inventario = await getInventarioActivo();

  const asignaciones = inventario
    ? await prisma.asignacionInventarioArea.findMany({
        where: {
          inventarioId: inventario.id,
          usuarioId: session.user.id,
        },
        include: {
          area: { include: { punto: true } },
          _count: { select: { conteos: true } },
        },
        orderBy: { area: { nombre: "asc" } },
      })
    : [];

  const totalProductos = await prisma.producto.count({ where: { activo: true } });

  return (
    <>
      <AppHeader
        title="Mis áreas"
        subtitle={session.user.name ?? undefined}
      />

      <main className="mx-auto max-w-lg px-4 py-4">
        {!inventario ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-medium text-slate-700">
              No hay inventario activo
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Espera a que el supervisor abra un nuevo ciclo de inventario.
            </p>
          </div>
        ) : asignaciones.length === 0 ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-medium text-slate-700">
              Sin áreas asignadas
            </p>
            <p className="mt-2 text-sm text-slate-500">
              El supervisor aún no te ha asignado áreas en el inventario actual.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {asignaciones.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/tomador/area/${a.id}`}
                  className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-500">{a.area.punto.nombre}</p>
                      <p className="text-lg font-bold text-slate-900">
                        {a.area.nombre}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {a._count.conteos} productos contados
                        {totalProductos > 0 && (
                          <span className="text-slate-400">
                            {" "}
                            · catálogo: {totalProductos}
                          </span>
                        )}
                      </p>
                    </div>
                    <EstadoBadge estado={a.estado} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
