import Link from "next/link";
import { requireConteoRole } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { TomadorDashboardClient } from "@/components/TomadorDashboardClient";
import { canAccessSupervisor } from "@/lib/roles";

export default async function TomadorDashboardPage() {
  const session = await requireConteoRole();
  const isStaffView = canAccessSupervisor(session.user.role);

  return (
    <>
      <AppHeader
        title={isStaffView ? "Conteo — todas las tomas" : "Mis tomas"}
        subtitle={session.user.name ?? undefined}
      />

      <main className="mx-auto max-w-lg px-4 py-4">
        {isStaffView && (
          <Link
            href="/supervisor"
            className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
          >
            ← Volver al panel supervisor
          </Link>
        )}

        <TomadorDashboardClient isSupervisor={isStaffView} />
      </main>
    </>
  );
}
