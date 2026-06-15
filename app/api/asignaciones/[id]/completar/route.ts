import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertAsignacionAccess } from "@/lib/inventario";
import { Role, AsignacionEstado } from "@prisma/client";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== Role.TOMADOR) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const access = await assertAsignacionAccess(params.id, session.user.id);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const updated = await prisma.asignacionInventarioArea.update({
    where: { id: params.id },
    data: { estado: AsignacionEstado.COMPLETADA },
  });

  return NextResponse.json({ id: updated.id, estado: updated.estado });
}
