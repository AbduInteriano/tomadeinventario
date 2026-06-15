import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hoyUtc } from "@/lib/inventario";
import { Role } from "@prisma/client";

export default async function SupervisorDashboardPage() {
  const session = await requireRole(Role.SUPERVISOR);
  const hoy = hoyUtc();

  const [puntosCount, productosCount, tomasHoy] = await Promise.all([
    prisma.punto.count({ where: { activo: true } }),
    prisma.producto.count({ where: { activo: true } }),
    prisma.asignacionInventarioArea.count({ where: { fecha: hoy } }),
  ]);

  const modules = [
    {
      href: "/supervisor/tomas",
      title: "Tomas de inventario",
      description: "Asignar áreas a tomadores por fecha",
      ready: true,
    },
    {
      href: "/supervisor/puntos",
      title: "Puntos y Áreas",
      description: "Gestionar puntos de costo y sus áreas",
      ready: true,
    },
    {
      href: "/supervisor/productos",
      title: "Catálogo de productos",
      description: "CRUD, Excel y búsqueda",
      ready: true,
    },
    {
      href: "/supervisor/catalogo",
      title: "Categorías y unidades",
      description: "Administrar categorías y unidades de medida",
      ready: true,
    },
    {
      href: "/supervisor/usuarios",
      title: "Usuarios",
      description: "Tomadores y supervisores",
      ready: true,
    },
  ];

  return (
    <>
      <AppHeader title="Supervisor" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor" />

      <main className="mx-auto max-w-lg space-y-4 px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-blue-600">{puntosCount}</p>
            <p className="text-sm text-slate-600">Puntos activos</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-2xl font-bold text-blue-600">{productosCount}</p>
            <p className="text-sm text-slate-600">Productos</p>
          </div>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-medium text-slate-500">Tomas hoy</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{tomasHoy}</p>
          <Link href="/supervisor/tomas" className="mt-2 inline-block text-sm font-medium text-blue-600">
            Gestionar tomas →
          </Link>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Módulos
          </h2>
          <ul className="space-y-2">
            {modules.map((mod) => (
              <li key={mod.title}>
                <Link
                  href={mod.href}
                  className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
                >
                  <p className="font-bold text-slate-900">{mod.title}</p>
                  <p className="text-sm text-slate-500">{mod.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </>
  );
}
