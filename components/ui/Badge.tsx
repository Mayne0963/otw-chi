import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/cn"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-otw-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-otw-primary text-white hover:bg-otw-primaryHover",
        secondary:
          "border-transparent bg-otw-accent text-otw-bg hover:bg-yellow-400",
        outline: "text-otw-text",
        success: "border-transparent bg-otw-success/20 text-otw-success",
        warning: "border-transparent bg-otw-warning/20 text-otw-warning",
        destructive:
          "border-transparent bg-otw-error/20 text-otw-error",
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
