import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homePathForRole } from "@/lib/roles";

export default async function HomePage() {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  redirect(homePathForRole(session.user.role));
}
