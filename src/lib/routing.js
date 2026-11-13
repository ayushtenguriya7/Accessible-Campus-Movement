/**
 * Routing helpers for the Accessible Route Service.
 *
 * IMPORTANT:
 * These are basic OpenStreetMap walking routes.
 * They are NOT verified as step-free or wheelchair-accessible.
 */

export const ROUTING_BASE_URL = (
  process.env.NEXT_PUBLIC_ROUTING_BASE_URL ||
  "https://routing.openstreetmap.de/routed-foot/route/v1/driving"
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 30000;

// Retry HTTP 429 up to 3 times after the first attempt.
const MAX_429_RETRIES = 3;

// Small GPS tolerance around the exact reported blockage point.
// This is NOT a limit on how much longer a detour can be.
const BARRIER_POINT_TOLERANCE_METERS = 5;



// Generate candidate waypoints at different distances around a blockage.
const WAYPOINT_OFFSETS_METERS = [45, 90, 150];

// Only one waypoint request at a time to reduce server rate limiting.
const MAX_PARALLEL_REQUESTS = 1;

export const STEP_FREE_NOTICE =
  "Basic walking route from OpenStreetMap data. Step-free / wheelchair accessibility has NOT been verified for this route.";

/**
 * Validate a source/destination selection.
 */
export function validateSelection(sourceId, destinationId) {
  if (!sourceId && !destinationId) {
    return "Please select both a source and a destination building.";
  }

  if (!sourceId) {
    return "Please select a source building.";
  }

  if (!destinationId) {
    return "Please select a destination building.";
  }

  if (sourceId === destinationId) {
    return "Source and destination must be different buildings.";
  }

  return "";
}

/**
 * Convert OSRM route geometry into our application format.
 * GeoJSON coordinates are [longitude, latitude].
 * Leaflet expects [latitude, longitude].
 */
function normalizeRoute(route) {
  return {
    coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    stepFreeVerified: false,
  };
}

/**
 * Wait while allowing the caller to cancel the request.
 */
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Route request cancelled."));
      return;
    }

    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
      reject(new Error("Route request cancelled."));
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Read Retry-After from the server.
 * If the server does not provide it, use exponential backoff.
 */
function getRetryDelay(response, attempt) {
  const retryAfter = response.headers.get("Retry-After");

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }

    const retryDate = Date.parse(retryAfter);

    if (!Number.isNaN(retryDate)) {
      return Math.max(0, retryDate - Date.now());
    }
  }

  return 1000 * 2 ** attempt;
}

/**
 * Make a request to the OSRM routing service.
 * HTTP 429 responses are retried with increasing delays.
 */
async function requestOSRM(url, signal) {
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error("Route request cancelled.");
    }

    const timeoutController = new AbortController();

    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, REQUEST_TIMEOUT_MS);

    const onCallerAbort = () => {
      timeoutController.abort();
    };

    signal?.addEventListener("abort", onCallerAbort);

    let retryDelay = null;

    try {
      const response = await fetch(url, {
        signal: timeoutController.signal,
      });

      if (response.status === 429) {
        if (attempt === MAX_429_RETRIES) {
          const error = new Error(
            "The routing service is receiving too many requests. Please wait a little and try again.",
          );

          error.status = 429;
          throw error;
        }

        retryDelay = getRetryDelay(response, attempt);

        console.warn(
          `[Routing] HTTP 429. Retrying in ${Math.ceil(retryDelay / 1000)} seconds.`,
        );
      } else {
        if (!response.ok) {
          const error = new Error(
            `The routing service responded with an error (HTTP ${response.status}).`,
          );

          error.status = response.status;
          throw error;
        }

        const data = await response.json();

        if (data?.code !== "Ok" || !data?.routes?.length) {
          return [];
        }

        return data.routes
          .filter((route) => route.geometry?.coordinates?.length > 0)
          .map(normalizeRoute);
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }

      if (error.status) {
        throw error;
      }

      if (error.name === "AbortError") {
        throw new Error(
          "The routing service took too long to respond. Please try again.",
        );
      }

      if (error instanceof TypeError) {
        throw new Error(
          "Could not reach the routing service. Check your internet connection or NEXT_PUBLIC_ROUTING_BASE_URL.",
        );
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onCallerAbort);
    }

    // Wait outside the request timeout before retrying.
    if (retryDelay !== null) {
      console.warn("[Routing] Waiting before retrying...");

      await wait(retryDelay, signal);
    }
  }

  return [];
}

/**
 * Fetch the normal walking route and alternatives from OSRM.
 */
export async function fetchWalkingRoutes(from, to, signal) {
  const url =
    `${ROUTING_BASE_URL}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    "?overview=full&geometries=geojson&steps=false&alternatives=3";

  const routes = await requestOSRM(url, signal);

  if (signal?.aborted) {
    throw new Error("Route request cancelled.");
  }

  if (!routes.length) {
    throw new Error(
      "No walking route could be found between these two buildings.",
    );
  }

  return routes;
}

/**
 * Backward-compatible helper.
 * Returns only the best/normal walking route.
 */
export async function fetchWalkingRoute(from, to, signal) {
  const routes = await fetchWalkingRoutes(from, to, signal);

  return routes[0];
}

/**
 * Calculate approximate distance between two GPS points in metres.
 */
function distanceBetweenPointsMeters(pointA, pointB) {
  const earthRadius = 6371000;

  const lat1 = (pointA[0] * Math.PI) / 180;
  const lat2 = (pointB[0] * Math.PI) / 180;

  const deltaLat = ((pointB[0] - pointA[0]) * Math.PI) / 180;
  const deltaLng = ((pointB[1] - pointA[1]) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate shortest distance from a GPS point
 * to a route segment using a local metre-based projection.
 *
 * Coordinates use Leaflet format: [latitude, longitude].
 */
function distancePointToSegmentMeters(point, start, end) {
  const referenceLatitude = (point[0] + start[0] + end[0]) / 3;

  const metersPerDegreeLat = 110540;

  const metersPerDegreeLng =
    111320 * Math.cos((referenceLatitude * Math.PI) / 180);

  const project = ([lat, lng]) => ({
    x: lng * metersPerDegreeLng,
    y: lat * metersPerDegreeLat,
  });

  const p = project(point);
  const a = project(start);
  const b = project(end);

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared;

  t = Math.max(0, Math.min(1, t));

  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;

  return Math.hypot(p.x - closestX, p.y - closestY);
}

/**
 * Find the minimum distance from a blockage
 * to the complete route geometry.
 */
export function getMinimumDistanceToRoute(routeCoordinates, location) {
  if (!routeCoordinates?.length) {
    return Infinity;
  }

  const point = [Number(location.latitude), Number(location.longitude)];

  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    return 0;
  }

  if (routeCoordinates.length === 1) {
    return distanceBetweenPointsMeters(point, routeCoordinates[0]);
  }

  let minimumDistance = Infinity;

  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    const distance = distancePointToSegmentMeters(
      point,
      routeCoordinates[i],
      routeCoordinates[i + 1],
    );

    minimumDistance = Math.min(minimumDistance, distance);
  }

  return minimumDistance;
}

/**
 * Check whether a route avoids ALL active blockage locations.
 */
function routeAvoidsAllReports(route, activeReports) {
  return activeReports.every((report) => {
    const distance = getMinimumDistanceToRoute(route.coordinates, report);

    return distance > BARRIER_POINT_TOLERANCE_METERS;
  });
}





/**
 * Generate eight possible waypoint locations
 * around a reported blockage at multiple distances.
 */
function generateWaypoints(report) {
  const latitude = Number(report.latitude);
  const longitude = Number(report.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return [];
  }

  const waypoints = [];

  for (const offset of WAYPOINT_OFFSETS_METERS) {
    const latOffset = offset / 110540;

    const lngOffset = offset / (111320 * Math.cos((latitude * Math.PI) / 180));

    for (let angle = 0; angle < 360; angle += 45) {
      const radians = (angle * Math.PI) / 180;

      waypoints.push({
        lat: latitude + latOffset * Math.sin(radians),
        lng: longitude + lngOffset * Math.cos(radians),
      });
    }
  }

  return waypoints;
}

/**
 * Request a walking route through a candidate waypoint.
 */

async function fetchRouteViaWaypoint(from, waypoint, to, signal) {
  const url =
    `${ROUTING_BASE_URL}/` +
    `${from.lng},${from.lat};` +
    `${waypoint.lng},${waypoint.lat};` +
    `${to.lng},${to.lat}` +
    "?overview=full&geometries=geojson&steps=false&alternatives=false";

  const routes = await requestOSRM(url, signal);

  return routes[0] ?? null;
}
/**
 * Execute candidate requests with limited concurrency.
 * Only one request is sent at a time to reduce HTTP 429 errors.
 */
async function runWithConcurrency(items, worker, signal) {
  const results = new Array(items.length);

  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      if (signal?.aborted) {
        return;
      }

      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }

        // Stop the batch if the routing service still rate-limits us.
        if (error.status === 429) {
          throw error;
        }

        // A failed candidate does not cancel other candidates.
        results[index] = null;
      }
    }
  }

  const workerCount = Math.min(MAX_PARALLEL_REQUESTS, items.length);

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  if (signal?.aborted) {
    throw new Error("Detour calculation cancelled.");
  }

  return results.filter(Boolean);
}

/**
 * Find the shortest valid detour.
 *
 * Strategy:
 * 1. Check OSRM's existing alternative routes.
 * 2. Generate waypoint candidates around every active blockage.
 * 3. Request routes through those waypoints, one at a time.
 * 4. Reject routes that pass through any active blockage point.
 * 5. Choose the shortest remaining valid route.
 *
 * There is NO maximum detour-distance limit.
 */
export async function findDetourRoute(
  from,
  to,
  availableRoutes,
  activeReports,
  signal,
) {
  if (!activeReports?.length) {
    return null;
  }

  // First check the alternatives already returned by OSRM.
  const existingAlternatives = (availableRoutes ?? []).slice(1);

  const validExisting = existingAlternatives
    .filter((route) => routeAvoidsAllReports(route, activeReports))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  if (validExisting.length > 0) {
    return validExisting[0];
  }

  if (signal?.aborted) {
    throw new Error("Detour calculation cancelled.");
  }

  // Generate candidates around every active blockage.
  const candidates = activeReports.flatMap((report) =>
    generateWaypoints(report),
  );

  if (candidates.length === 0) {
    return null;
  }

  console.log(
    `[Detour] Checking ${candidates.length} waypoint candidates sequentially.`,
  );

  // Request routes through the generated waypoints.
  const candidateRoutes = await runWithConcurrency(
    candidates,
    (waypoint) => fetchRouteViaWaypoint(from, waypoint, to, signal),
    signal,
  );

  if (signal?.aborted) {
    throw new Error("Detour calculation cancelled.");
  }

  // Keep only routes avoiding every active blockage.
  // Sort by distance and select the shortest valid route.
  const validCandidates = candidateRoutes
    .filter((route) => routeAvoidsAllReports(route, activeReports))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return validCandidates[0] ?? null;
}

/**
 * Format distance: "850 m" / "1.4 km".
 */
export function formatDistance(meters) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration: "3 min" / "1 h 5 min".
 */
export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
