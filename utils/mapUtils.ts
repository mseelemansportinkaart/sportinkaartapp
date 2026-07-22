/**
 * Map Utilities
 *
 * Helper functions for map operations including:
 * - Coordinate validation
 * - Region/bounds calculation
 * - Distance calculations
 * - Camera positioning
 */

import { NETHERLANDS_CENTER, BOUNDS_CONFIG, type Region } from '../lib/mapboxConfig';

/**
 * Represents a geographic coordinate
 */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Represents a geographic bounds
 */
export interface Bounds {
  northEast: Coordinate;
  southWest: Coordinate;
}

/**
 * Validates if coordinates are valid numbers within acceptable ranges
 */
export function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
}

/**
 * Calculates the center point from an array of coordinates
 */
export function calculateCenter(coordinates: Coordinate[]): Coordinate {
  if (coordinates.length === 0) {
    return {
      latitude: NETHERLANDS_CENTER.latitude,
      longitude: NETHERLANDS_CENTER.longitude,
    };
  }

  const sum = coordinates.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + coord.latitude,
      longitude: acc.longitude + coord.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / coordinates.length,
    longitude: sum.longitude / coordinates.length,
  };
}

/**
 * Calculates bounds from an array of coordinates
 */
export function calculateBounds(coordinates: Coordinate[]): Bounds | null {
  if (coordinates.length === 0) return null;

  let minLat = coordinates[0].latitude;
  let maxLat = coordinates[0].latitude;
  let minLng = coordinates[0].longitude;
  let maxLng = coordinates[0].longitude;

  coordinates.forEach((coord) => {
    minLat = Math.min(minLat, coord.latitude);
    maxLat = Math.max(maxLat, coord.latitude);
    minLng = Math.min(minLng, coord.longitude);
    maxLng = Math.max(maxLng, coord.longitude);
  });

  return {
    northEast: { latitude: maxLat, longitude: maxLng },
    southWest: { latitude: minLat, longitude: minLng },
  };
}

/**
 * Calculates a region that fits all coordinates with padding
 */
export function calculateRegion(coordinates: Coordinate[]): Region {
  if (coordinates.length === 0) {
    return NETHERLANDS_CENTER;
  }

  const bounds = calculateBounds(coordinates);
  if (!bounds) return NETHERLANDS_CENTER;

  const center = calculateCenter(coordinates);

  // Calculate deltas with padding
  const latDelta = (bounds.northEast.latitude - bounds.southWest.latitude) * BOUNDS_CONFIG.PADDING_MULTIPLIER;
  const lngDelta = (bounds.northEast.longitude - bounds.southWest.longitude) * BOUNDS_CONFIG.PADDING_MULTIPLIER;

  // Ensure minimum and maximum delta values
  const finalLatDelta = Math.max(
    BOUNDS_CONFIG.MIN_DELTA.latitude,
    Math.min(latDelta, BOUNDS_CONFIG.MAX_DELTA.latitude)
  );
  const finalLngDelta = Math.max(
    BOUNDS_CONFIG.MIN_DELTA.longitude,
    Math.min(lngDelta, BOUNDS_CONFIG.MAX_DELTA.longitude)
  );

  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: finalLatDelta,
    longitudeDelta: finalLngDelta,
  };
}

/**
 * Calculates distance between two coordinates in kilometers (Haversine formula)
 */
export function calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) *
      Math.cos(toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts a Region to Mapbox camera bounds
 * Returns [longitude, latitude] array format for Mapbox
 */
export function regionToBounds(region: Region): [[number, number], [number, number]] {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region;

  const northEast: [number, number] = [
    longitude + longitudeDelta / 2,
    latitude + latitudeDelta / 2,
  ];

  const southWest: [number, number] = [
    longitude - longitudeDelta / 2,
    latitude - latitudeDelta / 2,
  ];

  return [southWest, northEast];
}

/**
 * Converts coordinates array to Mapbox bounds format
 */
export function coordinatesToBounds(
  coordinates: Coordinate[]
): [[number, number], [number, number]] | null {
  const bounds = calculateBounds(coordinates);
  if (!bounds) return null;

  return [
    [bounds.southWest.longitude, bounds.southWest.latitude],
    [bounds.northEast.longitude, bounds.northEast.latitude],
  ];
}

/**
 * Gets zoom level from latitude delta (approximate)
 * Used for calculating appropriate zoom levels
 */
export function getZoomFromDelta(latitudeDelta: number): number {
  // Approximate zoom level calculation
  // zoom = log2(360 / latitudeDelta)
  return Math.log2(360 / latitudeDelta);
}

/**
 * Gets latitude delta from zoom level (approximate)
 * Inverse of getZoomFromDelta
 */
export function getDeltaFromZoom(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}

/**
 * Checks if a coordinate is within bounds
 */
export function isCoordinateInBounds(coordinate: Coordinate, bounds: Bounds): boolean {
  return (
    coordinate.latitude >= bounds.southWest.latitude &&
    coordinate.latitude <= bounds.northEast.latitude &&
    coordinate.longitude >= bounds.southWest.longitude &&
    coordinate.longitude <= bounds.northEast.longitude
  );
}

/**
 * Clamps a coordinate to stay within bounds
 */
export function clampCoordinateToBounds(coordinate: Coordinate, bounds: Bounds): Coordinate {
  return {
    latitude: Math.max(
      bounds.southWest.latitude,
      Math.min(bounds.northEast.latitude, coordinate.latitude)
    ),
    longitude: Math.max(
      bounds.southWest.longitude,
      Math.min(bounds.northEast.longitude, coordinate.longitude)
    ),
  };
}
