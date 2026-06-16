import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { TomasSupervisorClient } from "@/components/TomasSupervisorClient";
import { requireSupervisorAccess } from "@/lib/session";

export default async function TomasPage() {
  const session = await requireSupervisorAccess();

  return (
    <>
      <AppHeader title="Tomas de inventario" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/tomas" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver al panel
        </Link>

        <TomasSupervisorClient />
      </main>
    </>
  );
}
