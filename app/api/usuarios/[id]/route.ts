import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSupervisorApi, normalizeNombre } from "@/lib/api-auth";
import {
  assertPuedeDesactivar,
  findEmailDuplicado,
  generatePassword,
  hashPassword,
  normalizeEmail,
  serializeUsuario,
  usuarioTieneHistorial,
  validateEmail,
  validateNombreUsuario,
  validatePassword,
} from "@/lib/usuarios";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const usuario = await prisma.user.findUnique({ where: { id: params.id } });
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  let body: {
    nombre?: string;
    email?: string;
    role?: string;
    activo?: boolean;
    restablecerPassword?: boolean;
    nuevaPassword?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (body.activo === false && usuario.activo) {
    const check = await assertPuedeDesactivar(params.id, auth.session.user.id);
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }

  const updateData: {
    nombre?: string;
    email?: string;
    role?: Role;
    activo?: boolean;
    password?: string;
  } = {};

  if (body.nombre !== undefined) {
    const nombreError = validateNombreUsuario(body.nombre);
    if (nombreError) {
      return NextResponse.json({ error: nombreError }, { status: 400 });
    }
    updateData.nombre = normalizeNombre(body.nombre);
  }

  if (body.email !== undefined) {
    const emailError = validateEmail(body.email);
    if (emailError) {
      return NextResponse.json({ error: emailError }, { status: 400 });
    }
    const email = normalizeEmail(body.email);
    const duplicado = await findEmailDuplicado(email, params.id);
    if (duplicado) {
      return NextResponse.json({ error: "Ya existe un usuario con ese email" }, { status: 409 });
    }
    updateData.email = email;
  }

  if (body.role !== undefined) {
    if (usuario.role === Role.SUPERVISOR && body.role !== Role.SUPERVISOR && usuario.activo) {
      const check = await assertPuedeDesactivar(params.id, auth.session.user.id);
      if (check.error) {
        return NextResponse.json(
          { error: "No se puede cambiar el rol del único supervisor activo" },
          { status: 400 }
        );
      }
    }
    updateData.role = body.role === Role.SUPERVISOR ? Role.SUPERVISOR : Role.TOMADOR;
  }

  if (body.activo !== undefined) {
    updateData.activo = body.activo;
  }

  let passwordGenerada: string | undefined;

  if (body.restablecerPassword) {
    const plain = body.nuevaPassword?.trim() || generatePassword();
    if (body.nuevaPassword?.trim()) {
      const pwdError = validatePassword(plain);
      if (pwdError) {
        return NextResponse.json({ error: pwdError }, { status: 400 });
      }
    }
    updateData.password = await hashPassword(plain);
    passwordGenerada = plain;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({
    ...serializeUsuario(updated),
    ...(passwordGenerada ? { passwordGenerada } : {}),
  });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requireSupervisorApi();
  if ("error" in auth) return auth.error;

  const usuario = await prisma.user.findUnique({ where: { id: params.id } });
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const check = await assertPuedeDesactivar(params.id, auth.session.user.id);
  if (check.error) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  const tieneHistorial = await usuarioTieneHistorial(params.id);

  if (tieneHistorial) {
    await prisma.user.update({
      where: { id: params.id },
      data: { activo: false },
    });

    return NextResponse.json({
      id: params.id,
      softDeleted: true,
      message:
        "Usuario desactivado porque tiene historial de inventarios o conteos.",
    });
  }

  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({
    id: params.id,
    softDeleted: false,
    message: "Usuario eliminado correctamente",
  });
}
