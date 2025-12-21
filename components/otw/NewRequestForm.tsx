"use client"

import { useState, useTransition } from "react"
import { createRequestAction } from "@/app/actions/request"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from "lucide-react"

export function NewRequestForm() {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  async function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createRequestAction(formData)
        toast({
          title: "Request created",
          description: "We've received your request and will assign a driver shortly.",
        })
      } catch (error) {
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>New Delivery Request</CardTitle>
        <CardDescription>Tell us what you need and where it needs to go.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="serviceType" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Service Type
            </label>
            <Select name="serviceType" defaultValue="FOOD" className="bg-otwBlack border-white/10 text-white">
              <option value="FOOD">🍔 Food Pickup</option>
              <option value="STORE">🛒 Store / Grocery</option>
              <option value="FRAGILE">📦 Fragile / White Glove</option>
              <option value="CONCIERGE">🏁 Custom Concierge</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="pickup" className="text-sm font-medium leading-none">Pickup Address</label>
              <Input id="pickup" name="pickup" placeholder="123 Main St, Restaurant Name" required />
            </div>
            <div className="space-y-2">
              <label htmlFor="dropoff" className="text-sm font-medium leading-none">Dropoff Address</label>
              <Input id="dropoff" name="dropoff" placeholder="456 Home Ave, Apt 4B" required />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium leading-none">Notes (Optional)</label>
            <Textarea 
              id="notes" 
              name="notes" 
              placeholder="Gate code, special instructions, order details..." 
              className="min-h-[100px]"
            />
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full bg-otwGold text-otwBlack hover:bg-otwGold/90 font-bold" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Request...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
            <p className="text-xs text-center text-white/50 mt-4">
              Estimated price will be calculated based on distance and service type.
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
