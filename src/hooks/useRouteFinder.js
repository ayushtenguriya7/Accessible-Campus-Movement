"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CAMPUS_BUILDINGS } from "../data/campusBuildings";

import {
  fetchWalkingRoutes,
  findDetourRoute,
  getMinimumDistanceToRoute,
  validateSelection,
} from "../lib/routing";

// A report is considered relevant when the original route
// passes within 20 metres of its GPS location.
const BLOCKAGE_ROUTE_PROXIMITY_METERS = 20;

/**
 * Get all active blockage reports.
 *
 * pending and in_progress = active
 * resolved = ignored
 *
 * No source/destination building-pair filtering here.
 * GPS location determines whether a blockage affects a route.
 */
function getActiveReports(reports) {
  return reports.filter((report) => {
    const active =
      report.status === "pending" || report.status === "in_progress";

    const latitude = Number(report.latitude);
    const longitude = Number(report.longitude);

    return (
      active &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  });
}

/**
 * Find which active blockage reports affect the selected route.
 *
 * Only reports close to the original route are relevant.
 */
function getReportsAffectingRoute(routeCoordinates, reports) {
  if (!routeCoordinates?.length) {
    return [];
  }

  return reports.filter((report) => {
    const distance = getMinimumDistanceToRoute(routeCoordinates, report);

    return distance <= BLOCKAGE_ROUTE_PROXIMITY_METERS;
  });
}

export function useRouteFinder(buildings = CAMPUS_BUILDINGS) {
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  const [route, setRoute] = useState(null);
  const [resetCount, setResetCount] = useState(0);

  const [barrierReports, setBarrierReports] = useState([]);

  const abortRef = useRef(null);
  const detourAbortRef = useRef(null);

  // Cancel pending requests when the hook unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      detourAbortRef.current?.abort();
    };
  }, []);

  const discardResult = useCallback(() => {
    abortRef.current?.abort();
    detourAbortRef.current?.abort();

    setRoute(null);
    setError("");
    setStatus("idle");
  }, []);

  const changeSource = useCallback(
    (id) => {
      setSourceId(id);
      discardResult();
    },
    [discardResult],
  );

  const changeDestination = useCallback(
    (id) => {
      setDestinationId(id);
      discardResult();
    },
    [discardResult],
  );

  // Update reports received from the barriers API.
  const updateBarrierReports = useCallback((reports) => {
    setBarrierReports(Array.isArray(reports) ? reports : []);
  }, []);

  /**
   * Find the original route.
   */
  const findRoute = useCallback(async () => {
    const validationError = validateSelection(sourceId, destinationId);

    if (validationError) {
      abortRef.current?.abort();
      detourAbortRef.current?.abort();

      setRoute(null);
      setStatus("error");
      setError(validationError);
      return;
    }

    const from = buildings.find(
      (building) => String(building.id) === String(sourceId),
    );

    const to = buildings.find(
      (building) => String(building.id) === String(destinationId),
    );

    if (!from || !to) {
      setRoute(null);
      setStatus("error");
      setError(
        "The selected building could not be found. Please choose again.",
      );
      return;
    }

    // Cancel any previous route and detour calculations.
    abortRef.current?.abort();
    detourAbortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setError("");
    setRoute(null);

    try {
      const availableRoutes = await fetchWalkingRoutes(
        from,
        to,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const originalRoute = availableRoutes[0];

      console.log("[Routing] Routes received:", availableRoutes.length);

      console.log(
        "[Routing] Active blockage reports:",
        getActiveReports(barrierReports).length,
      );

      setRoute({
        ...originalRoute,

        sourceId,
        destinationId,

        sourceBuilding: from,
        destinationBuilding: to,

        availableRoutes,

        activeBarrierReports: [],
        detourCoordinates: null,
        detourAvailable: false,
        detourStatus: "idle",
        detourMessage: "",
      });

      setStatus("success");
    } catch (err) {
      if (controller.signal.aborted) return;

      console.error("[Route calculation]", err);

      setStatus("error");
      setError(err.message || "Something went wrong while finding the route.");
    }
  }, [buildings, sourceId, destinationId, barrierReports]);

  /**
   * Recalculate the detour whenever:
   * - A new route is found.
   * - Barrier reports are updated.
   */
  useEffect(() => {
    if (!route?.availableRoutes?.length) return;

    detourAbortRef.current?.abort();

    const controller = new AbortController();
    detourAbortRef.current = controller;

    // Get all pending and in-progress reports,
    // regardless of their originally selected building pair.
    const allActiveReports = getActiveReports(barrierReports);

    // Check which reports actually affect this route.
    const activeReports = getReportsAffectingRoute(
      route.coordinates,
      allActiveReports,
    );

    console.log("[Routing] Blockages affecting selected route:", activeReports);

    // No blockage near the original route:
    // restore the normal blue route.
    if (activeReports.length === 0) {
      setRoute((current) => {
        if (!current || current.availableRoutes !== route.availableRoutes) {
          return current;
        }

        return {
          ...current,
          activeBarrierReports: [],
          detourCoordinates: null,
          detourAvailable: false,
          detourStatus: "idle",
          detourMessage: "",
        };
      });

      return () => controller.abort();
    }

    // A blockage affects this route.
    // Show the original route as blocked while searching.
    setRoute((current) => {
      if (!current || current.availableRoutes !== route.availableRoutes) {
        return current;
      }

      return {
        ...current,
        activeBarrierReports: activeReports,
        detourCoordinates: null,
        detourAvailable: false,
        detourStatus: "searching",
        detourMessage:
          "A blockage was detected. Searching for an alternative route...",
      };
    });

    async function calculateDetour() {
      try {
        const detour = await findDetourRoute(
          route.sourceBuilding,
          route.destinationBuilding,
          route.availableRoutes,
          activeReports,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        console.log("[Routing] Selected detour:", detour);

        setRoute((current) => {
          if (!current || current.availableRoutes !== route.availableRoutes) {
            return current;
          }

          if (!detour) {
            return {
              ...current,
              activeBarrierReports: activeReports,
              detourCoordinates: null,
              detourAvailable: false,
              detourStatus: "unavailable",
              detourMessage:
                "A blockage has been reported on this route, but no alternative route was found. Please do not assume the original route is clear.",
            };
          }

          return {
            ...current,
            activeBarrierReports: activeReports,
            detourCoordinates: detour.coordinates,
            detourDistanceMeters: detour.distanceMeters,
            detourDurationSeconds: detour.durationSeconds,
            detourAvailable: true,
            detourStatus: "available",
            detourMessage:
              "An alternative walking route was found. Step-free accessibility is not verified.",
          };
        });
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("[Detour calculation]", err);

        setRoute((current) => {
          if (!current || current.availableRoutes !== route.availableRoutes) {
            return current;
          }

          return {
            ...current,
            detourCoordinates: null,
            detourAvailable: false,
            detourStatus: "error",
            detourMessage:
              err.message ||
              "Could not calculate an alternative route. Please try again.",
          };
        });
      }
    }

    calculateDetour();

    return () => controller.abort();
  }, [
    barrierReports,
    route?.availableRoutes,
    route?.sourceId,
    route?.destinationId,
  ]);

  /**
   * Reset the route finder.
   */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    detourAbortRef.current?.abort();

    setSourceId("");
    setDestinationId("");

    setRoute(null);
    setError("");
    setStatus("idle");

    setResetCount((count) => count + 1);
  }, []);

  return {
    buildings,

    sourceId,
    destinationId,

    status,
    error,
    route,
    resetCount,

    changeSource,
    changeDestination,
    findRoute,
    reset,

    updateBarrierReports,
  };
}
