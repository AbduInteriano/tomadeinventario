import { NextRequest, NextResponse } from "next/server";
import { requireSupervisorApi } from "@/lib/api-auth";
import { buildInventarioDetalle } from "@/lib/inventarios-admin";
import { crearToma, iniciarToma } from "@/lib/tomas";

type RouteParams = { params: { id: string } };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: { areaId?: string; usuarioId?: string | null; iniciar?: boolean };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.areaId) {
    return NextResponse.json({ error: "areaId es requerido" }, { status: 400 });
  }

  const result = await crearToma({
    inventarioId: params.id,
    areaId: body.areaId,
    usuarioId: body.usuarioId ?? null,
  });

  if ("error" in result && !result.asignacionId) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if ("error" in result && result.asignacionId) {
    return NextResponse.json(
      { error: result.error, asignacionId: result.asignacionId },
      { status: 409 }
    );
  }

  const asignacionId = result.toma!.id;

  if (body.iniciar && body.usuarioId) {
    const start = await iniciarToma(asignacionId, body.usuarioId, true);
    if ("error" in start) {
      return NextResponse.json({ error: start.error }, { status: start.status });
    }
  }

  const detalle = await buildInventarioDetalle(params.id);

  return NextResponse.json(
    {
      ok: true,
      asignacionId,
      ...(detalle ?? {}),
    },
    { status: 201 }
  );
}
