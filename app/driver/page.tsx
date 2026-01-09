import DriverMapClient from "./DriverMapClient";

export const dynamic = "force-dynamic";

export default function DriverPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <DriverMapClient />
    </div>
  );
}
