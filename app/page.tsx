import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role === Role.SUPERVISOR) {
    redirect("/supervisor");
  }

  redirect("/tomador");
}
