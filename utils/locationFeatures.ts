/**
 * Location Feature Utilities
 *
 * Builds the GeoJSON that feeds the region map's clustered ShapeSource and
 * derives the map-image keys used to render sport emoji as native symbols.
 */

import { getSportEmoji } from './sportEmoji';

export interface LocationFeatureInput {
  id: string | number;
  latitude: number;
  longitude: number;
  sports?: string[];
  sport?: string;
}

export interface LocationFeature {
  type: 'Feature';
  properties: {
    id: string;
    emoji: string;
    emojiIcon: string;
    isFavorite: boolean;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface LocationFeatureCollection {
  type: 'FeatureCollection';
  features: LocationFeature[];
}

export interface EmojiIcon {
  key: string;
  emoji: string;
}

/**
 * Stable ASCII key for an emoji, safe to use as a Mapbox style-image name
 * (e.g. '⚽️' -> 'sport-emoji-26bd-fe0f').
 */
export function getEmojiIconKey(emoji: string): string {
  const codes = Array.from(emoji)
    .map((char) => (char.codePointAt(0) ?? 0).toString(16))
    .join('-');
  return `sport-emoji-${codes}`;
}

function getLocationEmoji(location: LocationFeatureInput): string {
  return getSportEmoji(location.sports ?? [], location.sport ?? '');
}

/**
 * Converts locations to the FeatureCollection rendered by the clustered
 * ShapeSource. Only feature properties survive the native round-trip, so
 * everything the layers and press handler need is flattened in here.
 */
export function buildLocationFeatureCollection(
  locations: LocationFeatureInput[],
  isFavorite: (location: LocationFeatureInput) => boolean
): LocationFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: locations
      .filter(
        (location) =>
          Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
      )
      .map((location) => {
        const emoji = getLocationEmoji(location);
        return {
          type: 'Feature' as const,
          properties: {
            id: String(location.id),
            emoji,
            emojiIcon: getEmojiIconKey(emoji),
            isFavorite: isFavorite(location),
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [location.longitude, location.latitude] as [number, number],
          },
        };
      }),
  };
}

/**
 * The distinct emoji used by the given locations, so the map only registers
 * the style images it actually needs.
 */
export function collectEmojiIcons(locations: LocationFeatureInput[]): EmojiIcon[] {
  const icons = new Map<string, string>();
  locations.forEach((location) => {
    const emoji = getLocationEmoji(location);
    const key = getEmojiIconKey(emoji);
    if (!icons.has(key)) {
      icons.set(key, emoji);
    }
  });
  return Array.from(icons.entries()).map(([key, emoji]) => ({ key, emoji }));
}
