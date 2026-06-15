import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeNombre } from "@/lib/api-auth";

const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 10): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += PASSWORD_CHARS[Math.floor(Math.random() * PASSWORD_CHARS.length)];
  }
  return result;
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function validateUsername(username: string): string | null {
  const normalized = normalizeUsername(username);
  if (!normalized) return "El usuario es obligatorio";
  if (normalized.length < 3) return "El usuario debe tener al menos 3 caracteres";
  if (normalized.length > 64) return "El usuario no puede superar 64 caracteres";
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    return "Solo letras, números, puntos, guiones y guión bajo";
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 6) {
    return "La contraseña debe tener al menos 6 caracteres";
  }
  if (password.length > 128) {
    return "La contraseña es demasiado larga";
  }
  return null;
}

export function validateNombreUsuario(nombre: string): string | null {
  const n = normalizeNombre(nombre);
  if (!n) return "El nombre es obligatorio";
  if (n.length > 120) return "El nombre no puede superar 120 caracteres";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function findUsernameDuplicado(username: string, excludeId?: string) {
  return prisma.user.findFirst({
    where: {
      username: { equals: normalizeUsername(username), mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function usuarioTieneHistorial(userId: string): Promise<boolean> {
  const [asignaciones, conteos, noCatalogados, tomasCreadas] = await Promise.all([
    prisma.asignacionInventarioArea.count({ where: { usuarioId: userId } }),
    prisma.conteoInventario.count({ where: { usuarioId: userId } }),
    prisma.productoNoCatalogado.count({ where: { usuarioId: userId } }),
    prisma.asignacionInventarioArea.count({ where: { creadoPorId: userId } }),
  ]);
  return asignaciones + conteos + noCatalogados + tomasCreadas > 0;
}

export async function countSupervisoresActivos(excludeId?: string): Promise<number> {
  return prisma.user.count({
    where: {
      role: Role.SUPERVISOR,
      activo: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function assertPuedeDesactivar(
  targetUserId: string,
  sessionUserId: string
): Promise<{ error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) return { error: "Usuario no encontrado" };

  if (user.role === Role.SUPERVISOR && user.activo) {
    const otrosActivos = await countSupervisoresActivos(targetUserId);
    if (targetUserId === sessionUserId && otrosActivos === 0) {
      return {
        error: "No puedes desactivarte: eres el único supervisor activo",
      };
    }
    if (otrosActivos === 0) {
      return {
        error: "Debe haber al menos un supervisor activo en el sistema",
      };
    }
  }

  return {};
}

export function serializeUsuario(u: {
  id: string;
  nombre: string;
  username: string;
  role: Role;
  activo: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    nombre: u.nombre,
    username: u.username,
    role: u.role,
    activo: u.activo,
    createdAt: u.createdAt.toISOString(),
  };
}
