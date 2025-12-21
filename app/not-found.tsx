import Link from 'next/link'
import { Button } from '@/components/ui/button'
 
export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-otwBlack text-otwOffWhite">
      <h2 className="text-4xl font-bold text-otwGold">404 - Not Found</h2>
      <p className="mt-4 text-lg opacity-80">Could not find requested resource</p>
      <Button asChild className="mt-8" variant="default">
        <Link href="/">Return Home</Link>
      </Button>
    </div>
  )
}
