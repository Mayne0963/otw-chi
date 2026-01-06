import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-0.5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-otwSoft hover:bg-primary/90 hover:shadow-otwGlow",
        destructive:
          "bg-destructive text-destructive-foreground shadow-otwSoft hover:bg-destructive/90",
        outline:
          "border border-border/70 bg-transparent text-foreground shadow-sm hover:border-primary/60 hover:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground shadow-otwSoft hover:bg-secondary/90 hover:shadow-otwGlow",
        ghost: "bg-transparent text-foreground hover:bg-muted/70",
        link: "text-primary underline underline-offset-4 hover:text-primary/80",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-md px-3 text-xs tracking-wide",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const isDisabled = disabled || isLoading

    if (asChild) {
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          aria-busy={isLoading || undefined}
          aria-disabled={isDisabled || undefined}
          data-loading={isLoading ? "true" : undefined}
          {...props}
        >
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        data-loading={isLoading ? "true" : undefined}
        {...props}
      >
        {isLoading && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          />
        )}
        <span className={cn(isLoading && "opacity-80")}>{children}</span>
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
