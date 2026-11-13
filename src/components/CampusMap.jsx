
'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

const LPU_CENTER_COORDINATES = [31.2536, 75.7037];
const DEFAULT_ZOOM = 16;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createBuildingIcon(L, number, role) {
  const color =
    role === 'source'
      ? 'bg-green-600'
      : role === 'destination'
        ? 'bg-red-600'
        : 'bg-orange-500';

  const size = role ? 'w-9 h-9 text-sm' : 'w-8 h-8 text-xs';
  const px = role ? 36 : 32;

  return L.divIcon({
    className: 'campus-building-marker',
    html: `<div class="${color} ${size} flex items-center justify-center rounded-full border-2 border-white text-white font-bold shadow-md">${escapeHtml(number)}</div>`,
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
    popupAnchor: [0, -px / 2],
  });
}

export default function CampusMap({
  buildings = [],
  sourceId = '',
  destinationId = '',

  routeCoordinates = null,
  blockedRouteCoordinates = null,
  detourCoordinates = null,

  barrierLocations = [],
  barrierLocation = null,

  resetToken = 0,

  isPickingBarrierLocation = false,
  onBarrierLocationSelect = () => {},
}) {
  const mapContainer = useRef(null);
  const leaflet = useRef(null);

  // Keep the latest callback and selection mode without recreating the map.
  const pickingRef = useRef(isPickingBarrierLocation);
  const onSelectRef = useRef(onBarrierLocationSelect);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    pickingRef.current = isPickingBarrierLocation;
    onSelectRef.current = onBarrierLocationSelect;
  }, [isPickingBarrierLocation, onBarrierLocationSelect]);

  
  // Initialize Leaflet map once.
  useEffect(() => {
    let cancelled = false;

    import('leaflet')
      .then((L) => {
        if (
          cancelled ||
          !mapContainer.current ||
          mapContainer.current._leaflet_id
        ) {
          return;
        }

        const campusBoundaryLimits = [
          [31.2430, 75.6940],
          [31.2635, 75.7135],
        ];

        const campusMap = L.map(mapContainer.current, {
          center: LPU_CENTER_COORDINATES,
          zoom: DEFAULT_ZOOM,
          minZoom: 14,
          maxZoom: 19,
          maxBounds: campusBoundaryLimits,
          maxBoundsViscosity: 0.4,
        });

        L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution:
              '&copy; OpenStreetMap contributors | LPU Campus',
          }
        ).addTo(campusMap);

        const routeLayer = L.layerGroup().addTo(campusMap);
        const markerLayer = L.layerGroup().addTo(campusMap);
        const barrierLayer = L.layerGroup().addTo(campusMap);

        // Map clicks select the exact blockage location only in picking mode.
        const handleMapClick = (event) => {
          if (!pickingRef.current) return;

          onSelectRef.current?.({
            latitude: event.latlng.lat,
            longitude: event.latlng.lng,
          });
        };

        campusMap.on('click', handleMapClick);

        leaflet.current = {
          L,
          map: campusMap,
          routeLayer,
          markerLayer,
          barrierLayer,
          handleMapClick,
        };

        setMapReady(true);
      })
      .catch((error) => {
        console.error('Failed to load Leaflet:', error);
      });

    return () => {
      cancelled = true;

      if (leaflet.current) {
        const ctx = leaflet.current;

        ctx.map.off('click', ctx.handleMapClick);
        ctx.map.remove();

        leaflet.current = null;
      }

      setMapReady(false);
    };
  }, []);


  // Draw building markers.
  useEffect(() => {
    const ctx = leaflet.current;

    if (!mapReady || !ctx) return;

    const { L, markerLayer } = ctx;

    markerLayer.clearLayers();

    buildings.forEach((building) => {
      const role =
        building.id === sourceId
          ? 'source'
          : building.id === destinationId
            ? 'destination'
            : null;

      const marker = L.marker(
        [building.lat, building.lng],
        {
          icon: createBuildingIcon(L, building.number, role),
          title: building.name,
          alt: building.name,
          zIndexOffset: role ? 1000 : 0,
        }
      ).addTo(markerLayer);

      const roleLabel =
        role === 'source'
          ? 'Start'
          : role === 'destination'
            ? 'End'
            : '';

      const unverifiedNote = building.verified
        ? ''
        : '<br/><em>Placeholder location (not verified)</em>';

      marker.bindPopup(
        `<strong>${escapeHtml(building.number)}. ${escapeHtml(building.name)}</strong>${
          roleLabel ? `<br/>${roleLabel} of route` : ''
        }${unverifiedNote}`
      );

      marker.bindTooltip(
        role
          ? `${roleLabel}: ${escapeHtml(building.name)}`
          : escapeHtml(building.name),
        {
          direction: 'top',
          permanent: Boolean(role),
        }
      );
    });
  }, [mapReady, buildings, sourceId, destinationId]);

  // Draw normal route, blocked route and detour.
  useEffect(() => {
    const ctx = leaflet.current;

    if (!mapReady || !ctx) return;

    const { L, map, routeLayer } = ctx;

    routeLayer.clearLayers();

    const boundsLines = [];

    if (blockedRouteCoordinates?.length) {
      const blockedLine = L.polyline(
        blockedRouteCoordinates,
        {
          color: '#dc2626',
          weight: 6,
          opacity: 0.9,
          dashArray: '10 8',
        }
      ).addTo(routeLayer);

      boundsLines.push(blockedLine);
    } else if (routeCoordinates?.length) {
      const normalLine = L.polyline(routeCoordinates, {
        color: '#2563eb',
        weight: 5,
        opacity: 0.85,
      }).addTo(routeLayer);

      boundsLines.push(normalLine);
    }

    if (detourCoordinates?.length) {
      const detourLine = L.polyline(detourCoordinates, {
        color: '#16a34a',
        weight: 6,
        opacity: 0.95,
      }).addTo(routeLayer);

      boundsLines.push(detourLine);
    }

    if (boundsLines.length) {
      const combinedBounds = L.featureGroup(boundsLines).getBounds();

      map.fitBounds(combinedBounds, {
        padding: [40, 40],
      });
    }
  }, [
    mapReady,
    routeCoordinates,
    blockedRouteCoordinates,
    detourCoordinates,
  ]);

  // Show active blockage markers and the newly selected report location.
  useEffect(() => {
    const ctx = leaflet.current;

    if (!mapReady || !ctx) return;

    const { L, barrierLayer } = ctx;

    barrierLayer.clearLayers();

    barrierLocations.forEach((report) => {
      const latitude = Number(report.latitude);
      const longitude = Number(report.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const marker = L.circleMarker(
        [latitude, longitude],
        {
          radius: 9,
          color: '#991b1b',
          weight: 2,
          fillColor: '#ef4444',
          fillOpacity: 1,
        }
      ).addTo(barrierLayer);

      marker.bindPopup(
        `<strong>Reported blockage</strong><br/>${escapeHtml(
          report.barrierType || report.barrier_type || 'Barrier'
        )}<br/>Status: ${escapeHtml(report.status || 'pending')}`
      );
    });

    if (
  barrierLocation &&
  Number.isFinite(Number(barrierLocation.latitude)) &&
  Number.isFinite(Number(barrierLocation.longitude))
) {
      const selectedMarker = L.circleMarker(
        [
          barrierLocation.latitude,
          barrierLocation.longitude,
        ],
        {
          radius: 10,
          color: '#9a3412',
          weight: 3,
          fillColor: '#fb923c',
          fillOpacity: 1,
        }
      ).addTo(barrierLayer);

      selectedMarker.bindPopup(
        '<strong>Selected blockage location</strong>'
      );
    }
  }, [mapReady, barrierLocations, barrierLocation]);

  // Change cursor while selecting a report location.
  useEffect(() => {
    const ctx = leaflet.current;

    if (!mapReady || !ctx) return;

    ctx.map.getContainer().style.cursor =
      isPickingBarrierLocation ? 'crosshair' : '';
  }, [mapReady, isPickingBarrierLocation]);

  // Re-center when Reset is pressed.
  useEffect(() => {
    const ctx = leaflet.current;

    if (!mapReady || !ctx || !resetToken) return;

    ctx.map.setView(
      LPU_CENTER_COORDINATES,
      DEFAULT_ZOOM
    );
  }, [mapReady, resetToken]);

  return (
    <div
      ref={mapContainer}
      aria-label="Campus map"
      className="w-full h-full min-h-[480px] rounded-lg overflow-hidden border border-slate-200 shadow-sm"
    />
  );
}
