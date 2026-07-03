import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="flex h-screen flex-col items-center justify-center space-y-4 bg-otwBlack">
      <div className="flex items-center space-x-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-otwGold border-t-transparent" />
      </div>
      <Skeleton className="h-4 w-[200px]" />
    </div>
  )
}
