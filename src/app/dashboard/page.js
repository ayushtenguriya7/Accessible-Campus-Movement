'use client';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline">
              <span className="font-extrabold text-2xl text-orange-500">U</span>
              <span className="font-extrabold text-2xl text-slate-900">NS</span>
            </div>
            <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase border-l border-slate-300 pl-3 hidden sm:inline">
              University Navigation System
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              Reg No: <strong className="text-slate-800 font-mono">11111111</strong>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Campus Route & Barrier Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Accessible pathways, obstacle reports, and maintenance updates across campus.
          </p>
        </div>

        {/* Map Placeholder Area */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm min-h-[360px] flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-500 mb-3 text-lg font-bold">
            📍
          </div>
          <h2 className="text-base font-semibold text-slate-800">
            Campus Interactive Map
          </h2>
          <p className="text-sm text-slate-500 max-w-md mt-1">
            Map view and route calculation will be displayed here.
          </p>
        </div>

        {/* Action Sections */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">
              Find Accessible Route
            </h3>
            <p className="text-xs text-slate-500">
              Check step-free paths between campus buildings.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">
              Report a Barrier
            </h3>
            <p className="text-xs text-slate-500">
              Submit reports for blocked ramps, locked gates, or broken lifts.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h3 className="font-semibold text-slate-800 text-sm mb-1">
              Resolution Updates
            </h3>
            <p className="text-xs text-slate-500">
              Track estate team clearance and maintenance tickets.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Campus Accessibility Portal &bull; Movement & Navigation
      </footer>
    </div>
  );
}
