import { getMapboxAccessToken } from './mapboxToken';

type MapboxModule = typeof import('@rnmapbox/maps');

let runtimeMapbox: MapboxModule | null = null;
let runtimeMapboxError: unknown = null;

try {
  // Use runtime require so Expo Go can still load JS without crashing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const moduleRef = require('@rnmapbox/maps');
  runtimeMapbox = (moduleRef?.default ?? moduleRef) as MapboxModule;
  runtimeMapbox.setAccessToken(getMapboxAccessToken() ?? null);
} catch (error) {
  runtimeMapboxError = error;
}

export const Mapbox = runtimeMapbox;
export const isMapboxAvailable = Boolean(runtimeMapbox);
export const mapboxRuntimeError = runtimeMapboxError;
