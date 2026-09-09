'use client';

// Interactive Leaflet map picker for a Task's geofence anchor (D-19). Controlled:
// the parent owns lat/lng/radiusMeters (derived from the form's string inputs via
// @orqafy/shared `parseGeofenceStrings`) and receives map clicks / marker drags
// through `onChange`. The numeric inputs stay the source of truth for precision
// and a11y — this is an additive, visual way to set the same values.
//
// Must be mounted client-only (leaflet touches `window`); the consumer dynamic-
// imports it with `ssr: false`. Uses an inline-SVG `divIcon` so no external marker
// image / CDN asset is needed (CSP- and offline-safe; AGPL-public repo).

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '../../lib/utils';

// This package compiles with `types: []` (no @types/node). `process.env.NEXT_PUBLIC_*`
// is statically inlined by Next at build time; declare the global so tsc is happy
// without pulling Node globals into this DOM-only package.
declare const process: { env: Record<string, string | undefined> };

const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Inline-SVG pin (no external marker image → no leaflet default-icon asset fix). */
const PIN_ICON = L.divIcon({
  className: 'orqafy-map-pin',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="#e11d48" stroke="#ffffff" stroke-width="1.5" aria-hidden="true"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5" fill="#ffffff" stroke="none"/></svg>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

export interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  radiusMeters: number | null;
  onChange: (next: { lat: number; lng: number }) => void;
  /** Fallback center when no lat/lng is set yet. Default: Manila. */
  defaultCenter?: [number, number];
  className?: string;
}

/** Recenter the map whenever the marker position changes. */
function Recenter({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom());
  }, [map, position]);
  return null;
}

/** Translate a map click into an onChange with the clicked coordinates. */
function ClickCapture({ onChange }: { onChange: MapPickerProps['onChange'] }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export function MapPicker({
  lat,
  lng,
  radiusMeters,
  onChange,
  defaultCenter = [14.5995, 120.9842],
  className,
}: MapPickerProps) {
  const markerRef = useRef<L.Marker>(null);

  const hasPoint = lat !== null && lng !== null;
  const position = useMemo<[number, number] | null>(
    () => (hasPoint ? [lat, lng] : null),
    [hasPoint, lat, lng],
  );

  return (
    <div className={cn('h-64 w-full overflow-hidden rounded-md border', className)}>
      <MapContainer
        center={position ?? defaultCenter}
        zoom={position ? 15 : 11}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ClickCapture onChange={onChange} />
        <Recenter position={position} />
        {position ? (
          <Marker
            draggable
            position={position}
            icon={PIN_ICON}
            ref={markerRef}
            eventHandlers={{
              dragend() {
                const next = markerRef.current?.getLatLng();
                if (next) onChange({ lat: next.lat, lng: next.lng });
              },
            }}
          />
        ) : null}
        {position && radiusMeters !== null && radiusMeters > 0 ? (
          <Circle center={position} radius={radiusMeters} />
        ) : null}
      </MapContainer>
    </div>
  );
}
