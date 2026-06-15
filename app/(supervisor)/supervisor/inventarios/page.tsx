import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { InventariosClient } from "@/components/InventariosClient";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getInventarioActivo } from "@/lib/inventario";
import { serializeInventarioListItem } from "@/lib/inventarios-admin";
import { Role } from "@prisma/client";

export default async function InventariosPage() {
  const session = await requireRole(Role.SUPERVISOR);

  const [inventarios, activo] = await Promise.all([
    prisma.inventario.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { asignaciones: true } },
        asignaciones: { select: { estado: true } },
      },
    }),
    getInventarioActivo(),
  ]);

  return (
    <>
      <AppHeader title="Inventarios" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/inventarios" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver al panel
        </Link>

        <InventariosClient
          initialInventarios={inventarios.map(serializeInventarioListItem)}
          inventarioActivoId={activo?.id ?? null}
        />
      </main>
    </>
  );
}
