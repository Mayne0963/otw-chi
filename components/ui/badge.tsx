import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-primary-foreground hover:bg-primary/25",
        secondary:
          "border-secondary/40 bg-secondary/20 text-secondary-foreground hover:bg-secondary/30",
        destructive:
          "border-destructive/40 bg-destructive/20 text-destructive-foreground hover:bg-destructive/30",
        outline: "text-foreground border-border/70 bg-transparent",
        success: "border-secondary/40 bg-secondary/15 text-secondary",
        warning: "border-primary/40 bg-primary/15 text-primary",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
