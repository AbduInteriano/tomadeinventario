import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { canPerformConteo } from "@/lib/roles";

export function canPerformConteoRole(role: Role): boolean {
  return canPerformConteo(role);
}

export async function requireConteoSessionApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  if (!canPerformConteo(session.user.role)) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session };
}
