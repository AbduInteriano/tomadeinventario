import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireSupervisorApi,
  normalizeNombre,
  validateNombre,
} from "@/lib/api-auth";
import { findPuntoNombreDuplicado } from "@/lib/puntos";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const puntos = await prisma.punto.findMany({
    where: { activo: true },
    include: {
      _count: {
        select: {
          areas: { where: { activo: true } },
        },
      },
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(
    puntos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      activo: p.activo,
      areasCount: p._count.areas,
      createdAt: p.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: { nombre?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombreError = validateNombre(body.nombre ?? "");
  if (nombreError) {
    return NextResponse.json({ error: nombreError }, { status: 400 });
  }

  const nombre = normalizeNombre(body.nombre!);
  const duplicado = await findPuntoNombreDuplicado(nombre);
  if (duplicado) {
    return NextResponse.json(
      { error: "Ya existe un punto con ese nombre" },
      { status: 409 }
    );
  }

  const punto = await prisma.punto.create({
    data: { nombre },
  });

  return NextResponse.json(
    { id: punto.id, nombre: punto.nombre, activo: punto.activo, areasCount: 0 },
    { status: 201 }
  );
}
