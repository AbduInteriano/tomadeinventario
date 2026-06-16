import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { CatalogoClient } from "@/components/CatalogoClient";
import { requireSupervisorAccess } from "@/lib/session";

export default async function CatalogoPage() {
  const session = await requireSupervisorAccess();

  return (
    <>
      <AppHeader title="Catálogo" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/catalogo" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver al panel
        </Link>

        <CatalogoClient />
      </main>
    </>
  );
}
