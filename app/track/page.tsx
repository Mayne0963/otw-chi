import { getUserRequests } from "@/app/actions/request";
import { getCurrentUser } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TrackLandingPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="otw-container otw-section space-y-6">
        <PageHeader
          title="Track My Driver"
          subtitle="Sign in to view your active and past deliveries."
        />
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>We’ll take you back here after you sign in.</p>
            <Button asChild className="w-full">
              <Link href="/sign-in?redirect_url=/track">Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sign-up?redirect_url=/track">Create account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requests = await getUserRequests();

  return (
    <div className="otw-container otw-section space-y-6">
      <PageHeader
        title="Track My Driver"
        subtitle="Live status, ETA, and route preview for your deliveries."
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No deliveries yet"
          description="Place a delivery request to start tracking."
          action={{ label: "Place an order", href: "/order" }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {requests.map((request) => (
            <Card key={request.id} className="border-border/70 bg-card/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{request.serviceType}</span>
                  <Badge variant="outline">{request.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em]">Pickup</div>
                  <div className="text-foreground">{request.pickup}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.18em]">Dropoff</div>
                  <div className="text-foreground">{request.dropoff}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(request.createdAt)}
                </div>
                <Button asChild className="w-full">
                  <Link href={`/track/${request.id}`}>View tracking</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
