import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            "flex h-11 w-full appearance-none rounded-lg border border-border/70 bg-input px-3 py-2 text-sm text-foreground shadow-sm transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary/60",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        {/* Chevron down icon could be added here for custom styling */}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
