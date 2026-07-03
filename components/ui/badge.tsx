import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.2em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-secondary/30 bg-secondary/15 text-secondary hover:bg-secondary/25",
        secondary:
          "border-secondary/30 bg-secondary/10 text-secondary hover:bg-secondary/20",
        destructive:
          "border-destructive/40 bg-destructive/20 text-destructive-foreground hover:bg-destructive/30",
        outline: "text-foreground border-border/70 bg-transparent",
        success: "border-transparent bg-green-500/20 text-green-400 hover:bg-green-500/30",
        info: "border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20",
        warning: "border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20",
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
