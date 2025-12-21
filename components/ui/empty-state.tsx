import { LucideIcon } from "lucide-react"
import { Button } from "./button"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    href: string
  }
  className?: string
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center border border-dashed border-white/20 rounded-2xl bg-white/5", className)}>
      {Icon && (
        <div className="p-4 rounded-full bg-white/5 mb-4">
          <Icon className="w-8 h-8 text-otwGold" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-otwOffWhite mb-2">{title}</h3>
      <p className="text-white/50 max-w-sm mb-6">{description}</p>
      {action && (
        <Button asChild variant="outline">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  )
}
