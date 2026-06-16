import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  canAccessSupervisor,
  canPerformConteo,
  homePathForRole,
} from "@/lib/roles";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireSupervisorAccess() {
  const session = await requireAuth();
  if (!canAccessSupervisor(session.user.role)) {
    redirect(homePathForRole(session.user.role));
  }
  return session;
}

/** @deprecated use requireSupervisorAccess */
export async function requireRole(role: Role) {
  const session = await requireAuth();
  if (session.user.role !== role) {
    redirect(homePathForRole(session.user.role));
  }
  return session;
}

export async function requireConteoRole() {
  const session = await requireAuth();
  if (!canPerformConteo(session.user.role)) {
    redirect("/login");
  }
  return session;
}
