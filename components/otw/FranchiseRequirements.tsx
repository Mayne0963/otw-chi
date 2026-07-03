"use client";

import React from "react";
import OtwCard from "@/components/ui/otw/OtwCard";

const FranchiseRequirements: React.FC = () => {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-otwOffWhite">OTW Franchise Path</h2>
        <p className="text-white/80 max-w-3xl">
          OTW isn&apos;t just a gig. It&apos;s a path from <strong className="text-otwGold">driver</strong> to <strong className="text-otwGold">owner</strong>. Your
          franchise score, rank, and habits determine when HQ taps you for your own lane.
        </p>
        <p className="text-sm text-white/60 max-w-3xl">
          These are guidelines, not strict guarantees. The system uses your <strong>completed jobs</strong>, <strong>cancellations</strong>,
          <strong> ratings</strong>, and <strong>TIREM earned</strong> to calculate your readiness.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* NOT ELIGIBLE */}
        <OtwCard className="bg-white/5">
          <h3 className="text-lg font-bold text-otwOffWhite">NOT ELIGIBLE</h3>
          <p className="text-xs uppercase tracking-wider text-white/50 mt-1">Just Getting Moving</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70 list-disc pl-4">
            <li>Very few completed OTW runs.</li>
            <li>Cancellations or no consistent activity yet.</li>
            <li>Ratings still building or not enough feedback.</li>
            <li>Little or no TIREM earned so far.</li>
          </ul>
          <p className="mt-4 text-xs text-white/60 bg-white/5 p-3 rounded-lg border border-white/10">
            <strong className="text-otwGold block mb-1">How to level up:</strong>
            Accept jobs, finish them cleanly, and avoid cancelling unless absolutely necessary.
          </p>
        </OtwCard>

        {/* SEED */}
        <OtwCard className="bg-white/5">
          <h3 className="text-lg font-bold text-otwOffWhite">SEED</h3>
          <p className="text-xs uppercase tracking-wider text-white/50 mt-1">Foundation Stage</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70 list-disc pl-4">
            <li>Dozens of completed runs.</li>
            <li>Cancellations are improving but still visible.</li>
            <li>Ratings trending positive, some 5-star feedback.</li>
            <li>Steady TIREM trickling in from completed jobs.</li>
          </ul>
          <p className="mt-4 text-xs text-white/60 bg-white/5 p-3 rounded-lg border border-white/10">
            <strong className="text-otwGold block mb-1">How to level up:</strong>
            Focus on on-time arrivals, professional communication, and saying &quot;yes&quot; to more jobs in your zone.
          </p>
        </OtwCard>

        {/* BRONZE */}
        <OtwCard className="bg-white/5">
          <h3 className="text-lg font-bold text-otwOffWhite">BRONZE</h3>
          <p className="text-xs uppercase tracking-wider text-white/50 mt-1">Solid Grinder</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70 list-disc pl-4">
            <li>Strong track record of completed runs.</li>
            <li>Low cancellation rate most weeks.</li>
            <li>Ratings generally 4.5+ with positive comments.</li>
            <li>TIREM balance and total earned both growing.</li>
          </ul>
          <p className="mt-4 text-xs text-white/60 bg-white/5 p-3 rounded-lg border border-white/10">
            <strong className="text-otwGold block mb-1">How to level up:</strong>
            Treat every run like an interview for ownership—clean car, clear updates, and problem-solving when customers are stressed.
          </p>
        </OtwCard>

        {/* SILVER */}
        <OtwCard className="bg-white/5">
          <h3 className="text-lg font-bold text-otwOffWhite">SILVER</h3>
          <p className="text-xs uppercase tracking-wider text-white/50 mt-1">Trusted OTW Driver</p>
          <ul className="mt-4 space-y-2 text-sm text-white/70 list-disc pl-4">
            <li>High number of completed jobs across different service types.</li>
            <li>Very low cancellation rate.</li>
            <li>Consistent high ratings and repeat customers.</li>
            <li>TIREM total earned shows real commitment and time in.</li>
          </ul>
          <p className="mt-4 text-xs text-white/60 bg-white/5 p-3 rounded-lg border border-white/10">
            <strong className="text-otwGold block mb-1">How to level up:</strong>
            Stay consistent, avoid burnout, and maintain your standards even on slow or late-night runs.
          </p>
        </OtwCard>

        {/* GOLD */}
        <OtwCard variant="gold" className="bg-otwGold/10 border-otwGold/30">
          <h3 className="text-lg font-bold text-otwGold">GOLD</h3>
          <p className="text-xs uppercase tracking-wider text-otwGold/70 mt-1">Franchise Material</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80 list-disc pl-4 marker:text-otwGold">
            <li>Very strong job volume and completion rate.</li>
            <li>Almost no cancellations without a real reason.</li>
            <li>Ratings in the top tier of all OTW drivers.</li>
            <li>TIREM total that reflects heavy, long-term movement.</li>
          </ul>
          <p className="mt-4 text-xs text-white/70 bg-otwGold/5 p-3 rounded-lg border border-otwGold/20">
            <strong className="text-otwGold block mb-1">How to level up:</strong>
            Start thinking like a leader—help new drivers, learn your city deeply, and keep your record clean. You&apos;re in real franchise conversation territory.
          </p>
        </OtwCard>

        {/* PLATINUM */}
        <OtwCard className="bg-gradient-to-br from-white/10 to-white/5 border-white/20">
          <h3 className="text-lg font-bold text-white">PLATINUM</h3>
          <p className="text-xs uppercase tracking-wider text-white/60 mt-1">Leader of the Pack</p>
          <ul className="mt-4 space-y-2 text-sm text-white/80 list-disc pl-4 marker:text-white">
            <li>Top-percentage performance across the whole platform.</li>
            <li>Almost perfect reliability and very rare cancellations.</li>
            <li>Near 5.0 average rating with glowing feedback.</li>
            <li>Heavy TIREM earnings from long-term consistent work.</li>
          </ul>
          <p className="mt-4 text-xs text-white/70 bg-white/10 p-3 rounded-lg border border-white/20">
            <strong className="text-white block mb-1">How to level up:</strong>
            Document your habits, build routines, and get ready to operate OTW like a business, not just a side hustle.
          </p>
        </OtwCard>

        {/* EMPIRE */}
        <OtwCard className="bg-gradient-to-br from-otwBlack to-otwGold/20 border-otwGold shadow-[0_0_30px_rgba(255,215,0,0.1)] col-span-1 md:col-span-2 xl:col-span-3">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-otwGold">EMPIRE</h3>
              <p className="text-sm uppercase tracking-wider text-otwGold/70 mt-1">OTW Boss Status</p>
              <ul className="mt-6 space-y-3 text-base text-white/90 list-disc pl-4 marker:text-otwGold">
                <li>Elite numbers: jobs, ratings, and reliability.</li>
                <li>History of consistent, high-quality movement.</li>
                <li>Strong TIREM story and contribution to the ecosystem.</li>
                <li>Matches what HQ expects from a franchise-level partner.</li>
              </ul>
            </div>
            <div className="flex-1 md:max-w-xs bg-otwGold/10 p-5 rounded-xl border border-otwGold/20">
              <p className="text-sm text-white/80 leading-relaxed">
                <strong className="text-otwGold block mb-2 text-base">What this means:</strong>
                You are moving like an owner. Drivers at this level are the first in line when OTW opens up franchise slots in their zone.
              </p>
            </div>
          </div>
        </OtwCard>
      </section>

      <section className="pt-8 border-t border-white/10">
        <h3 className="text-lg font-semibold text-otwOffWhite mb-3">How the System Scores You</h3>
        <p className="text-sm text-white/60 mb-2 max-w-4xl">
          Behind the scenes, OTW calculates a <strong className="text-white">franchise score</strong> using your <strong className="text-white">completed jobs</strong>, <strong className="text-white">cancellation rate</strong>, <strong className="text-white">average rating</strong>, and <strong className="text-white">TIREM earned</strong>.
          That score turns into a rank. As you keep moving right, the system pushes you up naturally.
        </p>
        <p className="text-sm text-white/60 max-w-4xl">
          Your job is simple: <strong className="text-white">show up</strong>, <strong className="text-white">finish what you accept</strong>, <strong className="text-white">communicate clearly</strong>, and <strong className="text-white">deliver like you already own it</strong>. The more consistent the pattern, the louder your data speaks.
        </p>
      </section>
    </div>
  );
};

export default FranchiseRequirements;
