"use client";

import { useState, useEffect, useRef, useMemo } from "react";

const PROBLEM_LABELS = {
  all: "All problems",
  construction: "Construction",
  waterlogging: "Waterlogging",
  broken_ramp: "Broken ramp",
  locked_gate: "Locked gate",
  broken_lift: "Broken lift",
  other: "Other",
};

/**
 * Returns today's date in YYYY-MM-DD format in the Asia/Kolkata timezone.
 */
function getKolkataToday() {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Returns a date N days ago in YYYY-MM-DD format in the Asia/Kolkata timezone.
 */
function getKolkataDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Formats an ISO date/timestamp string into Asia/Kolkata timezone.
 */
function formatKolkataDate(dateInput) {
  if (!dateInput) return "—";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return String(dateInput);
  }
}

/**
 * Formats problem identifier into readable text.
 */
function formatProblemLabel(problem) {
  if (!problem) return "Other";
  if (PROBLEM_LABELS[problem]) return PROBLEM_LABELS[problem];
  return problem
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Chooses the appropriate status patch endpoint based on report source.
 */
function getReportPatchUrl(report) {
  return report.source === "lift"
    ? `/api/lift-reports/${report.id}`
    : `/api/barriers/${report.id}`;
}

/**
 * Renders the Details column text:
 * For lift reports: "Lift <n>, floor <f>: <problemDetail>", otherwise the description.
 */
function renderDetails(report) {
  if (report.source === "lift") {
    const liftNum = report.liftNumber ?? "N/A";
    const floor = report.floor || "N/A";
    const detail = report.problemDetail || report.description || "";
    return `Lift ${liftNum}, floor ${floor}: ${detail}`;
  }
  return report.description || "—";
}

/**
 * Generates an array of page numbers with gaps for pagination controls.
 */
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = [];
  const left = Math.max(2, currentPage - 2);
  const right = Math.min(totalPages - 1, currentPage + 2);

  pages.push(1);
  if (left > 2) {
    pages.push("…");
  }

  for (let i = left; i <= right; i++) {
    pages.push(i);
  }

  if (right < totalPages - 1) {
    pages.push("…");
  }

  pages.push(totalPages);
  return pages;
}

export default function EstateAdminDashboard({
  reports: initialReports = [],
  onReportUpdated,
  onViewOnMap,
  user,
}) {
  // Filter states
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [problemFilter, setProblemFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Server data states
  const [reports, setReports] = useState([]);
  const [kpis, setKpis] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [counts, setCounts] = useState({
    all: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // UI status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const abortControllerRef = useRef(null);
  const todayKolkata = useMemo(() => getKolkataToday(), []);

  // Determine whether any filter is currently active
  const hasActiveFilters = Boolean(
    debouncedSearch ||
      problemFilter !== "all" ||
      statusFilter !== "all" ||
      fromDate ||
      toDate
  );

  // Debounce search input (300ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Fetch reports from GET /api/admin/barrier-reports with server-side filters & pagination
  useEffect(() => {
    // Abort previous in-flight request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    async function loadReports() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (problemFilter !== "all") {
          params.set("problem", problemFilter);
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (fromDate) {
          params.set("from", fromDate);
        }
        if (toDate) {
          params.set("to", toDate);
        }

        const res = await fetch(
          `/api/admin/barrier-reports?${params.toString()}`,
          { signal: controller.signal }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            data?.error || "Failed to load admin barrier reports."
          );
        }

        // If the current page became empty after a filter/status update, go back a page
        if (data.reports?.length === 0 && data.total > 0 && page > 1) {
          setPage(Math.max(1, data.totalPages || page - 1));
          return;
        }

        setReports(data.reports || []);
        if (data.kpis) setKpis(data.kpis);
        if (data.counts) setCounts(data.counts);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);

        if (data.page && data.page !== page && data.reports?.length > 0) {
          setPage(data.page);
        }
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        setError(err.message || "Failed to load barrier reports.");
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      controller.abort();
    };
  }, [
    page,
    pageSize,
    debouncedSearch,
    problemFilter,
    statusFilter,
    fromDate,
    toDate,
    refreshTrigger,
  ]);

  // Status transition handler calling PATCH /api/barriers/[id] or /api/lift-reports/[id]
  const handleStatusChange = async (report, newStatus) => {
    try {
      const reportKey = report.key || `${report.source}-${report.id}`;
      setUpdatingId(reportKey);
      setFeedback({ type: "", message: "" });

      const url = getReportPatchUrl(report);

      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Failed to update status");
      }

      setFeedback({
        type: "success",
        message: `Ticket #${report.id} marked as ${newStatus.replace("_", " ")}.`,
      });

      // Refresh current page and KPIs
      setRefreshTrigger((prev) => prev + 1);

      if (onReportUpdated) {
        await onReportUpdated();
      }
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Failed to update ticket",
      });
    } finally {
      setUpdatingId(null);
      setTimeout(() => setFeedback({ type: "", message: "" }), 3000);
    }
  };

  // Quick date range selectors
  const handleQuickDate = (days) => {
    const today = getKolkataToday();
    if (days === 0) {
      setFromDate(today);
      setToDate(today);
    } else {
      setFromDate(getKolkataDateDaysAgo(days - 1));
      setToDate(today);
    }
    setPage(1);
  };

  // Clear all filters handler
  const handleClearAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setProblemFilter("all");
    setStatusFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  // Pagination calculation
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);
  const hasPreviousPage = page > 1;
  const hasNextPage = page < totalPages;

  return (
    <div className="space-y-4">
      {/* 1. KPI Summary Cards (Uses whole-table totals from kpis) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">Total Tickets</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{kpis.total}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">Pending</p>
          <p className="text-xl font-bold text-red-600 mt-1">{kpis.pending}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">In Progress</p>
          <p className="text-xl font-bold text-yellow-600 mt-1">
            {kpis.in_progress}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">Resolved</p>
          <p className="text-xl font-bold text-green-600 mt-1">
            {kpis.resolved}
          </p>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback.message && (
        <div
          role="status"
          className={`p-3 rounded-lg text-xs font-medium border ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* 2. Filter Bar Above Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
        {/* Row A: Search, Problem dropdown, Status buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search location */}
          <div className="relative flex-1 max-w-sm">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search location (building name or block number)"
              className="w-full text-xs border border-slate-300 rounded-lg pl-3 pr-7 py-2 bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                aria-label="Clear search"
              >
                &times;
              </button>
            )}
          </div>

          {/* Problem dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label
              htmlFor="problem-filter"
              className="text-xs font-medium text-slate-500 whitespace-nowrap"
            >
              Problem:
            </label>
            <select
              id="problem-filter"
              value={problemFilter}
              onChange={(e) => {
                setProblemFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer"
            >
              <option value="all">All problems</option>
              <option value="construction">Construction</option>
              <option value="waterlogging">Waterlogging</option>
              <option value="broken_ramp">Broken ramp</option>
              <option value="locked_gate">Locked gate</option>
              <option value="broken_lift">Broken lift</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Status buttons with counts and aria-pressed */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {[
              { id: "all", label: "All", count: counts.all },
              { id: "pending", label: "Pending", count: counts.pending },
              {
                id: "in_progress",
                label: "In Progress",
                count: counts.in_progress,
              },
              { id: "resolved", label: "Resolved", count: counts.resolved },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={statusFilter === tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    statusFilter === tab.id
                      ? "bg-orange-600 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.count ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Row B: Date Range and Quick Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <label htmlFor="from-date" className="font-medium text-slate-500">
                From:
              </label>
              <input
                id="from-date"
                type="date"
                max={toDate || todayKolkata}
                value={fromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setFromDate(val);
                  if (toDate && val > toDate) {
                    setToDate(val);
                  }
                  setPage(1);
                }}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="to-date" className="font-medium text-slate-500">
                To:
              </label>
              <input
                id="to-date"
                type="date"
                min={fromDate || undefined}
                max={todayKolkata}
                value={toDate}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val > todayKolkata) return;
                  if (fromDate && val < fromDate) return;
                  setToDate(val);
                  setPage(1);
                }}
                className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-orange-400"
              />
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={() => handleQuickDate(0)}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate(7)}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition cursor-pointer"
              >
                Last 7 days
              </button>
              <button
                type="button"
                onClick={() => handleQuickDate(30)}
                className="px-2 py-1 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition cursor-pointer"
              >
                Last 30 days
              </button>
            </div>
          </div>

          {/* Clear filters button (shown only when a filter is active) */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="text-xs text-red-600 hover:text-red-700 underline font-medium cursor-pointer ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Row C: Removable Chips for Active Filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
            <span className="text-slate-400 font-medium">Active filters:</span>

            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full">
                <span>Location: &ldquo;{debouncedSearch}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="font-bold hover:text-orange-950 cursor-pointer"
                  aria-label="Remove search filter"
                >
                  &times;
                </button>
              </span>
            )}

            {problemFilter !== "all" && (
              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full">
                <span>Problem: {formatProblemLabel(problemFilter)}</span>
                <button
                  type="button"
                  onClick={() => {
                    setProblemFilter("all");
                    setPage(1);
                  }}
                  className="font-bold hover:text-orange-950 cursor-pointer"
                  aria-label="Remove problem filter"
                >
                  &times;
                </button>
              </span>
            )}

            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full capitalize">
                <span>Status: {statusFilter.replace("_", " ")}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="font-bold hover:text-orange-950 cursor-pointer"
                  aria-label="Remove status filter"
                >
                  &times;
                </button>
              </span>
            )}

            {(fromDate || toDate) && (
              <span className="inline-flex items-center gap-1 bg-orange-50 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full">
                <span>
                  Date: {fromDate || "Start"} to {toDate || "Today"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                    setPage(1);
                  }}
                  className="font-bold hover:text-orange-950 cursor-pointer"
                  aria-label="Remove date filter"
                >
                  &times;
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. Main Content: Loading, Error, Empty, or Table */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 flex flex-col items-center justify-center text-center">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-500">Loading barrier & lift reports...</p>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-6 text-center"
        >
          <p className="text-xs font-semibold text-red-700 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => setRefreshTrigger((prev) => prev + 1)}
            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">
            No reports match your filters
          </p>
          <p className="text-xs text-slate-400 mb-4">
            Try adjusting your search keywords, problem type, or date range.
          </p>
          <button
            type="button"
            onClick={handleClearAllFilters}
            className="px-3.5 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                  ID
                </th>
                <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                  Location
                </th>
                <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                  Problem
                </th>
                <th scope="col" className="px-3.5 py-3 min-w-[220px]">
                  Details
                </th>
                <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                  Reported by
                </th>
                <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                  Reported on
                </th>
                <th scope="col" className="px-3.5 py-3 whitespace-nowrap">
                  Status
                </th>
                <th
                  scope="col"
                  className="px-3.5 py-3 whitespace-nowrap text-right"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => {
                const reportKey = report.key || `${report.source}-${report.id}`;
                const isUpdating = updatingId === reportKey;

                return (
                  <tr
                    key={reportKey}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* ID */}
                    <td className="px-3.5 py-3 font-mono text-slate-700 whitespace-nowrap">
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded mr-1.5 bg-slate-100 text-slate-600">
                        {report.source === "lift" ? "🛗 Lift" : "🚧 Barrier"}
                      </span>
                      #{report.id}
                    </td>

                    {/* Location */}
                    <td className="px-3.5 py-3 text-slate-800 font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-orange-600">📍</span>
                        <span>
                          {report.locationName || "Unknown location"}
                        </span>
                      </div>
                      {report.latitude && report.longitude && (
                        <div className="text-[10px] text-slate-400 font-mono ml-4">
                          ({Number(report.latitude).toFixed(4)},{" "}
                          {Number(report.longitude).toFixed(4)})
                        </div>
                      )}
                    </td>

                    {/* Problem */}
                    <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">
                      <span className="capitalize">
                        {formatProblemLabel(report.barrierType)}
                      </span>
                    </td>

                    {/* Details */}
                    <td className="px-3.5 py-3 text-slate-600 max-w-md">
                      <p className="line-clamp-2">{renderDetails(report)}</p>
                    </td>

                    {/* Reported by */}
                    <td className="px-3.5 py-3 text-slate-700 whitespace-nowrap">
                      {report.reporterName || "Unknown"}
                    </td>

                    {/* Reported on (Asia/Kolkata timezone) */}
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap">
                      {formatKolkataDate(report.createdAt)}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          report.status === "resolved"
                            ? "bg-green-100 text-green-700"
                            : report.status === "in_progress"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {report.status?.replace("_", " ") || "pending"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3.5 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {report.latitude && report.longitude && onViewOnMap && (
                          <button
                            type="button"
                            onClick={() => onViewOnMap(report)}
                            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 font-medium transition cursor-pointer"
                            title="View exact spot on campus map"
                          >
                            📍 View on Map
                          </button>
                        )}

                        {report.status === "pending" && (
                          <>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                handleStatusChange(report, "in_progress")
                              }
                              className="text-xs px-2.5 py-1 rounded-md bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium transition disabled:opacity-50 cursor-pointer"
                            >
                              {isUpdating ? "..." : "Start Work"}
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                handleStatusChange(report, "resolved")
                              }
                              className="text-xs px-2.5 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-50 cursor-pointer"
                            >
                              {isUpdating ? "..." : "Resolve"}
                            </button>
                          </>
                        )}

                        {report.status === "in_progress" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleStatusChange(report, "resolved")
                            }
                            className="text-xs px-2.5 py-1 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-50 cursor-pointer"
                          >
                            {isUpdating ? "..." : "Mark Resolved"}
                          </button>
                        )}

                        {report.status === "resolved" && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleStatusChange(report, "in_progress")
                            }
                            className="text-xs px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-700 bg-slate-100 font-medium transition disabled:opacity-50 cursor-pointer"
                          >
                            {isUpdating ? "..." : "Reopen"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. Pagination Controls Below Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        {/* Left: Showing range and Page Size selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span>
            Showing {startItem}–{endItem} of {total}
          </span>
          <span className="text-slate-300">|</span>
          <label htmlFor="page-size-select" className="text-slate-500">
            Show
          </label>
          <select
            id="page-size-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>per page</span>
        </div>

        {/* Right: Previous, Page Numbers, Next */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            disabled={!hasPreviousPage || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
          >
            Previous
          </button>

          {getPageNumbers(page, totalPages).map((item, idx) => {
            if (item === "…") {
              return (
                <span
                  key={`gap-${idx}`}
                  aria-hidden="true"
                  className="px-1.5 py-1 text-slate-400 select-none"
                >
                  …
                </span>
              );
            }

            const pNum = Number(item);
            const isCurrent = pNum === page;

            return (
              <button
                key={pNum}
                type="button"
                aria-label={`Page ${pNum}`}
                aria-current={isCurrent ? "page" : undefined}
                disabled={isCurrent || loading}
                onClick={() => setPage(pNum)}
                className={`min-w-[28px] h-7 px-2 rounded-md text-xs font-medium transition cursor-pointer ${
                  isCurrent
                    ? "bg-orange-500 text-white font-bold"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {pNum}
              </button>
            );
          })}

          <button
            type="button"
            disabled={!hasNextPage || loading}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium transition cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
