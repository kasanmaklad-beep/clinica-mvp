"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccordionProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  colorClass?: string;
}

export function AccordionSection({ title, subtitle, badge, defaultOpen = false, children, colorClass = "bg-[var(--primary)]" }: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", colorClass)} />
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          {subtitle && <div className="text-xs text-[var(--muted-foreground)] truncate">{subtitle}</div>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
        <ChevronDown className={cn("h-4 w-4 text-[var(--muted-foreground)] shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-[var(--border)] p-4">{children}</div>}
    </div>
  );
}
