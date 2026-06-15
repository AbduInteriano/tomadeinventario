import { requireConteoRole } from "@/lib/session";

export default async function TomadorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireConteoRole();
  return <div className="min-h-screen bg-slate-100">{children}</div>;
}
