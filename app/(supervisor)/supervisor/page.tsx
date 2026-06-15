import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export default async function SupervisorDashboardPage() {
  const session = await requireRole(Role.SUPERVISOR);

  const [puntosCount, productosCount, inventarioActivo] = await Promise.all([
    prisma.punto.count({ where: { activo: true } }),
    prisma.producto.count({ where: { activo: true } }),
    prisma.inventario.findFirst({
      where: { estado: { in: ["ABIERTO", "EN_PROCESO"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const modules = [
    {
      href: "/supervisor/puntos",
      title: "Puntos y Áreas",
      description: "Gestionar puntos de costo y sus áreas",
      ready: true,
    },
    {
      href: "/supervisor/productos",
      title: "Catálogo de productos",
      description: "CRUD y carga masiva Excel",
      ready: true,
    },
    {
      href: "/supervisor/inventarios",
      title: "Inventarios",
      description: "Ciclos, asignaciones y cierre",
      ready: true,
    },
    {
      href: "#",
      title: "Reportes",
      description: "Vista consolidada y exportación Excel",
      ready: false,
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
          <p className="text-sm font-medium text-slate-500">Inventario activo</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {inventarioActivo
              ? `Ciclo ${inventarioActivo.estado.replace("_", " ")}`
              : "Ninguno"}
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Módulos
          </h2>
          <ul className="space-y-2">
            {modules.map((mod) =>
              mod.ready ? (
                <li key={mod.title}>
                  <Link
                    href={mod.href}
                    className="block rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
                  >
                    <p className="font-bold text-slate-900">{mod.title}</p>
                    <p className="text-sm text-slate-500">{mod.description}</p>
                  </Link>
                </li>
              ) : (
                <li
                  key={mod.title}
                  className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200 opacity-60"
                >
                  <p className="font-bold text-slate-700">{mod.title}</p>
                  <p className="text-sm text-slate-500">{mod.description}</p>
                  <p className="mt-1 text-xs text-slate-400">Próximamente</p>
                </li>
              )
            )}
          </ul>
        </div>
      </main>
    </>
  );
}
