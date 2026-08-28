import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight tracking-wide",
  {
    variants: {
      tone: {
        neutral: "border-paper-300 bg-paper-100 text-paper-600",
        official: "border-forest-200 bg-forest-50 text-forest-700",
        community: "border-ochre-200 bg-ochre-50 text-ochre-600",
        alert: "border-alert-100 bg-alert-50 text-alert-600",
        forest: "border-forest-700 bg-forest-700 text-paper-50",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
