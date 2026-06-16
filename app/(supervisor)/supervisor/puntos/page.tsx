import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { PuntosClient } from "@/components/PuntosClient";
import { requireSupervisorAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function PuntosPage() {
  const session = await requireSupervisorAccess();

  const puntos = await prisma.punto.findMany({
    where: { activo: true },
    include: {
      _count: { select: { areas: { where: { activo: true } } } },
    },
    orderBy: { nombre: "asc" },
  });

  return (
    <>
      <AppHeader title="Puntos" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/puntos" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver al panel
        </Link>

        <PuntosClient
          initialPuntos={puntos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            areasCount: p._count.areas,
          }))}
        />
      </main>
    </>
  );
}
