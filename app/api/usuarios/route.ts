import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi, normalizeNombre } from "@/lib/api-auth";
import {
  findUsernameDuplicado,
  hashPassword,
  normalizeUsername,
  serializeUsuario,
  validateNombreUsuario,
  validatePassword,
  validateUsername,
} from "@/lib/usuarios";

export async function GET() {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const usuarios = await prisma.user.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });

  return NextResponse.json(usuarios.map(serializeUsuario));
}

export async function POST(request: NextRequest) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  let body: {
    nombre?: string;
    username?: string;
    password?: string;
    role?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nombreError = validateNombreUsuario(body.nombre ?? "");
  if (nombreError) {
    return NextResponse.json({ error: nombreError }, { status: 400 });
  }

  const usernameError = validateUsername(body.username ?? "");
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const passwordError = validatePassword(body.password ?? "");
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const role = body.role === Role.SUPERVISOR ? Role.SUPERVISOR : Role.TOMADOR;
  const username = normalizeUsername(body.username!);
  const nombre = normalizeNombre(body.nombre!);

  const duplicado = await findUsernameDuplicado(username);
  if (duplicado) {
    return NextResponse.json({ error: "Ya existe un usuario con ese nombre de usuario" }, { status: 409 });
  }

  const passwordHash = await hashPassword(body.password!);

  const usuario = await prisma.user.create({
    data: {
      nombre,
      username,
      password: passwordHash,
      role,
    },
  });

  return NextResponse.json(serializeUsuario(usuario), { status: 201 });
}
