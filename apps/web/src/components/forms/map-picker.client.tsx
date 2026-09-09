'use client';

// Thin client-only loader for the Leaflet `MapPicker` from @orqafy/ui. Leaflet
// touches `window`, so it must never render on the server — `ssr: false` keeps it
// out of the server bundle and code-splits the map (+ leaflet) into its own chunk.
import dynamic from 'next/dynamic';

export const MapPicker = dynamic(() => import('@orqafy/ui/map-picker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});
