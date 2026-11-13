'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import RouteFinderCard from '../../components/RouteFinderCard';
import BuildingAccessibilityCard from '../../components/BuildingAccessibilityCard';
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

  // Module 2: buildings list, manual building ID, and fetch status
  const [buildings, setBuildings] = useState([]);
  const [manualBuildingId, setManualBuildingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Derive mode and building selection using useMemo (no extra useEffect)
  const isDestinationMode = Boolean(routeFinder.destinationId);

  // Match building in fetched list whose campusKey matches destination's key
  const destinationBuilding = useMemo(() => {
    if (!isDestinationMode) return null;
    return buildings.find((b) => b.campusKey === routeFinder.destinationId) ?? null;
  }, [isDestinationMode, buildings, routeFinder.destinationId]);

  // Destination display name from campus buildings list
  const destinationName = useMemo(() => {
    if (!isDestinationMode) return '';
    return (
      routeFinder.buildings.find((b) => b.id === routeFinder.destinationId)?.name ||
      'the selected destination'
    );
  }, [isDestinationMode, routeFinder.buildings, routeFinder.destinationId]);

  // Fallback manual building selection (defaults to first building)
  const manualBuilding = useMemo(() => {
    if (buildings.length === 0) return null;
    if (manualBuildingId) {
      const match = buildings.find((b) => b.id === manualBuildingId);
      if (match) return match;
    }
    return buildings[0] ?? null;
  }, [buildings, manualBuildingId]);

  // Derived building passed to the card
  const selectedBuilding = isDestinationMode ? destinationBuilding : manualBuilding;

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

  // Reusable building data fetcher
  const loadBuildings = useCallback(({ background = false } = {}) => {
    return fetch('/api/buildings')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load building data');
        return res.json();
      })
      .then((data) => {
        setBuildings(data.buildings ?? []);
        setError(null);
      })
      .catch((err) => {
        if (!background) {
          setError(err.message || 'Unable to load building accessibility data. Please try again later.');
        }
      })
      .finally(() => {
        if (!background) {
          setLoading(false);
        }
      });
  }, []);

  // Fetch building accessibility data once on mount
  useEffect(() => {
    loadBuildings();
  }, [loadBuildings]);

  // Handle immediate local update & background re-sync when an issue is reported
  const handleReported = useCallback((updatedBuilding) => {
    if (!updatedBuilding) return;

    // 1. Immediately replace the building in state without a reload or loading flash
    setBuildings((prev) =>
      prev.map((b) => (b.id === updatedBuilding.id ? updatedBuilding : b))
    );

    // 2. Re-fetch in background to stay synchronized with other users
    loadBuildings({ background: true });
  }, [loadBuildings]);

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
            {user?.role === 'estate_staff' && (
              <Link
                href="/dashboard/estate"
                className="text-xs font-semibold px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100 transition"
              >
                Estate Tickets
              </Link>
            )}
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
              className="text-sm px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition cursor-pointer"
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

        {/* Action Sections — responsive two-column split:
            mobile: stacked | lg+: left 2/3 actions + right 1/3 accessibility panel */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* Left: action cards grid (equal share across two columns on md+) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:flex-1">
            <RouteFinderCard finder={routeFinder} />

            {user?.role === 'estate_staff' ? (
              <Link
                href="/dashboard/estate"
                className="bg-white border border-slate-200 rounded-lg p-5 hover:border-orange-300 hover:shadow-xs transition block group"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-slate-800 text-sm group-hover:text-orange-600 transition-colors">
                    Resolution Updates
                  </h3>
                  <span className="text-xs text-orange-500 font-semibold group-hover:translate-x-0.5 transition-transform">
                    &rarr;
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Track estate team clearance and maintenance tickets.
                </p>
              </Link>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-5">
                <h3 className="font-semibold text-slate-800 text-sm mb-1">
                  Resolution Updates
                </h3>
                <p className="text-xs text-slate-500">
                  Track estate team clearance and maintenance tickets.
                </p>
              </div>
            )}
          </div>

          {/* Right: building accessibility panel */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3">
            {/* Header / Mode Indicator */}
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-slate-800">
                Accessibility Status
              </span>
              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                Showing: {isDestinationMode ? 'destination' : 'manual selection'}
              </span>
            </div>

            {/* Building selection: fallback manual dropdown when destination is cleared, or destination display */}
            {!isDestinationMode ? (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <label
                  htmlFor="building-select"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Select building
                </label>
                <select
                  id="building-select"
                  disabled={loading || !!error}
                  value={manualBuilding?.id ?? ''}
                  onChange={(e) => {
                    setManualBuildingId(Number(e.target.value));
                  }}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
                >
                  {loading && <option>Loading…</option>}
                  {error  && <option>Unavailable</option>}
                  {!loading && !error && buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 mb-0.5">Route Destination</p>
                <p className="text-sm font-semibold text-slate-800">{destinationName}</p>
              </div>
            )}

            {/* Loading message */}
            {loading && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-xs text-slate-500">Loading building data…</p>
              </div>
            )}

            {/* Fetch error message */}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-red-700 mb-0.5">Could not load data</p>
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}

            {/* Accessibility card or no-match message — shown once data is ready */}
            {!loading && !error && (
              isDestinationMode && !destinationBuilding ? (
                <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center min-h-[120px] text-center">
                  <span aria-hidden="true" className="text-2xl mb-2">📋</span>
                  <p className="text-xs text-slate-600 font-medium">{destinationName}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    No accessibility data yet for {destinationName}
                  </p>
                </div>
              ) : (
                <BuildingAccessibilityCard
                  building={selectedBuilding}
                  onReported={handleReported}
                />
              )
            )}
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
