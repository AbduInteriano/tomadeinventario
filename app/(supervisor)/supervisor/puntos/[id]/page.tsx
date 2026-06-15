import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { AreasClient } from "@/components/AreasClient";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export default async function PuntoAreasPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(Role.SUPERVISOR);

  const punto = await prisma.punto.findUnique({
    where: { id: params.id },
  });

  if (!punto || !punto.activo) {
    notFound();
  }

  const areas = await prisma.area.findMany({
    where: { puntoId: params.id, activo: true },
    include: { _count: { select: { asignaciones: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <AppHeader title="Áreas" subtitle={punto.nombre} />
      <SupervisorNav currentPath="/supervisor/puntos" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor/puntos"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver a puntos
        </Link>

        <AreasClient
          puntoId={punto.id}
          puntoNombre={punto.nombre}
          initialAreas={areas.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            asignacionesCount: a._count.asignaciones,
          }))}
        />
      </main>
    </>
  );
}
