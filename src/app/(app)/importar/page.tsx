import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canEditReports } from "@/lib/roles";
import { ImportarClient } from "./importar-client";

export const dynamic = "force-dynamic";

export default async function ImportarPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!canEditReports(role)) redirect("/");
  return <ImportarClient />;
}
