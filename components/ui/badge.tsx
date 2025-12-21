import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-otwRed text-white hover:bg-otwRed/80",
        secondary:
          "border-transparent bg-otwGold text-otwBlack hover:bg-otwGold/80",
        destructive:
          "border-transparent bg-red-900 text-white hover:bg-red-900/80",
        outline: "text-otwOffWhite border-white/20",
        success: "border-transparent bg-green-900/50 text-green-100 border-green-500/20",
        warning: "border-transparent bg-yellow-900/50 text-yellow-100 border-yellow-500/20",
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
