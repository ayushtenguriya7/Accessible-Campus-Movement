'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

export default function CampusMap() {
  // Reference to the HTML <div> where Leaflet renders the map
  const mapContainer = useRef(null);

  useEffect(() => {
    // Leaflet requires browser window, so we import it inside useEffect
    import('leaflet').then((L) => {
      // Prevent initializing the map more than once
      if (!mapContainer.current || mapContainer.current._leaflet_id) {
        return;
      }

      // Center point for Lovely Professional University (LPU)
      const lpuCenterCoordinates = [31.2536, 75.7037];

      // Expanded boundary limits covering all corners of LPU campus
      const campusBoundaryLimits = [
        [31.2430, 75.6940], // Southwest boundary (Law Gate & Hospital)
        [31.2635, 75.7135], // Northeast boundary (GT Road Entry & Hostels)
      ];

      // Step 1: Create the Leaflet map instance
      const campusMap = L.map(mapContainer.current, {
        center: lpuCenterCoordinates,
        zoom: 16,
        minZoom: 14,
        maxZoom: 19, // Allows zooming into campus roads and building corners
        maxBounds: campusBoundaryLimits,
        maxBoundsViscosity: 0.4, // Smooth edge scrolling without cutting off corners
      });

      // Step 2: Add standard OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors | LPU Campus',
      }).addTo(campusMap);
    });
  }, []);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full min-h-[480px] rounded-lg overflow-hidden border border-slate-200 shadow-sm"
    />
  );
}
