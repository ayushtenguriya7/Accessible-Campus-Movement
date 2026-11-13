"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import RouteFinderCard from "../../components/RouteFinderCard";
import BuildingAccessibilityCard from "../../components/BuildingAccessibilityCard";
import { useRouteFinder } from "../../hooks/useRouteFinder";

// Dynamic import with SSR disabled for Leaflet map
const CampusMap = dynamic(() => import("../../components/CampusMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm min-h-[480px] flex flex-col items-center justify-center text-center">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-2" />
      <p className="text-sm text-slate-500">Loading Campus Map...</p>
    </div>
  ),
});

export default function DashboardPage() {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const routeFinder = useRouteFinder();

  // Existing building states
  const [buildings, setBuildings] = useState([]);
  const [manualBuildingId, setManualBuildingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Barrier reporting states
  const [isPickingBarrierLocation, setIsPickingBarrierLocation] =
    useState(false);
  const [barrierLocation, setBarrierLocation] = useState(null);
  const [barrierType, setBarrierType] = useState("construction");
  const [barrierDescription, setBarrierDescription] = useState("");
  const [barrierReports, setBarrierReports] = useState([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [barrierMessage, setBarrierMessage] = useState("");
  const [barrierError, setBarrierError] = useState("");

  const isDestinationMode = Boolean(routeFinder.destinationId);

  const destinationBuilding = useMemo(() => {
    if (!isDestinationMode) return null;

    return (
      buildings.find(
        (b) => String(b.campusKey) === String(routeFinder.destinationId),
      ) ?? null
    );
  }, [isDestinationMode, buildings, routeFinder.destinationId]);

  const destinationName = useMemo(() => {
    if (!isDestinationMode) return "";

    return (
      routeFinder.buildings.find((b) => b.id === routeFinder.destinationId)
        ?.name || "the selected destination"
    );
  }, [isDestinationMode, routeFinder.buildings, routeFinder.destinationId]);

  const manualBuilding = useMemo(() => {
    if (buildings.length === 0) return null;

    if (manualBuildingId) {
      const match = buildings.find(
        (b) => String(b.id) === String(manualBuildingId),
      );

      if (match) return match;
    }

    return buildings[0] ?? null;
  }, [buildings, manualBuildingId]);

  const selectedBuilding = isDestinationMode
    ? destinationBuilding
    : manualBuilding;

  // Fetch logged-in user
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  // Fetch building accessibility data
  useEffect(() => {
    fetch("/api/buildings")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load building data");
        return res.json();
      })
      .then((data) => {
        setBuildings(data.buildings ?? []);
      })
      .catch((err) => {
        setError(err.message || "Unable to load building accessibility data.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Fetch barrier reports
  const fetchBarrierReports = async () => {
    try {
      const response = await fetch("/api/barriers");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load barrier reports");
      }

      const reports = data.reports ?? [];

      setBarrierReports(reports);
      routeFinder.updateBarrierReports(reports);
    } catch (err) {
      console.error("Barrier reports error:", err);
    }
  };

  useEffect(() => {
    fetchBarrierReports();
  }, []);

  // Select a location on the map
  const handleBarrierLocationSelect = (location) => {
    setBarrierLocation(location);
    setIsPickingBarrierLocation(false);
    setBarrierMessage("Location selected successfully.");
    setBarrierError("");
  };

  // Submit barrier report without source/destination
  const handleSubmitBarrier = async (e) => {
    e.preventDefault();

    setBarrierMessage("");
    setBarrierError("");

    if (!barrierLocation) {
      setBarrierError("Please select the blockage location on the map.");
      return;
    }

    if (!barrierDescription.trim()) {
      setBarrierError("Please enter a description of the blockage.");
      return;
    }

    try {
      setSubmittingReport(true);

      const response = await fetch("/api/barriers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barrierType,
          description: barrierDescription.trim(),
          latitude: barrierLocation.latitude,
          longitude: barrierLocation.longitude,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit barrier report.");
      }

      setBarrierMessage("Barrier report submitted successfully!");
      setBarrierLocation(null);
      setBarrierDescription("");
      setIsPickingBarrierLocation(false);

      await fetchBarrierReports();
    } catch (err) {
      setBarrierError(err.message || "Something went wrong.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
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
              Reg No:{" "}
              <strong className="text-slate-800 font-mono">
                {user?.registrationNo || "11111111"}
              </strong>
            </span>

            {user?.role && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {user.role === "estate_staff" ? "Estate Staff" : "Student"}
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

      {/* Main Page */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Campus Route & Barrier Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Accessible pathways, obstacle reports, and maintenance updates
            across campus.
          </p>
        </div>

        {/* Campus Map */}
        <div className="w-full min-h-[480px]">
          <CampusMap
            buildings={routeFinder.buildings}
            sourceId={routeFinder.sourceId}
            destinationId={routeFinder.destinationId}
            routeCoordinates={routeFinder.route?.coordinates ?? null}
            blockedRouteCoordinates={
              routeFinder.route?.activeBarrierReports?.length
                ? routeFinder.route.coordinates
                : null
            }
            detourCoordinates={routeFinder.route?.detourCoordinates ?? null}
            barrierLocations={routeFinder.route?.activeBarrierReports ?? []}
            resetToken={routeFinder.resetCount}
            isPickingBarrierLocation={isPickingBarrierLocation}
            onBarrierLocationSelect={handleBarrierLocationSelect}
            barrierLocation={barrierLocation}
          />
        </div>

        {/* Action Sections */}
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* Three Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full lg:flex-1">
            {/* Route Finder */}
            <RouteFinderCard finder={routeFinder} />

            {/* Report a Barrier */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">
                Report a Barrier
              </h3>

              <p className="text-xs text-slate-500 mb-4">
                Report blocked ramps, construction, waterlogging, locked gates,
                or broken lifts.
              </p>

              {!isPickingBarrierLocation ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsPickingBarrierLocation(true);
                    setBarrierMessage(
                      "Click on the map to select the exact blockage location.",
                    );
                    setBarrierError("");
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg py-2.5 transition"
                >
                  Select Location on Map
                </button>
              ) : (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-800">
                    Location selection active
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Click on the map where the blockage exists.
                  </p>

                  <button
                    type="button"
                    onClick={() => setIsPickingBarrierLocation(false)}
                    className="text-xs text-red-600 underline mt-2"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {barrierLocation && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-green-800">
                    Selected location
                  </p>
                  <p className="text-[11px] text-green-700 mt-1">
                    Latitude: {barrierLocation.latitude.toFixed(6)}
                  </p>
                  <p className="text-[11px] text-green-700">
                    Longitude: {barrierLocation.longitude.toFixed(6)}
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setBarrierLocation(null);
                      setBarrierMessage("");
                    }}
                    className="text-xs text-red-600 underline mt-2"
                  >
                    Remove location
                  </button>
                </div>
              )}

              {barrierLocation && (
                <form onSubmit={handleSubmitBarrier} className="mt-4 space-y-3">
                  <div>
                    <label
                      htmlFor="barrier-type"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Barrier type
                    </label>

                    <select
                      id="barrier-type"
                      value={barrierType}
                      onChange={(e) => setBarrierType(e.target.value)}
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white"
                    >
                      <option value="construction">Construction</option>
                      <option value="waterlogging">Waterlogging</option>
                      <option value="broken_ramp">Broken ramp</option>
                      <option value="locked_gate">Locked gate</option>
                      <option value="broken_lift">Broken lift</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="barrier-description"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Description
                    </label>

                    <textarea
                      id="barrier-description"
                      rows={3}
                      maxLength={1000}
                      value={barrierDescription}
                      onChange={(e) => setBarrierDescription(e.target.value)}
                      placeholder="Describe the blockage..."
                      className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 resize-y"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg py-2.5 transition"
                  >
                    {submittingReport ? "Submitting..." : "Submit Report"}
                  </button>
                </form>
              )}

              {barrierMessage && (
                <p className="text-xs text-green-700 mt-3" role="status">
                  {barrierMessage}
                </p>
              )}

              {barrierError && (
                <p className="text-xs text-red-600 mt-3" role="alert">
                  {barrierError}
                </p>
              )}
            </div>

            {/* Resolution Updates */}
            <div className="bg-white border border-slate-200 rounded-lg p-5">
              <h3 className="font-semibold text-slate-800 text-sm mb-1">
                Resolution Updates
              </h3>

              <p className="text-xs text-slate-500 mb-4">
                Track estate team clearance and maintenance tickets.
              </p>

              {barrierReports.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No barrier reports available.
                </p>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {barrierReports.map((report) => (
                    <div
                      key={report.id}
                      className="border-t border-slate-100 pt-2"
                    >
                      <p className="text-xs font-semibold text-slate-700">
                        {String(report.barrierType || "").replaceAll("_", " ")}
                      </p>

                      <p className="text-[11px] text-slate-500 mt-1">
                        {report.description}
                      </p>

                      <span
                        className={`inline-block mt-2 text-[10px] font-semibold px-2 py-1 rounded-full ${
                          report.status === "resolved"
                            ? "bg-green-100 text-green-700"
                            : report.status === "in_progress"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {report.status?.replaceAll("_", " ") || "pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Accessibility Panel */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-semibold text-slate-800">
                Accessibility Status
              </span>

              <span className="text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                Showing:{" "}
                {isDestinationMode ? "destination" : "manual selection"}
              </span>
            </div>

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
                  value={manualBuilding?.id ?? ""}
                  onChange={(e) => setManualBuildingId(e.target.value)}
                  className="w-full text-xs text-slate-800 bg-white border border-slate-300 rounded-lg px-2.5 py-2 outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
                >
                  {loading && <option>Loading…</option>}
                  {error && <option>Unavailable</option>}

                  {!loading &&
                    !error &&
                    buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 mb-0.5">
                  Route Destination
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  {destinationName}
                </p>
              </div>
            )}

            {loading && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-xs text-slate-500">Loading building data…</p>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <p className="text-xs font-semibold text-red-700 mb-0.5">
                  Could not load data
                </p>
                <p className="text-[11px] text-red-600">{error}</p>
              </div>
            )}

            {!loading &&
              !error &&
              (isDestinationMode && !destinationBuilding ? (
                <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center min-h-[120px] text-center">
                  <span aria-hidden="true" className="text-2xl mb-2">
                    📋
                  </span>
                  <p className="text-xs text-slate-600 font-medium">
                    {destinationName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 leading-snug">
                    No accessibility data yet for {destinationName}
                  </p>
                </div>
              ) : (
                <BuildingAccessibilityCard building={selectedBuilding} />
              ))}
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
