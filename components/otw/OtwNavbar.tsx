import React from 'react';

const OtwNavbar: React.FC = () => {
  return (
    <header className="bg-otwRed shadow-otwSoft rounded-b-2xl">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-otwGold text-2xl font-semibold">OTW</span>
          <span className="text-otwGold/90 text-sm">On The Way</span>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-sm">
          <a href="/" className="hover:underline">Home</a>
          <a href="/dashboard" className="hover:underline">Dashboard</a>
          <a href="/driver/jobs" className="hover:underline">Driver Jobs</a>
          <a href="/membership/manage" className="hover:underline">Membership</a>
          <a href="/wallet/nip" className="hover:underline">NIP Wallet</a>
        </nav>
      </div>
    </header>
  );
};

export default OtwNavbar;
