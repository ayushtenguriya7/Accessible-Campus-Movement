/**
 * Routing helpers for Module 1 – Accessible Route Service.
 *
 * IMPORTANT — what this module does and does NOT guarantee
 * --------------------------------------------------------
 * `fetchWalkingRoute` asks an OSRM-compatible routing service for a *pedestrian*
 * route that follows real paths in OpenStreetMap data. That is a BASIC WALKING ROUTE.
 * OSM/OSRM foot routing does not know whether a path is step-free, has ramps or lifts,
 * or is currently blocked, so these routes are NOT verified as wheelchair-accessible.
 * Every result therefore carries `stepFreeVerified: false`. Accessibility validation
 * (verified step-free edges, barrier reports, etc.) should be added as a separate step
 * and only then flip that flag.
 *
 * Configuration
 * -------------
 * NEXT_PUBLIC_ROUTING_BASE_URL (optional, see .env.example)
 *   Base URL of an OSRM-compatible `/route/v1/<profile>` endpoint, without a trailing
 *   slash. Defaults to the community-run OSM foot-routing instance below, which is a
 *   free public service intended for light use only (no SLA, no API key). For
 *   production, self-host OSRM with the foot profile or use a hosted provider.
 */

export const ROUTING_BASE_URL = (
  process.env.NEXT_PUBLIC_ROUTING_BASE_URL ||
  // Note: this instance serves the foot profile even though the path segment says "driving".
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving'
).replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = 12000;

/** Shown in the UI next to every route so basic routing is never mistaken for verified accessibility. */
export const STEP_FREE_NOTICE =
  'Basic walking route from OpenStreetMap data. Step-free / wheelchair accessibility has NOT been verified for this route.';

/**
 * Validate a source/destination selection.
 * @returns {string} an error message, or '' when the selection is valid.
 */
export function validateSelection(sourceId, destinationId) {
  if (!sourceId && !destinationId) return 'Please select both a source and a destination building.';
  if (!sourceId) return 'Please select a source building.';
  if (!destinationId) return 'Please select a destination building.';
  if (sourceId === destinationId) return 'Source and destination must be different buildings.';
  return '';
}

/**
 * Request a walking route between two buildings.
 *
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {AbortSignal} [signal] lets the caller cancel a stale request
 * @returns {Promise<{coordinates:[number,number][], distanceMeters:number, durationSeconds:number, stepFreeVerified:false}>}
 *   `coordinates` are Leaflet-ordered [lat, lng] pairs.
 * @throws {Error} with a user-presentable message on any failure
 */
export async function fetchWalkingRoute(from, to, signal) {
  const url =
    `${ROUTING_BASE_URL}/${from.lng},${from.lat};${to.lng},${to.lat}` +
    '?overview=full&geometries=geojson&steps=false';

  // Combine the caller's abort signal with our own timeout.
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    const res = await fetch(url, { signal: timeoutController.signal });
    if (!res.ok) {
      throw new Error(`The routing service responded with an error (HTTP ${res.status}).`);
    }

    const data = await res.json();
    const best = data?.routes?.[0];
    if (data?.code !== 'Ok' || !best?.geometry?.coordinates?.length) {
      throw new Error('No walking route could be found between these two buildings.');
    }

    return {
      // GeoJSON is [lng, lat]; Leaflet expects [lat, lng].
      coordinates: best.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      distanceMeters: best.distance,
      durationSeconds: best.duration,
      stepFreeVerified: false,
    };
  } catch (err) {
    if (signal?.aborted) {
      // Caller cancelled (newer search started / component unmounted): let it handle silently.
      throw err;
    }
    if (err.name === 'AbortError') {
      throw new Error('The routing service took too long to respond. Please try again.');
    }
    if (err instanceof TypeError) {
      // fetch() rejects with TypeError for network failures and CORS/blocked requests.
      throw new Error(
        'Could not reach the routing service. Check your internet connection or the NEXT_PUBLIC_ROUTING_BASE_URL setting.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** "850 m" / "1.4 km" */
export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

/** "3 min" / "1 h 5 min" (rounded up so very short walks never show "0 min") */
export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
