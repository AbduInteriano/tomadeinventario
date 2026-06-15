import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

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

export async function requireRole(role: Role) {
  const session = await requireAuth();
  if (session.user.role !== role) {
    redirect(session.user.role === Role.SUPERVISOR ? "/supervisor" : "/tomador");
  }
  return session;
}
