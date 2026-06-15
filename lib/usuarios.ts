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

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return "El email es obligatorio";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return "Email inválido";
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

export async function findEmailDuplicado(email: string, excludeId?: string) {
  return prisma.user.findFirst({
    where: {
      email: { equals: normalizeEmail(email), mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function usuarioTieneHistorial(userId: string): Promise<boolean> {
  const [asignaciones, conteos, noCatalogados, inventarios] = await Promise.all([
    prisma.asignacionInventarioArea.count({ where: { usuarioId: userId } }),
    prisma.conteoInventario.count({ where: { usuarioId: userId } }),
    prisma.productoNoCatalogado.count({ where: { usuarioId: userId } }),
    prisma.inventario.count({ where: { creadoPorId: userId } }),
  ]);
  return asignaciones + conteos + noCatalogados + inventarios > 0;
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
  email: string;
  role: Role;
  activo: boolean;
  createdAt: Date;
}) {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    role: u.role,
    activo: u.activo,
    createdAt: u.createdAt.toISOString(),
  };
}
