import { NextRequest, NextResponse } from "next/server";
import { requireSupervisorApi } from "@/lib/api-auth";
import { archivarToma } from "@/lib/tomas";

type RouteParams = { params: { id: string } };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const result = await archivarToma(params.id);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, id: result.toma.id, archivada: true });
}
