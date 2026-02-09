import OtwPageShell from "@/components/ui/otw/OtwPageShell";
import OtwSectionHeader from "@/components/ui/otw/OtwSectionHeader";
import OtwCard from "@/components/ui/otw/OtwCard";
import { getCurrentUser } from "@/lib/auth/roles";
import { getPrisma } from "@/lib/db";
import { ServiceType, FounderEnergyLevel } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  serviceType: z.nativeEnum(ServiceType),
  milesCharged: z.coerce.number().int().min(1).max(10_000),
  activeMinutes: z.coerce.number().int().min(1).max(24 * 60),
  energy: z.nativeEnum(FounderEnergyLevel),
  wouldDoAgain: z.coerce.boolean(),
  notes: z.string().max(500).optional(),
});

async function createLog(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  if (user.role !== "DRIVER" && user.role !== "ADMIN") throw new Error("Forbidden");

  const parsed = createSchema.safeParse({
    serviceType: String(formData.get("serviceType") ?? ""),
    milesCharged: formData.get("milesCharged"),
    activeMinutes: formData.get("activeMinutes"),
    energy: String(formData.get("energy") ?? ""),
    wouldDoAgain: formData.get("wouldDoAgain") === "on",
    notes: String(formData.get("notes") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    throw new Error("Invalid log entry");
  }

  const prisma = getPrisma();
  await prisma.founderServiceLog.create({
    data: {
      userId: user.id,
      serviceType: parsed.data.serviceType,
      milesCharged: parsed.data.milesCharged,
      activeMinutes: parsed.data.activeMinutes,
      energy: parsed.data.energy,
      wouldDoAgain: parsed.data.wouldDoAgain,
      notes: parsed.data.notes ?? null,
    },
  });

  revalidatePath("/driver/founder-log");
}

export default async function FounderLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.role !== "DRIVER" && user.role !== "ADMIN") redirect("/");

  const prisma = getPrisma();

  const logs = await prisma.founderServiceLog.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <OtwPageShell>
      <OtwSectionHeader
        title="Founder Log"
        subtitle="Track service type, miles charged, time, and energy for pricing decisions."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OtwCard className="p-5 sm:p-6">
          <div className="text-sm font-semibold">New Entry</div>
          <form action={createLog} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Service Type</div>
                <select
                  name="serviceType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={ServiceType.FOOD}
                  required
                >
                  {Object.values(ServiceType).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Miles Charged</div>
                <input
                  name="milesCharged"
                  type="number"
                  min={1}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Time Spent (min)</div>
                <input
                  name="activeMinutes"
                  type="number"
                  min={1}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Energy Level</div>
                <select
                  name="energy"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  defaultValue={FounderEnergyLevel.EASY}
                  required
                >
                  {Object.values(FounderEnergyLevel).map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input name="wouldDoAgain" type="checkbox" defaultChecked />
                Would do again
              </label>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-md bg-otwGold px-4 text-sm font-semibold text-otwBlack"
              >
                Save
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Notes</div>
              <textarea
                name="notes"
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                maxLength={500}
              />
            </div>
          </form>
        </OtwCard>

        <OtwCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Recent Entries</div>
            <div className="text-xs text-muted-foreground">{logs.length} shown</div>
          </div>
          {logs.length ? (
            <div className="mt-4 space-y-3">
              {logs.map((l) => (
                <div key={l.id} className="rounded-lg border border-border/60 bg-card/60 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">{l.serviceType}</div>
                    <div className="text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Miles: <span className="text-foreground font-medium">{l.milesCharged}</span></div>
                    <div className="text-muted-foreground">Minutes: <span className="text-foreground font-medium">{l.activeMinutes}</span></div>
                    <div className="text-muted-foreground">Energy: <span className="text-foreground font-medium">{l.energy}</span></div>
                    <div className="text-muted-foreground">Again: <span className="text-foreground font-medium">{l.wouldDoAgain ? "Yes" : "No"}</span></div>
                  </div>
                  {l.notes ? <div className="mt-2 text-sm text-muted-foreground">{l.notes}</div> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-muted-foreground">No entries yet.</div>
          )}
        </OtwCard>
      </div>
    </OtwPageShell>
  );
}
