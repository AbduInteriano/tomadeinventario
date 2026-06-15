import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";

export async function requireSupervisorApi() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }
  if (session.user.role !== Role.SUPERVISOR) {
    return { error: NextResponse.json({ error: "Acceso denegado" }, { status: 403 }) };
  }
  return { session };
}

export function normalizeNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ");
}

export function validateNombre(nombre: string): string | null {
  const normalized = normalizeNombre(nombre);
  if (!normalized) {
    return "El nombre no puede estar vacío";
  }
  if (normalized.length > 120) {
    return "El nombre no puede superar 120 caracteres";
  }
  return null;
}
