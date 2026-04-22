import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    name: session.user.name || session.user.email || "Usuario",
    email: session.user.email || "",
    role: (session.user as { role?: string }).role || "LECTOR",
  };

  return (
    <Providers>
      <AppShell user={user}>{children}</AppShell>
    </Providers>
  );
}
