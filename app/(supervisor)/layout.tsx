import { requireSupervisorAccess } from "@/lib/session";

export default async function SupervisorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSupervisorAccess();
  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
