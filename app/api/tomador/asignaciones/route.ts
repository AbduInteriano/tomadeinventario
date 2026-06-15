import { NextRequest, NextResponse } from "next/server";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import {
  listTomadorTomorias,
  listSupervisorTomorias,
  serializeTomaConteo,
  parseFechaParam,
  hoyUtc,
  fechaToIsoDate,
} from "@/lib/tomas";
import { Role } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;
  const session = auth.session;
  const isSupervisor = session.user.role === Role.SUPERVISOR;

  const fechaParam = request.nextUrl.searchParams.get("fecha");
  const fecha = parseFechaParam(fechaParam) ?? hoyUtc();

  const tomas = isSupervisor
    ? await listSupervisorTomorias(fecha)
    : await listTomadorTomorias(session.user.id, fecha);

  return NextResponse.json({
    fecha: fechaToIsoDate(fecha),
    asignaciones: tomas.map((t) => serializeTomaConteo(t, session.user.id)),
    isSupervisor,
  });
}
