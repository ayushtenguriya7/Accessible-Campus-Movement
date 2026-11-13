'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

const FEATURE_ICONS = {
  Lift: '🛗',
  Ramp: '♿',
  Stairs: '🪜',
};

export default function EstateDashboardPage() {
  const router = useRouter();

  // Role validation state: render nothing until staff authentication is confirmed
  const [authorized, setAuthorized] = useState(false);
  const [user, setUser] = useState(null);

  // Tickets & filter states
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Pending' | 'Resolved'
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null); // ticket ID undergoing "Are you sure?" confirmation
  const [resolvingId, setResolvingId] = useState(null);   // ticket ID currently being resolved via API
  const [actionError, setActionError] = useState(null);
  const [successNotice, setSuccessNotice] = useState('');

  const abortControllerRef = useRef(null);

  // 1. Role verification check on mount
  useEffect(() => {
    let isMounted = true;
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data?.user?.role === 'estate_staff') {
          setUser(data.user);
          setAuthorized(true);
        } else {
          router.replace('/dashboard');
        }
      })
      .catch(() => {
        if (isMounted) router.replace('/dashboard');
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  // 2. Debounce search input typing by 300 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 3. Fetch tickets with in-flight abort
  const fetchTickets = useCallback(() => {
    // Abort any prior in-flight request so older responses never overwrite newer ones
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const trimmed = debouncedSearch.trim();
    const queryUrl = `/api/tickets?status=${encodeURIComponent(statusFilter)}&search=${encodeURIComponent(trimmed)}`;

    fetch(queryUrl, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 403) {
            router.replace('/dashboard');
            return null;
          }
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error || 'Failed to load tickets');
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setTickets(data.tickets ?? []);
        if (data.counts) {
          setCounts(data.counts);
        }
        setError(null);
      })
      .catch((err) => {
        if (err.name === 'AbortError') {
          // Expected when request is replaced by a newer one
          return;
        }
        setError(err.message || 'Unable to load tickets.');
      })
      .finally(() => {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      });
  }, [statusFilter, debouncedSearch, router]);

  // Trigger fetch when authorized, status filter, or debounced search changes
  useEffect(() => {
    if (authorized) {
      fetchTickets();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [authorized, fetchTickets]);

  // 4. Resolve ticket action
  const handleResolveTicket = async (ticketId) => {
    setActionError(null);
    setResolvingId(ticketId);

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to resolve ticket.');
      }

      setConfirmingId(null);
      setSuccessNotice(`Ticket #${ticketId} marked as resolved.`);
      setTimeout(() => setSuccessNotice(''), 4000);

      // Refresh tickets list and counts
      fetchTickets();
    } catch (err) {
      setActionError(err.message || 'Error resolving ticket.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  };

  // Render nothing until staff authentication check finishes (prevents student page flash)
  if (!authorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Navbar */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-baseline group">
              <span className="font-extrabold text-2xl text-orange-500">U</span>
              <span className="font-extrabold text-2xl text-slate-900 group-hover:text-orange-600 transition-colors">
                NS
              </span>
            </Link>
            <span className="text-xs text-slate-500 font-semibold tracking-wider uppercase border-l border-slate-300 pl-3 hidden sm:inline">
              Estate Management Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-xs font-semibold px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              &larr; Campus Map
            </Link>
            <span className="text-sm text-slate-600 hidden md:inline">
              Staff: <strong className="text-slate-800 font-mono">{user?.registrationNo}</strong>
            </span>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              Estate Staff
            </span>
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
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-5">
        {/* Title Bar */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Barrier & Maintenance Tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Review, filter, and resolve accessibility obstacle reports across campus.
          </p>
        </div>

        {/* Feedback Notices */}
        {successNotice && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 bg-green-50 border border-green-200 text-green-800 text-xs rounded-lg flex items-center justify-between"
          >
            <span>✓ {successNotice}</span>
            <button
              type="button"
              onClick={() => setSuccessNotice('')}
              className="text-green-600 hover:text-green-800 font-bold ml-2 cursor-pointer"
              aria-label="Dismiss notice"
            >
              ×
            </button>
          </div>
        )}

        {actionError && (
          <div
            role="alert"
            className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center justify-between"
          >
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-600 hover:text-red-800 font-bold ml-2 cursor-pointer"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-end justify-between">
          {/* Status Filter Buttons */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Filter by Status
            </span>
            <div className="flex items-center gap-1.5">
              {[
                { key: 'All', label: 'All', count: counts.all },
                { key: 'Pending', label: 'Pending', count: counts.pending },
                { key: 'Resolved', label: 'Resolved', count: counts.resolved },
              ].map((btn) => {
                const isActive = statusFilter === btn.key;
                return (
                  <button
                    key={btn.key}
                    type="button"
                    onClick={() => {
                      setConfirmingId(null);
                      setLoading(true);
                      setStatusFilter(btn.key);
                    }}
                    aria-pressed={isActive}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-orange-500 text-white font-semibold shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {btn.label} ({btn.count ?? 0})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search by building name (type="search") with clear button */}
          <div className="w-full md:w-80">
            <label
              htmlFor="building-search"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Search by building name
            </label>
            <div className="relative">
              <input
                id="building-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. Block 34, Central Library..."
                className="w-full pl-3 pr-8 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-orange-400 placeholder:text-slate-400"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setDebouncedSearch('');
                    setLoading(true);
                  }}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  &times;
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 200-row limit notice */}
        {!loading && !error && tickets.length >= 200 && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
            Showing the 200 most recent tickets. Refine your search to find older tickets.
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-10 text-center flex flex-col items-center justify-center">
            <div className="w-6 h-6 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-xs text-slate-500">Loading tickets…</p>
          </div>
        )}

        {/* Error State with Retry button */}
        {error && !loading && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-sm font-semibold text-red-700 mb-1">Unable to load tickets</p>
            <p className="text-xs text-red-600 mb-3">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchTickets();
              }}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tickets.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center flex flex-col items-center">
            <span aria-hidden="true" className="text-3xl mb-2">📋</span>
            <p className="text-sm font-semibold text-slate-700">No tickets match your search</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              {searchInput
                ? `No tickets found matching "${searchInput}". Try clearing or refining your search.`
                : `There are currently no ${statusFilter === 'All' ? '' : statusFilter.toLowerCase() + ' '}tickets recorded.`}
            </p>
          </div>
        )}

        {/* Tickets Table */}
        {!loading && !error && tickets.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      ID
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      Building
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      Issue
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700">
                      Description
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      Reported by
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      Reported on
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3 font-semibold text-slate-700 text-right whitespace-nowrap">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((t) => {
                    const isPending = t.status === 'Pending';
                    const isConfirming = confirmingId === t.id;
                    const isResolving = resolvingId === t.id;
                    const icon = FEATURE_ICONS[t.featureType] || '⚠️';

                    return (
                      <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-medium text-slate-500 whitespace-nowrap">
                          #{t.id}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                          {t.buildingName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            <span aria-hidden="true">{icon}</span>
                            {t.featureType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs break-words">
                          {t.description || (
                            <span className="text-slate-400 italic">No description</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono whitespace-nowrap">
                          {t.reportedBy}
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                          {formatDate(t.createdAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                              Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 border border-green-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                              Resolved
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {isPending ? (
                            isConfirming ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[11px] text-slate-600 font-medium">
                                  Are you sure?
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleResolveTicket(t.id)}
                                  disabled={isResolving}
                                  className="px-2.5 py-1 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded transition cursor-pointer"
                                >
                                  {isResolving ? 'Resolving…' : 'Yes'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmingId(null)}
                                  disabled={isResolving}
                                  className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded transition cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setConfirmingId(t.id);
                                }}
                                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-md transition cursor-pointer"
                              >
                                Mark resolved
                              </button>
                            )
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">
                              Resolved {t.resolvedBy ? `by ${t.reportedBy === t.resolvedBy ? 'self' : t.resolvedBy}` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Campus Accessibility Portal &bull; Movement & Navigation
      </footer>
    </div>
  );
}
