import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffApi } from "@/lib/api-auth";
import {
  assertPuedeDesactivar,
  findUsernameDuplicado,
  generatePassword,
  hashPassword,
  normalizeUsername,
  serializeUsuario,
  usuarioTieneHistorial,
  validatePassword,
  validateUsername,
} from "@/lib/usuarios";
import {
  puedeCrearRol,
  puedeDesactivarUsuario,
  puedeEditarUsuario,
  puedeRestablecerPassword,
} from "@/lib/roles";

type RouteParams = { params: { id: string } };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const usuario = await prisma.user.findUnique({ where: { id: params.id } });
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const editError = puedeEditarUsuario(auth.session.user.id, auth.session.user.role, {
    id: usuario.id,
    role: usuario.role,
  });
  if (editError) {
    return NextResponse.json({ error: editError }, { status: 403 });
  }

  let body: {
    username?: string;
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
    const desactivarError = puedeDesactivarUsuario(
      auth.session.user.id,
      auth.session.user.role,
      { id: usuario.id, role: usuario.role }
    );
    if (desactivarError) {
      return NextResponse.json({ error: desactivarError }, { status: 403 });
    }
    const check = await assertPuedeDesactivar(params.id, auth.session.user.id);
    if (check.error) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }

  const updateData: {
    nombre?: string;
    username?: string;
    role?: Role;
    activo?: boolean;
    password?: string;
  } = {};

  if (body.username !== undefined) {
    const usernameError = validateUsername(body.username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }
    const username = normalizeUsername(body.username);
    const duplicado = await findUsernameDuplicado(username, params.id);
    if (duplicado) {
      return NextResponse.json({ error: "Ya existe un usuario con ese nombre" }, { status: 409 });
    }
    updateData.username = username;
    updateData.nombre = username;
  }

  if (body.role !== undefined) {
    let newRole: Role = Role.TOMADOR;
    if (body.role === Role.SUPERVISOR) newRole = Role.SUPERVISOR;
    else if (body.role === Role.ADMIN_TECNOLOGIA) newRole = Role.ADMIN_TECNOLOGIA;

    if (!puedeCrearRol(auth.session.user.role, newRole)) {
      return NextResponse.json(
        { error: "No tienes permiso para asignar ese rol" },
        { status: 403 }
      );
    }

    if (usuario.role === Role.SUPERVISOR && newRole !== Role.SUPERVISOR && usuario.activo) {
      const check = await assertPuedeDesactivar(params.id, auth.session.user.id);
      if (check.error) {
        return NextResponse.json(
          { error: "No se puede cambiar el rol del único supervisor activo" },
          { status: 400 }
        );
      }
    }
    updateData.role = newRole;
  }

  if (body.activo !== undefined) {
    updateData.activo = body.activo;
  }

  let passwordGenerada: string | undefined;

  if (body.restablecerPassword) {
    const pwdError = puedeRestablecerPassword(
      auth.session.user.id,
      auth.session.user.role,
      { id: usuario.id, role: usuario.role }
    );
    if (pwdError) {
      return NextResponse.json({ error: pwdError }, { status: 403 });
    }

    const plain = body.nuevaPassword?.trim() || generatePassword();
    if (body.nuevaPassword?.trim()) {
      const validateErr = validatePassword(plain);
      if (validateErr) {
        return NextResponse.json({ error: validateErr }, { status: 400 });
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
  const auth = await requireStaffApi();
  if ("error" in auth) return auth.error;

  const usuario = await prisma.user.findUnique({ where: { id: params.id } });
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const desactivarError = puedeDesactivarUsuario(
    auth.session.user.id,
    auth.session.user.role,
    { id: usuario.id, role: usuario.role }
  );
  if (desactivarError) {
    return NextResponse.json({ error: desactivarError }, { status: 403 });
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
