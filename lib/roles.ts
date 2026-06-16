import { Role } from "@prisma/client";

export function isAdminTecnologia(role: Role): boolean {
  return role === Role.ADMIN_TECNOLOGIA;
}

export function canAccessSupervisor(role: Role): boolean {
  return role === Role.SUPERVISOR || role === Role.ADMIN_TECNOLOGIA;
}

export function canPerformConteo(role: Role): boolean {
  return (
    role === Role.TOMADOR ||
    role === Role.SUPERVISOR ||
    role === Role.ADMIN_TECNOLOGIA
  );
}

export function canManageUsers(role: Role): boolean {
  return role === Role.SUPERVISOR || role === Role.ADMIN_TECNOLOGIA;
}

export function homePathForRole(role: Role): string {
  return canAccessSupervisor(role) ? "/supervisor" : "/tomador";
}

export function roleLabel(role: Role): string {
  switch (role) {
    case Role.ADMIN_TECNOLOGIA:
      return "Admin tecnología";
    case Role.SUPERVISOR:
      return "Supervisor";
    default:
      return "Tomador";
  }
}

/** Roles que un supervisor puede asignar al crear o editar usuarios */
export function rolesAsignablesPorSupervisor(): Role[] {
  return [Role.TOMADOR, Role.SUPERVISOR];
}

export function puedeCrearRol(actorRole: Role, targetRole: Role): boolean {
  if (targetRole === Role.ADMIN_TECNOLOGIA) {
    return actorRole === Role.ADMIN_TECNOLOGIA;
  }
  if (actorRole === Role.ADMIN_TECNOLOGIA) return true;
  if (actorRole === Role.SUPERVISOR) {
    return targetRole === Role.TOMADOR || targetRole === Role.SUPERVISOR;
  }
  return false;
}

export function puedeEditarUsuario(
  actorId: string,
  actorRole: Role,
  target: { id: string; role: Role }
): string | null {
  if (target.role === Role.ADMIN_TECNOLOGIA && actorId !== target.id) {
    return "No puedes modificar al administrador de tecnología";
  }
  if (!canManageUsers(actorRole)) {
    return "No autorizado";
  }
  return null;
}

export function puedeRestablecerPassword(
  actorId: string,
  actorRole: Role,
  target: { id: string; role: Role }
): string | null {
  if (target.role === Role.ADMIN_TECNOLOGIA && actorId !== target.id) {
    return "Solo el administrador de tecnología puede cambiar su propia contraseña";
  }
  if (actorRole === Role.ADMIN_TECNOLOGIA) return null;
  if (actorRole === Role.SUPERVISOR) {
    if (target.role === Role.TOMADOR) return null;
    return "El supervisor solo puede restablecer contraseñas de tomadores";
  }
  return "No autorizado";
}

export function puedeDesactivarUsuario(
  actorId: string,
  actorRole: Role,
  target: { id: string; role: Role }
): string | null {
  if (target.role === Role.ADMIN_TECNOLOGIA) {
    return "No se puede desactivar al administrador de tecnología";
  }
  return puedeEditarUsuario(actorId, actorRole, target);
}
