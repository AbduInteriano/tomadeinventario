import { NextRequest, NextResponse } from "next/server";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { finalizarToma } from "@/lib/tomas";

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  const result = await finalizarToma(params.id, auth.session.user.id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, estado: result.toma.estado });
}
