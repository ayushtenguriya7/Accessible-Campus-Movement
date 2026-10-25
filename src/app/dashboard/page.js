'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import RouteFinderCard from '../../components/RouteFinderCard';
import { useRouteFinder } from '../../hooks/useRouteFinder';

// Dynamic import with SSR disabled for Leaflet map
const CampusMap = dynamic(() => import('../../components/CampusMap'), {
  ssr: false,
  loading: () => (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm min-h-[480px] flex flex-col items-center justify-center text-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-2"></div>
      <p className="text-sm text-slate-500">Loading Campus Map...</p>
    </div>
  ),
});

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  // Module 1: source/destination selection + route search state shared by the map and the route card
  const routeFinder = useRouteFinder();

  // Fetch logged-in user and their role from the verified JWT token
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

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
              Reg No: <strong className="text-slate-800 font-mono">{user?.registrationNo || '11111111'}</strong>
            </span>
            {user?.role && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {user.role === 'estate_staff' ? 'Estate Staff' : 'Student'}
              </span>
            )}
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

        {/* Campus Map */}
        <div className="w-full min-h-[480px]">
          <CampusMap
            buildings={routeFinder.buildings}
            sourceId={routeFinder.sourceId}
            destinationId={routeFinder.destinationId}
            routeCoordinates={routeFinder.route?.coordinates ?? null}
            resetToken={routeFinder.resetCount}
          />
        </div>

        {/* Action Sections */}
        <div className="grid md:grid-cols-3 gap-4">
          <RouteFinderCard finder={routeFinder} />

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
