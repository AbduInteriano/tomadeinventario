import { NextRequest, NextResponse } from "next/server";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { crearToma, getOrCreateInventarioDefault, iniciarToma } from "@/lib/tomas";
import { Role } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  if (auth.session.user.role !== Role.SUPERVISOR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let body: { areaId?: string; inventarioId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.areaId) {
    return NextResponse.json({ error: "areaId es requerido" }, { status: 400 });
  }

  const inventarioId =
    body.inventarioId ??
    (await getOrCreateInventarioDefault(auth.session.user.id)).id;

  const created = await crearToma({
    inventarioId,
    areaId: body.areaId,
    usuarioId: auth.session.user.id,
  });

  if ("error" in created && !created.asignacionId) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  if ("error" in created && created.asignacionId) {
    const start = await iniciarToma(created.asignacionId, auth.session.user.id, true);
    if ("error" in start) {
      return NextResponse.json({ error: start.error }, { status: start.status });
    }
    return NextResponse.json({
      ok: true,
      asignacionId: created.asignacionId,
      estado: start.toma.estado,
      inventarioId,
    });
  }

  const start = await iniciarToma(created.toma!.id, auth.session.user.id, true);
  if ("error" in start) {
    return NextResponse.json({ error: start.error }, { status: start.status });
  }

  return NextResponse.json({
    ok: true,
    asignacionId: created.toma!.id,
    estado: start.toma.estado,
    inventarioId,
  });
}
