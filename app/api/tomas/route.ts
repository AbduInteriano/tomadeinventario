import { NextRequest, NextResponse } from "next/server";
import { requireSupervisorApi } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  crearTomas,
  getAreasParaAsignar,
  listFechasConTomas,
  listSupervisorTomorias,
  parseFechaParam,
  serializeTomaConteo,
  hoyUtc,
  fechaToIsoDate,
} from "@/lib/tomas";

export async function GET(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const fechaParam = request.nextUrl.searchParams.get("fecha");
  const includeArchivadas = request.nextUrl.searchParams.get("archivadas") === "1";
  const fecha = parseFechaParam(fechaParam) ?? hoyUtc();

  const [tomas, puntos, fechas, usuarios] = await Promise.all([
    listSupervisorTomorias(fecha, includeArchivadas),
    getAreasParaAsignar(),
    listFechasConTomas(includeArchivadas),
    prisma.user.findMany({
      where: { activo: true, role: { in: ["TOMADOR", "SUPERVISOR"] } },
      select: { id: true, nombre: true, role: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  return NextResponse.json({
    fecha: fechaToIsoDate(fecha),
    includeArchivadas,
    fechas,
    tomas: tomas.map((t) => serializeTomaConteo(t, auth.session.user.id)),
    puntos,
    usuarios,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: { usuarioId?: string; areaIds?: string[]; fecha?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.usuarioId || !body.areaIds?.length) {
    return NextResponse.json(
      { error: "usuarioId y al menos un areaId son requeridos" },
      { status: 400 }
    );
  }

  const result = await crearTomas({
    usuarioId: body.usuarioId,
    areaIds: body.areaIds,
    creadoPorId: auth.session.user.id,
    fecha: parseFechaParam(body.fecha ?? null) ?? hoyUtc(),
  });

  if ("error" in result && !result.creadas) {
    return NextResponse.json(
      { error: result.error, omitidas: result.omitidas },
      { status: 400 }
    );
  }

  const fecha = parseFechaParam(body.fecha ?? null) ?? hoyUtc();
  const tomas = await listSupervisorTomorias(fecha);

  return NextResponse.json(
    {
      ok: true,
      creadas: result.creadas!.length,
      warnings: result.warnings ?? [],
      fecha: result.fecha,
      tomas: tomas.map((t) => serializeTomaConteo(t, auth.session.user.id)),
    },
    { status: 201 }
  );
}
