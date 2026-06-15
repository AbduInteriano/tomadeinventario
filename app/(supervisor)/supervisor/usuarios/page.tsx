import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { SupervisorNav } from "@/components/SupervisorNav";
import { UsuariosClient } from "@/components/UsuariosClient";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { serializeUsuario } from "@/lib/usuarios";
import { Role } from "@prisma/client";

export default async function UsuariosPage() {
  const session = await requireRole(Role.SUPERVISOR);

  const usuarios = await prisma.user.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return (
    <>
      <AppHeader title="Usuarios" subtitle={session.user.name ?? undefined} />
      <SupervisorNav currentPath="/supervisor/usuarios" />

      <main className="mx-auto max-w-lg px-4 py-4">
        <Link
          href="/supervisor"
          className="mb-4 inline-block text-sm font-medium text-blue-600 active:text-blue-800"
        >
          ← Volver al panel
        </Link>

        <UsuariosClient
          initialUsuarios={usuarios.map(serializeUsuario)}
          currentUserId={session.user.id}
        />
      </main>
    </>
  );
}
