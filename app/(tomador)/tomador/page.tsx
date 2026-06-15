import Link from "next/link";
import { requireConteoRole } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { TomadorDashboardClient } from "@/components/TomadorDashboardClient";
import { Role } from "@prisma/client";

export default async function TomadorDashboardPage() {
  const session = await requireConteoRole();
  const isSupervisor = session.user.role === Role.SUPERVISOR;

  return (
    <>
      <AppHeader
        title={isSupervisor ? "Conteo — todas las tomas" : "Mis tomas"}
        subtitle={session.user.name ?? undefined}
      />

      <main className="mx-auto max-w-lg px-4 py-4">
        {isSupervisor && (
          <Link
            href="/supervisor"
            className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
          >
            ← Volver al panel supervisor
          </Link>
        )}

        <TomadorDashboardClient isSupervisor={isSupervisor} />
      </main>
    </>
  );
}
