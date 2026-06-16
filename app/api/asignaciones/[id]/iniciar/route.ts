import { NextRequest, NextResponse } from "next/server";
import { requireConteoSessionApi } from "@/lib/conteo-auth";
import { iniciarToma } from "@/lib/tomas";
import { canAccessSupervisor } from "@/lib/roles";

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireConteoSessionApi();
  if ("error" in auth) return auth.error;

  const result = await iniciarToma(
    params.id,
    auth.session.user.id,
    canAccessSupervisor(auth.session.user.role)
  );

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, estado: result.toma.estado });
}
