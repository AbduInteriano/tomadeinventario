import { NextResponse } from "next/server";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { listTomadorTomorias, listAreasDisponiblesParaSupervisor, getOrCreateInventarioDefault } from "@/lib/tomas";
import { Role } from "@prisma/client";

export async function GET() {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;
  const isSupervisor = session.user.role === Role.SUPERVISOR;

  const [asignaciones, supervisorData] = await Promise.all([
    listTomadorTomorias(session.user.id),
    isSupervisor
      ? getOrCreateInventarioDefault(session.user.id).then(async (inv) => ({
          inventarioDefaultId: inv.id,
          areasDisponibles: await listAreasDisponiblesParaSupervisor(inv.id),
        }))
      : Promise.resolve(null),
  ]);

  return NextResponse.json({
    asignaciones: asignaciones.map((a) => ({
      id: a.id,
      estado: a.estado,
      inventarioId: a.inventarioId,
      area: {
        id: a.area.id,
        nombre: a.area.nombre,
        punto: a.area.punto.nombre,
      },
      conteosCount: a._count.conteos,
    })),
    areasDisponibles: supervisorData?.areasDisponibles ?? [],
    inventarioDefaultId: supervisorData?.inventarioDefaultId ?? null,
  });
}
