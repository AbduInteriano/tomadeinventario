import { requireRole } from "@/lib/session";
import { Role } from "@prisma/client";

export default async function TomadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(Role.TOMADOR);
  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
