import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffApi } from "@/lib/api-auth";
import {
  findUsernameDuplicado,
  hashPassword,
  normalizeUsername,
  serializeUsuario,
  validatePassword,
  validateUsername,
} from "@/lib/usuarios";
import { puedeCrearRol } from "@/lib/roles";

export async function GET() {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const usuarios = await prisma.user.findMany({
    orderBy: [{ activo: "desc" }, { username: "asc" }],
  });

  return NextResponse.json(usuarios.map(serializeUsuario));
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  let body: {
    username?: string;
    password?: string;
    role?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const usernameError = validateUsername(body.username ?? "");
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const passwordError = validatePassword(body.password ?? "");
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  let role: Role = Role.TOMADOR;
  if (body.role === Role.SUPERVISOR) role = Role.SUPERVISOR;
  else if (body.role === Role.ADMIN_TECNOLOGIA) role = Role.ADMIN_TECNOLOGIA;
  else if (body.role === Role.TOMADOR) role = Role.TOMADOR;

  if (!puedeCrearRol(auth.session.user.role, role)) {
    return NextResponse.json(
      { error: "No tienes permiso para crear usuarios con ese rol" },
      { status: 403 }
    );
  }

  const username = normalizeUsername(body.username!);

  const duplicado = await findUsernameDuplicado(username);
  if (duplicado) {
    return NextResponse.json({ error: "Ya existe un usuario con ese nombre" }, { status: 409 });
  }

  const passwordHash = await hashPassword(body.password!);

  const usuario = await prisma.user.create({
    data: {
      nombre: username,
      username,
      password: passwordHash,
      role,
    },
  });

  return NextResponse.json(serializeUsuario(usuario), { status: 201 });
}
