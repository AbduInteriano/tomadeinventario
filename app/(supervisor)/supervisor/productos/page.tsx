import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { ProductosClient } from "@/components/ProductosClient";
import { requireRole } from "@/lib/session";
import { Role } from "@prisma/client";

export default async function ProductosPage() {
  const session = await requireRole(Role.SUPERVISOR);

  return (
    <>
      <AppHeader title="Productos" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/productos" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href="/supervisor"
            className="text-sm font-medium text-blue-600 active:text-blue-800"
          >
            ← Volver al panel
          </Link>
          <Link
            href="/supervisor/catalogo"
            className="text-sm font-medium text-slate-600"
          >
            Categorías y unidades →
          </Link>
        </div>

        <ProductosClient />
      </main>
    </>
  );
}
