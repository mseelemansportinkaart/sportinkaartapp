import { getMapboxAccessToken } from './mapboxToken';

type MapboxModule = typeof import('@rnmapbox/maps');

let runtimeMapbox: MapboxModule | null = null;
let runtimeMapboxError: unknown = null;

const accessToken = getMapboxAccessToken();

try {
  // Use runtime require so Expo Go can still load JS without crashing.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const moduleRef = require('@rnmapbox/maps');
  runtimeMapbox = (moduleRef?.default ?? moduleRef) as MapboxModule;
  runtimeMapbox.setAccessToken(accessToken ?? null);
} catch (error) {
  runtimeMapboxError = error;
}

export const Mapbox = runtimeMapbox;

// A usable token is part of "available", not just the module. Android's native
// SDK throws MapboxConfigurationException the moment a MapView is inflated
// without one, which takes the whole app down; iOS merely renders nothing. So
// with no token the screens must show their "map unavailable" fallback rather
// than mount a map that cannot work.
export const isMapboxAvailable = Boolean(runtimeMapbox && accessToken);
export const mapboxRuntimeError = runtimeMapboxError;
