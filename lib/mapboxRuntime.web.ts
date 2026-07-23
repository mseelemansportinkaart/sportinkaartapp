// Web has no native @rnmapbox/maps, and importing it pulls mapbox-gl into the
// web bundle (which isn't a dependency). Metro resolves this .web variant for
// the web platform, so the native module is never bundled there. Screens read
// isMapboxAvailable and fall back to their "map unavailable" state.
type MapboxModule = typeof import('@rnmapbox/maps');

export const Mapbox: MapboxModule | null = null;
export const isMapboxAvailable = false;
export const mapboxRuntimeError: unknown = new Error(
  '@rnmapbox/maps is not available on web',
);
