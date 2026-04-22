import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-[var(--muted-foreground)] mt-1">{description}</p>
      </div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Construction className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>En construcción</CardTitle>
              <CardDescription>{phase}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
