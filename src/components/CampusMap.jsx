
'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { getOverallStatus } from '../lib/accessibility';

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

  accessibility = [],
  onViewBuilding = undefined,

  routeCoordinates = null,
  blockedRouteCoordinates = null,
  detourCoordinates = null,

  barrierLocations = [],
  barrierLocation = null,
  focusedLocation = null,

  resetToken = 0,

  isPickingBarrierLocation = false,
  onBarrierLocationSelect = () => {},
}) {
  const mapContainer = useRef(null);
  const leaflet = useRef(null);

  // Keep the latest callback and selection mode without recreating the map.
  const pickingRef = useRef(isPickingBarrierLocation);
  const onSelectRef = useRef(onBarrierLocationSelect);

  // Keep the latest accessibility data and callback in refs so popups always read fresh data.
  const accessibilityRef = useRef(accessibility);
  const onViewBuildingRef = useRef(onViewBuilding);

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    pickingRef.current = isPickingBarrierLocation;
    onSelectRef.current = onBarrierLocationSelect;
  }, [isPickingBarrierLocation, onBarrierLocationSelect]);

  useEffect(() => {
    accessibilityRef.current = accessibility;
    onViewBuildingRef.current = onViewBuilding;
  }, [accessibility, onViewBuilding]);

  function buildBuildingPopup(building, roleLabel) {
    const container = document.createElement('div');
    container.className = 'campus-building-popup text-xs text-slate-800 space-y-1.5';
    container.style.maxWidth = '280px';

    // Header section: number, name, Start/End labels, unverified note
    const header = document.createElement('div');
    header.className = 'leading-tight';

    const titleStrong = document.createElement('strong');
    titleStrong.className = 'text-slate-900 font-semibold';
    titleStrong.textContent = `${building.number}. ${building.name}`;
    header.appendChild(titleStrong);

    if (roleLabel) {
      const roleDiv = document.createElement('div');
      roleDiv.className = 'text-[11px] font-medium text-slate-500 mt-0.5';
      roleDiv.textContent = `${roleLabel} of route`;
      header.appendChild(roleDiv);
    }

    if (!building.verified) {
      const unverifiedDiv = document.createElement('div');
      const em = document.createElement('em');
      em.className = 'text-[10px] text-amber-700';
      em.textContent = 'Placeholder location (not verified)';
      unverifiedDiv.appendChild(em);
      header.appendChild(unverifiedDiv);
    }

    container.appendChild(header);

    // Match marker to database building with campus key
    const accessibilityList = accessibilityRef.current || [];
    const dbBuilding = accessibilityList.find(
      (b) => (b.campusKey || b.campus_key) === building.id
    );

    if (!dbBuilding) {
      const noData = document.createElement('p');
      noData.className = 'text-[11px] text-slate-500 italic pt-1 border-t border-slate-200 mt-1';
      noData.textContent = `No accessibility data yet for ${building.name}`;
      container.appendChild(noData);

      if (typeof onViewBuildingRef.current === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mt-2 w-full text-center px-2.5 py-1 text-[11px] font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded transition cursor-pointer';
        btn.textContent = 'View details';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onViewBuildingRef.current(building.id);
        });
        container.appendChild(btn);
      }

      return container;
    }

    const rampsTotal = dbBuilding.rampsTotal ?? dbBuilding.ramps_total ?? 0;
    const rampsWorking = dbBuilding.rampsWorking ?? dbBuilding.ramps_working ?? 0;
    const liftsTotal = dbBuilding.liftsTotal ?? dbBuilding.lifts_total ?? 0;
    const liftsWorking = dbBuilding.liftsWorking ?? dbBuilding.lifts_working ?? 0;
    const stairsTotal = dbBuilding.stairsTotal ?? dbBuilding.stairs_total ?? 0;
    const stairsWorking = dbBuilding.stairsWorking ?? dbBuilding.stairs_working ?? 0;

    const features = [
      { label: 'Ramp', total: rampsTotal, working: rampsWorking },
      { label: 'Lift', total: liftsTotal, working: liftsWorking },
      { label: 'Stairs', total: stairsTotal, working: stairsWorking },
    ];

    const overall = getOverallStatus(features);
    if (overall) {
      const statusLine = document.createElement('div');
      statusLine.className = 'flex items-center gap-1.5 pt-1 border-t border-slate-200 font-medium text-[11px]';

      const dot = document.createElement('span');
      dot.className = 'w-2 h-2 rounded-full inline-block shrink-0';

      if (overall.tone === 'green') {
        dot.className += ' bg-green-600';
        statusLine.className += ' text-green-700';
      } else if (overall.tone === 'orange') {
        dot.className += ' bg-amber-500';
        statusLine.className += ' text-amber-700';
      } else {
        dot.className += ' bg-red-600';
        statusLine.className += ' text-red-700';
      }

      const labelSpan = document.createElement('span');
      labelSpan.textContent = overall.label;

      statusLine.appendChild(dot);
      statusLine.appendChild(labelSpan);
      container.appendChild(statusLine);
    }

    const table = document.createElement('table');
    table.className = 'w-full text-left border-collapse text-[11px] mt-1';

    const thead = document.createElement('thead');
    const trHead = document.createElement('tr');
    trHead.className = 'border-b border-slate-200 text-slate-500 font-semibold';

    const thFeature = document.createElement('th');
    thFeature.scope = 'col';
    thFeature.className = 'py-0.5 pr-1 font-semibold';
    thFeature.textContent = 'Feature';

    const thQuantity = document.createElement('th');
    thQuantity.scope = 'col';
    thQuantity.className = 'py-0.5 px-1 text-center font-semibold';
    thQuantity.textContent = 'Quantity';

    const thStatus = document.createElement('th');
    thStatus.scope = 'col';
    thStatus.className = 'py-0.5 pl-1 text-right font-semibold';
    thStatus.textContent = 'Working / Not working';

    trHead.appendChild(thFeature);
    trHead.appendChild(thQuantity);
    trHead.appendChild(thStatus);
    thead.appendChild(trHead);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.className = 'divide-y divide-slate-100 text-slate-700';

    features.forEach((f) => {
      const tr = document.createElement('tr');

      const tdFeature = document.createElement('td');
      tdFeature.className = 'py-0.5 pr-1 font-medium';
      tdFeature.textContent = f.label;

      const tdQuantity = document.createElement('td');
      tdQuantity.className = 'py-0.5 px-1 text-center';
      tdQuantity.textContent = String(f.total);

      const tdStatus = document.createElement('td');
      tdStatus.className = 'py-0.5 pl-1 text-right';

      const notWorking = Math.max(0, f.total - f.working);
      if (f.total === 0) {
        tdStatus.textContent = 'None in this building';
        tdStatus.className += ' text-slate-400 italic';
      } else {
        tdStatus.textContent = `${f.working} working / ${notWorking} not working`;
      }

      tr.appendChild(tdFeature);
      tr.appendChild(tdQuantity);
      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    if (typeof onViewBuildingRef.current === 'function') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mt-2 w-full text-center px-2.5 py-1 text-[11px] font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded transition cursor-pointer';
      btn.textContent = 'View details';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onViewBuildingRef.current(dbBuilding.campusKey || dbBuilding.campus_key || building.id);
      });
      container.appendChild(btn);
    }

    return container;
  }

  
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

      marker.bindPopup(() => buildBuildingPopup(building, roleLabel), {
        maxWidth: 280,
      });

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

  // Pan and zoom to focused location (e.g. when staff clicks "View on Map")
  useEffect(() => {
    const ctx = leaflet.current;

    if (!mapReady || !ctx || !focusedLocation) return;

    const [lat, lng] = focusedLocation;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      ctx.map.setView([Number(lat), Number(lng)], 18, { animate: true });
    }
  }, [mapReady, focusedLocation]);

  return (
    <div
      ref={mapContainer}
      aria-label="Campus map"
      className="w-full h-full min-h-[480px] rounded-lg overflow-hidden border border-slate-200 shadow-sm"
    />
  );
}
