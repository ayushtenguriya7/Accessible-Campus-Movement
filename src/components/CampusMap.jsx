'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

// Center point for Lovely Professional University (LPU)
const LPU_CENTER_COORDINATES = [31.2536, 75.7037];
const DEFAULT_ZOOM = 16;

// Building names come from our own data file, but escape them anyway before putting them in HTML strings.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Numbered round marker. Color shows the role: green = source, red = destination, orange = other building.
function createBuildingIcon(L, number, role) {
  const color =
    role === 'source' ? 'bg-green-600' : role === 'destination' ? 'bg-red-600' : 'bg-orange-500';
  const size = role ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  const px = role ? 36 : 32;

  return L.divIcon({
    className: 'campus-building-marker', // replaces Leaflet's default white box styling
    html: `<div class="${color} ${size} flex items-center justify-center rounded-full border-2 border-white text-white font-bold shadow-md">${escapeHtml(number)}</div>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
    popupAnchor: [0, -px / 2],
    tooltipAnchor: [0, -px / 2],
  });
}

/**
 * Props (all optional so the map still renders on its own):
 *  - buildings         [{ id, number, name, lat, lng, verified }]
 *  - sourceId          id of the selected source building
 *  - destinationId     id of the selected destination building
 *  - routeCoordinates  [[lat, lng], ...] polyline to draw, or null
 *  - resetToken        increment to re-center the map on the campus
 */
export default function CampusMap({
  buildings = [],
  sourceId = '',
  destinationId = '',
  routeCoordinates = null,
  resetToken = 0,
}) {
  // Reference to the HTML <div> where Leaflet renders the map
  const mapContainer = useRef(null);
  // Holds { L, map, routeLayer, markerLayer } once Leaflet has loaded in the browser
  const leaflet = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  // Step 1: Create the map once (client-side only)
  useEffect(() => {
    let cancelled = false;

    // Leaflet requires browser window, so we import it inside useEffect
    import('leaflet').then((L) => {
      // Prevent initializing the map more than once
      if (cancelled || !mapContainer.current || mapContainer.current._leaflet_id) {
        return;
      }

      // Expanded boundary limits covering all corners of LPU campus
      const campusBoundaryLimits = [
        [31.2430, 75.6940], // Southwest boundary (Law Gate & Hospital)
        [31.2635, 75.7135], // Northeast boundary (GT Road Entry & Hostels)
      ];

      const campusMap = L.map(mapContainer.current, {
        center: LPU_CENTER_COORDINATES,
        zoom: DEFAULT_ZOOM,
        minZoom: 14,
        maxZoom: 19, // Allows zooming into campus roads and building corners
        maxBounds: campusBoundaryLimits,
        maxBoundsViscosity: 0.4, // Smooth edge scrolling without cutting off corners
      });

      // Step 2: Add standard OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | LPU Campus',
      }).addTo(campusMap);

      // Route layer is added first so building markers always sit on top of the route line.
      const routeLayer = L.layerGroup().addTo(campusMap);
      const markerLayer = L.layerGroup().addTo(campusMap);

      leaflet.current = { L, map: campusMap, routeLayer, markerLayer };
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (leaflet.current) {
        leaflet.current.map.remove();
        leaflet.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Step 3: Draw building markers; re-drawn when the selection changes so roles are highlighted.
  useEffect(() => {
    const ctx = leaflet.current;
    if (!mapReady || !ctx) return;
    const { L, markerLayer } = ctx;

    markerLayer.clearLayers();

    buildings.forEach((building) => {
      const role =
        building.id === sourceId ? 'source' : building.id === destinationId ? 'destination' : null;

      const marker = L.marker([building.lat, building.lng], {
        icon: createBuildingIcon(L, building.number, role),
        title: building.name,
        alt: building.name,
        zIndexOffset: role ? 1000 : 0,
      }).addTo(markerLayer);

      const roleLabel = role === 'source' ? 'Start' : role === 'destination' ? 'End' : '';
      const unverifiedNote = building.verified ? '' : '<br/><em>Placeholder location (not verified)</em>';

      marker.bindPopup(
        `<strong>${escapeHtml(building.number)}. ${escapeHtml(building.name)}</strong>${
          roleLabel ? `<br/>${roleLabel} of route` : ''
        }${unverifiedNote}`
      );

      // Selected buildings always show a label; others show their name on hover.
      marker.bindTooltip(
        role ? `${roleLabel}: ${escapeHtml(building.name)}` : escapeHtml(building.name),
        { direction: 'top', permanent: Boolean(role) }
      );
    });
  }, [mapReady, buildings, sourceId, destinationId]);

  // Step 4: Draw (or clear) the route line.
  useEffect(() => {
    const ctx = leaflet.current;
    if (!mapReady || !ctx) return;
    const { L, map, routeLayer } = ctx;

    routeLayer.clearLayers();
    if (!routeCoordinates || routeCoordinates.length === 0) return;

    // Blue on purpose: green is used elsewhere in the UI to mean "verified step-free".
    const line = L.polyline(routeCoordinates, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(
      routeLayer
    );
    map.fitBounds(line.getBounds(), { padding: [40, 40] });
  }, [mapReady, routeCoordinates]);

  // Step 5: Re-center on the campus when the user presses Reset.
  useEffect(() => {
    const ctx = leaflet.current;
    if (!mapReady || !ctx || !resetToken) return;
    ctx.map.setView(LPU_CENTER_COORDINATES, DEFAULT_ZOOM);
  }, [mapReady, resetToken]);

  return (
    <div
      ref={mapContainer}
      aria-label="Campus map"
      className="w-full h-full min-h-[480px] rounded-lg overflow-hidden border border-slate-200 shadow-sm"
    />
  );
}
