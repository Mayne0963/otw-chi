import { cn } from "@/lib/utils"
import { Button } from "./button"
import Link from "next/link"

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: string
  action?: {
    label: string
    href: string
    variant?: "default" | "secondary" | "outline"
  }
}

export function PageHeader({ 
  title, 
  subtitle, 
  action, 
  className, 
  ...props 
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8", className)} {...props}>
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground font-display">{title}</h1>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
      </div>
      {action && (
        <Button asChild variant={action.variant || "default"}>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  )
}
