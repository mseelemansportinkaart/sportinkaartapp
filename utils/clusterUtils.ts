/**
 * Clustering Utilities using Supercluster
 *
 * Provides clustering functionality for map markers.
 * Replaces react-native-map-clustering with Mapbox-compatible implementation.
 */

import Supercluster from 'supercluster';
import { CLUSTERING_CONFIG } from '../lib/mapboxConfig';
import type { Coordinate } from './mapUtils';

/**
 * Point feature for clustering (GeoJSON format)
 */
export interface ClusterPoint {
  type: 'Feature';
  properties: {
    cluster?: boolean;
    cluster_id?: number;
    point_count?: number;
    point_count_abbreviated?: string;
    [key: string]: any; // Additional custom properties
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

/**
 * Marker data for clustering
 */
export interface MarkerData extends Coordinate {
  id: string | number;
  [key: string]: any; // Additional properties
}

/**
 * Cluster result
 */
export interface Cluster {
  id: number | string;
  latitude: number;
  longitude: number;
  pointCount: number;
  clusterId?: number;
  isCluster: boolean;
  properties?: Record<string, any>;
}

/**
 * Creates a Supercluster instance with default configuration
 */
export function createClusterIndex(
  radius: number = CLUSTERING_CONFIG.RADIUS,
  maxZoom: number = CLUSTERING_CONFIG.MAX_ZOOM
): Supercluster {
  return new Supercluster({
    radius,
    maxZoom,
    minZoom: CLUSTERING_CONFIG.MIN_ZOOM,
  });
}

/**
 * Converts marker data to GeoJSON points for clustering
 */
export function markersToPoints(markers: MarkerData[]): ClusterPoint[] {
  return markers.map((marker) => ({
    type: 'Feature' as const,
    properties: {
      ...marker,
      id: marker.id,
    },
    geometry: {
      type: 'Point' as const,
      coordinates: [marker.longitude, marker.latitude],
    },
  }));
}

/**
 * Gets clusters for current map viewport
 */
export function getClusters(
  clusterIndex: Supercluster,
  bounds: [[number, number], [number, number]], // [[west, south], [east, north]]
  zoom: number
): Cluster[] {
  const [west, south, east, north] = [...bounds[0], ...bounds[1]];

  const clusters = clusterIndex.getClusters([west, south, east, north], Math.floor(zoom));

  return clusters.map((cluster) => {
    const [longitude, latitude] = cluster.geometry.coordinates;

    if (cluster.properties.cluster) {
      return {
        id: cluster.properties.cluster_id!,
        latitude,
        longitude,
        pointCount: cluster.properties.point_count!,
        clusterId: cluster.properties.cluster_id,
        isCluster: true,
        properties: cluster.properties,
      };
    } else {
      return {
        id: cluster.properties.id,
        latitude,
        longitude,
        pointCount: 1,
        isCluster: false,
        properties: cluster.properties,
      };
    }
  });
}

/**
 * Gets the markers contained within a cluster
 */
export function getClusterExpansionZoom(
  clusterIndex: Supercluster,
  clusterId: number
): number {
  return clusterIndex.getClusterExpansionZoom(clusterId);
}

/**
 * Gets all points within a cluster
 */
export function getClusterLeaves(
  clusterIndex: Supercluster,
  clusterId: number,
  limit: number = Infinity
): ClusterPoint[] {
  return clusterIndex.getLeaves(clusterId, limit) as unknown as ClusterPoint[];
}

/**
 * Calculates cluster size based on point count
 */
export function calculateClusterSize(
  pointCount: number,
  baseSize: number = CLUSTERING_CONFIG.CLUSTER_SIZE.REGION
): number {
  const scale = Math.min(
    CLUSTERING_CONFIG.SCALE_FACTOR.BASE +
      pointCount * CLUSTERING_CONFIG.SCALE_FACTOR.MULTIPLIER,
    CLUSTERING_CONFIG.SCALE_FACTOR.MAX
  );

  return baseSize * scale;
}

/**
 * Gets formatted count text for cluster
 */
export function getClusterCountText(pointCount: number): string {
  const safeCount = Number.isFinite(pointCount) ? Math.max(0, Math.round(pointCount)) : 0;
  return safeCount.toString();
}

/**
 * Hook for managing cluster state
 * Returns a function to update clusters based on map region
 */
export function useClusterManager() {
  let clusterIndex: Supercluster | null = null;

  return {
    /**
     * Initialize clustering with markers
     */
    load: (markers: MarkerData[], radius?: number, maxZoom?: number) => {
      clusterIndex = createClusterIndex(radius, maxZoom);
      const points = markersToPoints(markers);
      clusterIndex.load(points);
      return clusterIndex;
    },

    /**
     * Get clusters for current viewport
     */
    getClusters: (
      bounds: [[number, number], [number, number]],
      zoom: number
    ): Cluster[] => {
      if (!clusterIndex) return [];
      return getClusters(clusterIndex, bounds, zoom);
    },

    /**
     * Get expansion zoom for a cluster
     */
    getExpansionZoom: (clusterId: number): number => {
      if (!clusterIndex) return 0;
      return getClusterExpansionZoom(clusterIndex, clusterId);
    },

    /**
     * Get leaves of a cluster
     */
    getLeaves: (clusterId: number, limit?: number): ClusterPoint[] => {
      if (!clusterIndex) return [];
      return getClusterLeaves(clusterIndex, clusterId, limit);
    },

    /**
     * Clear cluster index
     */
    clear: () => {
      clusterIndex = null;
    },
  };
}
