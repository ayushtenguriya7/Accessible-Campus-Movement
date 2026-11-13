"use client";

import { useState, useMemo } from "react";
import { CAMPUS_BUILDINGS } from "../data/campusBuildings";

function getNearestBuildingName(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return "";
  let nearest = null;
  let minDistance = Infinity;

  for (const b of CAMPUS_BUILDINGS) {
    const dLat = (b.lat || 0) - lat;
    const dLng = (b.lng || 0) - lng;
    const dist = dLat * dLat + dLng * dLng;
    if (dist < minDistance) {
      minDistance = dist;
      nearest = b;
    }
  }

  return nearest ? `Near Block ${nearest.number} (${nearest.name})` : "";
}

export default function EstateAdminDashboard({
  reports = [],
  onReportUpdated,
  onViewOnMap,
  user,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", message: "" });

  // Compute KPI metrics
  const stats = useMemo(() => {
    const total = reports.length;
    const pending = reports.filter((r) => r.status === "pending").length;
    const inProgress = reports.filter((r) => r.status === "in_progress").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;
    return { total, pending, inProgress, resolved };
  }, [reports]);

  // Filter and search reports
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Status match
      if (statusFilter !== "all" && report.status !== statusFilter) {
        return false;
      }

      // Search match
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const type = (report.barrierType || "").toLowerCase();
        const desc = (report.description || "").toLowerCase();
        const reporter = (report.reporterName || "").toLowerCase();
        const idMatch = String(report.id).includes(query);

        return (
          type.includes(query) ||
          desc.includes(query) ||
          reporter.includes(query) ||
          idMatch
        );
      }

      return true;
    });
  }, [reports, statusFilter, searchQuery]);

  // Update status handler calling PATCH /api/barriers/[id]
  const handleStatusChange = async (reportId, newStatus) => {
    try {
      setUpdatingId(reportId);
      setFeedback({ type: "", message: "" });

      const response = await fetch(`/api/barriers/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update status");
      }

      setFeedback({
        type: "success",
        message: `Ticket #${reportId} marked as ${newStatus.replace("_", " ")}.`,
      });

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

  return (
    <div className="space-y-4">
      {/* Simple Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">Total Tickets</p>
          <p className="text-xl font-bold text-slate-800 mt-1">{stats.total}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">Pending</p>
          <p className="text-xl font-bold text-red-600 mt-1">{stats.pending}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">In Progress</p>
          <p className="text-xl font-bold text-yellow-600 mt-1">{stats.inProgress}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <p className="text-xs text-slate-500 font-medium">Resolved</p>
          <p className="text-xl font-bold text-green-600 mt-1">{stats.resolved}</p>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedback.message && (
        <div
          className={`p-3 rounded-lg text-xs font-medium border ${
            feedback.type === "success"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Simple Search and Filter Row */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search reports..."
          className="w-full sm:w-72 text-xs border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-orange-400"
        />

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "in_progress", label: "In Progress" },
            { id: "resolved", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                statusFilter === tab.id
                  ? "bg-orange-500 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Simple Ticket List */}
      <div className="space-y-2.5">
        {filteredReports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-center text-xs text-slate-500">
            No barrier reports match the selected filter.
          </div>
        ) : (
          filteredReports.map((report) => {
            const isUpdating = updatingId === report.id;
            const nearestBuilding = getNearestBuildingName(report.latitude, report.longitude);

            return (
              <div
                key={report.id}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800 capitalize">
                        {String(report.barrierType || "Barrier").replace("_", " ")}
                      </span>

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
                    </div>

                    <p className="text-xs text-slate-600 mt-1">
                      {report.description}
                    </p>

                    {/* Exact Location & Nearest Landmark */}
                    {report.latitude && report.longitude && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-1 font-medium">
                        <span className="text-orange-600 font-semibold">
                          📍 {nearestBuilding || "Campus Location"}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">
                          ({Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)})
                        </span>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Reported by {report.reporterName || "Student"} &bull;{" "}
                      {new Date(report.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {/* View on Map Button */}
                    {report.latitude && report.longitude && (
                      <button
                        type="button"
                        onClick={() => onViewOnMap && onViewOnMap(report)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 font-medium transition"
                        title="View exact spot on campus map"
                      >
                        📍 View on Map
                      </button>
                    )}

                    {report.status === "pending" && (
                      <>
                        <button
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(report.id, "in_progress")}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium transition disabled:opacity-50"
                        >
                          {isUpdating ? "..." : "Start Work"}
                        </button>
                        <button
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(report.id, "resolved")}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-50"
                        >
                          {isUpdating ? "..." : "Resolve"}
                        </button>
                      </>
                    )}

                    {report.status === "in_progress" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(report.id, "resolved")}
                        className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition disabled:opacity-50"
                      >
                        {isUpdating ? "..." : "Mark Resolved"}
                      </button>
                    )}

                    {report.status === "resolved" && (
                      <button
                        disabled={isUpdating}
                        onClick={() => handleStatusChange(report.id, "in_progress")}
                        className="text-xs px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-700 bg-slate-100 font-medium transition disabled:opacity-50"
                      >
                        {isUpdating ? "..." : "Reopen"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
