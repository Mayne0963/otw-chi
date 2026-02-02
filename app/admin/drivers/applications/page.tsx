import { requireRole } from '@/lib/auth/roles';
import { getPrisma } from '@/lib/db';
import OtwPageShell from '@/components/ui/otw/OtwPageShell';
import OtwSectionHeader from '@/components/ui/otw/OtwSectionHeader';
import OtwCard from '@/components/ui/otw/OtwCard';
import OtwButton from '@/components/ui/otw/OtwButton';
import OtwEmptyState from '@/components/ui/otw/OtwEmptyState';
import { revalidatePath } from 'next/cache';
import { DriverApplicationStatus, DriverCandidateProfile } from '@prisma/client';

export default async function AdminDriverApplicationsPage() {
  await requireRole(['ADMIN']);
  const prisma = getPrisma();
  
  const applications = await prisma.driverApplication.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  const interviewTemplate = {
    timePatience: 'Tell me about a time you had to wait longer than expected for something important. How did you handle it?',
    customerCare: 'If a customer is frustrated but not disrespectful, how do you respond?',
    instructions: "If a customer gives clear instructions, but you think there’s a faster way, what do you do?",
    values: 'What made you apply to OTW instead of other delivery apps?',
    onboardingMessage:
      'OTW is a service company first, delivery second. We value patience, communication, and professionalism. If that sounds like you, you’ll thrive here.',
  };

  const scoreOptions = [1, 2, 3, 4, 5] as const;

  function parseScore(raw: FormDataEntryValue | null) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    const i = Math.trunc(n);
    if (i < 1 || i > 5) return null;
    return i;
  }

  async function updateStatus(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const status = formData.get('status') as 'APPROVED' | 'DENIED' | 'WAITLIST' | 'PENDING';
    
    if (!id || !status) return;
    
    const prisma = getPrisma();
    const app = await prisma.driverApplication.findUnique({ where: { id } });
    if (!app) return;

    await prisma.driverApplication.update({
        where: { id },
        data: { status },
    });

    if (status === 'APPROVED' && app.userId) {
        // Create Driver Profile
        await prisma.driverProfile.upsert({
            where: { userId: app.userId },
            create: { userId: app.userId, status: 'OFFLINE' },
            update: {},
        });

        // Update User Role in DB
        await prisma.user.update({
            where: { id: app.userId },
            data: { role: 'DRIVER' },
        });
    }
    
    revalidatePath('/admin/drivers/applications');
  }

  async function saveInterview(formData: FormData) {
    'use server';
    const id = String(formData.get('id') ?? '');
    if (!id) return;

    const patienceScore = parseScore(formData.get('patienceScore'));
    const communicationScore = parseScore(formData.get('communicationScore'));
    const reliabilityScore = parseScore(formData.get('reliabilityScore'));
    const attitudeScore = parseScore(formData.get('attitudeScore'));
    const alignmentScore = parseScore(formData.get('alignmentScore'));

    const candidateProfileRaw = String(formData.get('candidateProfile') ?? '').trim();
    const candidateProfile = (Object.values(DriverCandidateProfile) as string[]).includes(candidateProfileRaw)
      ? (candidateProfileRaw as DriverCandidateProfile)
      : null;

    const patienceAnswer = String(formData.get('patienceAnswer') ?? '').trim() || null;
    const customerCareAnswer = String(formData.get('customerCareAnswer') ?? '').trim() || null;
    const instructionsAnswer = String(formData.get('instructionsAnswer') ?? '').trim() || null;
    const whyOtwAnswer = String(formData.get('whyOtwAnswer') ?? '').trim() || null;
    const interviewNotes = String(formData.get('interviewNotes') ?? '').trim() || null;

    const scores = [patienceScore, communicationScore, reliabilityScore, attitudeScore, alignmentScore];
    const allScoresPresent = scores.every((s) => typeof s === 'number');
    const minScore = allScoresPresent ? Math.min(...(scores as number[])) : null;

    let nextStatus: DriverApplicationStatus | null = null;
    if (allScoresPresent && minScore !== null) {
      if (minScore >= 4) nextStatus = DriverApplicationStatus.APPROVED;
      else if (minScore >= 3) nextStatus = DriverApplicationStatus.WAITLIST;
      else nextStatus = DriverApplicationStatus.DENIED;
    }

    const prisma = getPrisma();
    const app = await prisma.driverApplication.findUnique({ where: { id } });
    if (!app) return;

    const updated = await prisma.driverApplication.update({
      where: { id },
      data: {
        candidateProfile,
        patienceScore,
        communicationScore,
        reliabilityScore,
        attitudeScore,
        alignmentScore,
        minScore,
        interviewNotes,
        patienceAnswer,
        customerCareAnswer,
        instructionsAnswer,
        whyOtwAnswer,
        scoredAt: allScoresPresent ? new Date() : null,
        status: nextStatus ?? app.status,
      },
    });

    if (updated.status === DriverApplicationStatus.APPROVED && app.userId) {
      await prisma.driverProfile.upsert({
        where: { userId: app.userId },
        create: { userId: app.userId, status: 'OFFLINE' },
        update: {},
      });

      await prisma.user.update({
        where: { id: app.userId },
        data: { role: 'DRIVER' },
      });
    }

    revalidatePath('/admin/drivers/applications');
  }

  return (
    <OtwPageShell>
      <OtwSectionHeader 
        title="Driver Applications" 
        subtitle="Review and approve driver applications."
      />

      <OtwCard className="mt-6 p-6">
        <div className="text-sm font-semibold text-white">Interview System (Verbatim)</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm text-white/80">
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Time & Patience Test</div>
            <div className="mt-2">{interviewTemplate.timePatience}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Customer Care Test</div>
            <div className="mt-2">{interviewTemplate.customerCare}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Instructions Test</div>
            <div className="mt-2">{interviewTemplate.instructions}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="text-xs uppercase tracking-wider text-white/50">Values Alignment Test</div>
            <div className="mt-2">{interviewTemplate.values}</div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <div className="text-xs uppercase tracking-wider text-white/50">Onboarding Message</div>
          <div className="mt-2">{interviewTemplate.onboardingMessage}</div>
        </div>
      </OtwCard>

      <div className="grid gap-4 mt-6">
        {applications.map((app) => (
            <OtwCard key={app.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="text-lg font-semibold text-white">{app.fullName}</div>
                        <p className="text-sm text-white/50">{app.email} • {app.phone}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                        app.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                        app.status === 'DENIED' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                        app.status === 'WAITLIST' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                        'bg-white/10 text-white/70 border border-white/20'
                    }`}>
                        {app.status}
                    </span>
                </div>
                <div>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                            <p className="text-white/50">City</p>
                            <p>{app.city}</p>
                        </div>
                        <div>
                            <p className="text-white/50">Vehicle</p>
                            <p>{app.vehicleType}</p>
                        </div>
                        {app.availability && (
                            <div className="col-span-2">
                                <p className="text-white/50">Availability</p>
                                <p>{app.availability}</p>
                            </div>
                        )}
                        {app.message && (
                            <div className="col-span-2">
                                <p className="text-white/50">Message</p>
                                <p>{app.message}</p>
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="text-sm font-semibold text-white">Scoring (1–5)</div>
                        <div className="mt-2 text-xs text-white/50">
                          Only onboard 4s and 5s. 3s go waitlist. Anything lower is a no.
                        </div>
                        <form action={saveInterview} className="mt-4 space-y-3">
                          <input type="hidden" name="id" value={app.id} />

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Candidate Profile</div>
                              <select
                                name="candidateProfile"
                                defaultValue={app.candidateProfile ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                              >
                                <option value="">Unspecified</option>
                                {Object.values(DriverCandidateProfile).map((p) => (
                                  <option key={p} value={p}>
                                    {p.replaceAll('_', ' ')}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Notes</div>
                              <input
                                name="interviewNotes"
                                defaultValue={app.interviewNotes ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                                placeholder="Interview notes (optional)"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-5">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Patience</div>
                              <select
                                name="patienceScore"
                                defaultValue={app.patienceScore ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm text-white"
                              >
                                <option value="">-</option>
                                {scoreOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Comms</div>
                              <select
                                name="communicationScore"
                                defaultValue={app.communicationScore ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm text-white"
                              >
                                <option value="">-</option>
                                {scoreOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Reliable</div>
                              <select
                                name="reliabilityScore"
                                defaultValue={app.reliabilityScore ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm text-white"
                              >
                                <option value="">-</option>
                                {scoreOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Attitude</div>
                              <select
                                name="attitudeScore"
                                defaultValue={app.attitudeScore ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm text-white"
                              >
                                <option value="">-</option>
                                {scoreOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Aligned</div>
                              <select
                                name="alignmentScore"
                                defaultValue={app.alignmentScore ?? ''}
                                className="w-full rounded-md border border-white/10 bg-black/20 px-2 py-2 text-sm text-white"
                              >
                                <option value="">-</option>
                                {scoreOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Time & Patience Answer</div>
                              <textarea
                                name="patienceAnswer"
                                defaultValue={app.patienceAnswer ?? ''}
                                className="h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Customer Care Answer</div>
                              <textarea
                                name="customerCareAnswer"
                                defaultValue={app.customerCareAnswer ?? ''}
                                className="h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Instructions Answer</div>
                              <textarea
                                name="instructionsAnswer"
                                defaultValue={app.instructionsAnswer ?? ''}
                                className="h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wider text-white/50 mb-1">Why OTW Answer</div>
                              <textarea
                                name="whyOtwAnswer"
                                defaultValue={app.whyOtwAnswer ?? ''}
                                className="h-20 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs text-white/50">
                              Min Score: <span className="text-white">{app.minScore ?? '-'}</span>
                            </div>
                            <OtwButton type="submit" variant="outline" className="h-8 text-xs">
                              Save Scoring
                            </OtwButton>
                          </div>
                        </form>
                      </div>

                      <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                        <div className="text-sm font-semibold text-white">Decision</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={app.id} />
                            <input type="hidden" name="status" value="APPROVED" />
                            <OtwButton type="submit" variant="outline" className="h-8 text-xs border-green-600/50 text-green-500 hover:bg-green-600/10 hover:text-green-400">
                              Approve
                            </OtwButton>
                          </form>
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={app.id} />
                            <input type="hidden" name="status" value="WAITLIST" />
                            <OtwButton type="submit" variant="outline" className="h-8 text-xs border-yellow-500/50 text-yellow-300 hover:bg-yellow-600/10 hover:text-yellow-200">
                              Waitlist
                            </OtwButton>
                          </form>
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={app.id} />
                            <input type="hidden" name="status" value="DENIED" />
                            <OtwButton type="submit" variant="red" className="h-8 text-xs">
                              Deny
                            </OtwButton>
                          </form>
                          <form action={updateStatus}>
                            <input type="hidden" name="id" value={app.id} />
                            <input type="hidden" name="status" value="PENDING" />
                            <OtwButton type="submit" variant="outline" className="h-8 text-xs">
                              Reset to Pending
                            </OtwButton>
                          </form>
                        </div>

                        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white/80">
                          <div className="text-xs uppercase tracking-wider text-white/50">Use This Verbatim</div>
                          <div className="mt-2">
                            OTW pays hourly for active time, plus bonuses for great service. Hit your times. Treat people right. Get 5 stars. You keep 100% of your tips.
                          </div>
                        </div>
                      </div>
                    </div>
                </div>
            </OtwCard>
        ))}
        {applications.length === 0 && (
            <OtwCard className="p-8 text-center">
                <OtwEmptyState 
                    title="No applications found" 
                    subtitle="Driver applications will appear here." 
                />
            </OtwCard>
        )}
      </div>
    </OtwPageShell>
  );
}
