import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { InventarioDetailClient } from "@/components/InventarioDetailClient";
import { requireRole } from "@/lib/session";
import { buildInventarioDetalle } from "@/lib/inventarios-admin";
import { Role } from "@prisma/client";

export default async function InventarioDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(Role.SUPERVISOR);

  const detalle = await buildInventarioDetalle(params.id);
  if (!detalle) {
    notFound();
  }

  return (
    <>
      <AppHeader
        title="Detalle inventario"
        subtitle={new Date(detalle.inventario.createdAt).toLocaleDateString("es-MX")}
      />
      <SupervisorNav currentPath="/supervisor/inventarios" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor/inventarios"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver a inventarios
        </Link>

        <InventarioDetailClient inventarioId={params.id} initialData={detalle} />
      </main>
    </>
  );
}
