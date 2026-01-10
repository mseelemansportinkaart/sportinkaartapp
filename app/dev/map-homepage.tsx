import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Region as MapRegion, Marker } from "react-native-maps";

// Type definitions
interface CityRegion {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  latitude: number | null;
  longitude: number | null;
}

// Custom marker images (use larger versions for better visibility)
const PIN_ACTIVE = require("@/assets/images/pin_groen_120.png");
const PIN_CONCEPT = require("@/assets/images/pin_grijs_120.png");

// Legend colors (matching the pin images)
const ACTIVE_COLOR = "#04e1b2";
const CONCEPT_COLOR = "#888888";

type ClusterMarker =
  | { type: "region"; region: CityRegion }
  | { type: "cluster"; id: string; regions: CityRegion[]; coordinate: { latitude: number; longitude: number } };

type PointedRegion = {
  region: CityRegion;
  point: { x: number; y: number };
};

type RegionBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

function getRegionBounds(region: MapRegion, bufferFactor: number): RegionBounds {
  const latBuffer = region.latitudeDelta * bufferFactor;
  const lngBuffer = region.longitudeDelta * bufferFactor;

  return {
    minLat: region.latitude - region.latitudeDelta / 2 - latBuffer,
    maxLat: region.latitude + region.latitudeDelta / 2 + latBuffer,
    minLng: region.longitude - region.longitudeDelta / 2 - lngBuffer,
    maxLng: region.longitude + region.longitudeDelta / 2 + lngBuffer,
  };
}

function boundsContain(outer: RegionBounds, inner: RegionBounds): boolean {
  return (
    inner.minLat >= outer.minLat &&
    inner.maxLat <= outer.maxLat &&
    inner.minLng >= outer.minLng &&
    inner.maxLng <= outer.maxLng
  );
}

function isWithinBounds(region: CityRegion, bounds: RegionBounds): boolean {
  return (
    region.latitude !== null &&
    region.longitude !== null &&
    region.latitude >= bounds.minLat &&
    region.latitude <= bounds.maxLat &&
    region.longitude >= bounds.minLng &&
    region.longitude <= bounds.maxLng
  );
}

function clusterRegions(
  items: PointedRegion[],
  mapSize: { width: number; height: number },
  radiusPx: number
): ClusterMarker[] {
  if (items.length === 0 || mapSize.width === 0 || mapSize.height === 0) return [];

  const buffer = radiusPx;
  const visiblePoints = items.filter(
    (item) =>
      item.point.x >= -buffer &&
      item.point.x <= mapSize.width + buffer &&
      item.point.y >= -buffer &&
      item.point.y <= mapSize.height + buffer
  );

  if (visiblePoints.length === 0) return [];

  const clusters: Array<{
    id: string;
    regions: CityRegion[];
    x: number;
    y: number;
    points: PointedRegion[];
  }> = [];

  for (const item of visiblePoints) {
    const x = item.point.x;
    const y = item.point.y;
    let targetCluster: typeof clusters[number] | null = null;
    for (const cluster of clusters) {
      const dx = cluster.x - x;
      const dy = cluster.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= radiusPx) {
        targetCluster = cluster;
        break;
      }
    }

    if (!targetCluster) {
      clusters.push({
        id: item.region.id,
        regions: [item.region],
        x,
        y,
        points: [item],
      });
      continue;
    }

    const count = targetCluster.regions.length + 1;
    targetCluster.x = (targetCluster.x * (count - 1) + x) / count;
    targetCluster.y = (targetCluster.y * (count - 1) + y) / count;
    targetCluster.regions.push(item.region);
    targetCluster.points.push(item);
  }

  return clusters.map((cluster, index) => {
    if (cluster.regions.length === 1) {
      return { type: "region", region: cluster.regions[0] };
    }
    let closest = cluster.points[0];
    let closestDist = Infinity;
    for (const item of cluster.points) {
      const dx = cluster.x - item.point.x;
      const dy = cluster.y - item.point.y;
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closest = item;
      }
    }
    return {
      type: "cluster",
      id: `cluster-${index}`,
      regions: cluster.regions,
      coordinate: {
        latitude: closest.region.latitude!,
        longitude: closest.region.longitude!,
      },
    };
  });
}

export default function MapHomepageDevScreen() {
  const [regions, setRegions] = useState<CityRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRegion, setCurrentRegion] = useState<MapRegion | null>(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [markerItems, setMarkerItems] = useState<ClusterMarker[]>([]);
  const mapRef = useRef<MapView>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRegionRef = useRef<MapRegion | null>(null);
  const lastZoomRef = useRef<{ latitudeDelta: number; longitudeDelta: number } | null>(null);
  const lastBoundsRef = useRef<RegionBounds | null>(null);
  const clusterBaseRef = useRef<ClusterMarker[]>([]);

  // Calculate map region based on regions with coordinates
  const calculatedRegion = useMemo((): MapRegion => {
    const regionsWithCoords = regions.filter(
      (r) => r.latitude !== null && r.longitude !== null
    );

    if (regionsWithCoords.length === 0) {
      // Fallback to Netherlands center
      return {
        latitude: 52.1326,
        longitude: 5.2913,
        latitudeDelta: 2,
        longitudeDelta: 2,
      };
    }

    const lats = regionsWithCoords.map((r) => r.latitude!);
    const lngs = regionsWithCoords.map((r) => r.longitude!);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Add padding around the markers
    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.5);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.5);

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [regions]);

  useEffect(() => {
    setCurrentRegion(calculatedRegion);
  }, [calculatedRegion]);

  // Fetch regions from Supabase
  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [activeRegionsResponse, conceptRegionsResponse] = await Promise.all([
        supabase
          .from("regions")
          .select("id, region_name, slug, is_active, is_concept, latitude, longitude")
          .eq("is_active", true)
          .eq("is_concept", false)
          .order("region_name"),
        supabase
          .from("regions")
          .select("id, region_name, slug, is_active, is_concept, latitude, longitude")
          .eq("is_active", false)
          .eq("is_concept", true)
          .order("region_name"),
      ]);

      if (activeRegionsResponse.error) throw activeRegionsResponse.error;
      if (conceptRegionsResponse.error) throw conceptRegionsResponse.error;

      const combinedRegions = [
        ...(activeRegionsResponse.data || []),
        ...(conceptRegionsResponse.data || []),
      ];

      setRegions(combinedRegions);
    } catch (err) {
      console.error("Error fetching regions:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Er is een fout opgetreden bij het laden van de steden";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const handleMarkerPress = useCallback((region: CityRegion) => {
    if (region.is_active && !region.is_concept) {
      router.push(`/region/${region.slug}` as any);
    }
  }, []);

  const handleClusterPress = useCallback(
    (clusterRegions: CityRegion[]) => {
      const points = clusterRegions.filter(
        (r) => r.latitude !== null && r.longitude !== null
      );
      if (points.length === 0) return;
      if (points.length === 1) {
        handleMarkerPress(points[0]);
        return;
      }

      const lats = points.map((r) => r.latitude!);
      const lngs = points.map((r) => r.longitude!);

      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;

      const latDelta = Math.max((maxLat - minLat) * 1.6, 0.05);
      const lngDelta = Math.max((maxLng - minLng) * 1.6, 0.05);

      mapRef.current?.animateToRegion(
        {
          latitude: centerLat,
          longitude: centerLng,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        },
        350
      );
    },
    [handleMarkerPress]
  );

  const clusteringEnabled = Platform.OS === "ios";

  const handleRegionChangeComplete = useCallback((region: MapRegion) => {
    pendingRegionRef.current = region;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setCurrentRegion(pendingRegionRef.current);
    }, 150);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const buildMarkers = async () => {
      const validRegions = regions.filter(
        (region) => region.latitude !== null && region.longitude !== null
      );

      if (!clusteringEnabled || !mapRef.current || !currentRegion) {
        const items = validRegions.map((region) => ({ type: "region", region }));
        clusterBaseRef.current = items;
        setMarkerItems(items);
        return;
      }

      const zoomChanged =
        !lastZoomRef.current ||
        Math.abs(currentRegion.latitudeDelta - lastZoomRef.current.latitudeDelta) /
          lastZoomRef.current.latitudeDelta >
          0.08 ||
        Math.abs(currentRegion.longitudeDelta - lastZoomRef.current.longitudeDelta) /
          lastZoomRef.current.longitudeDelta >
          0.08;

      const bounds = getRegionBounds(currentRegion, 0.25);
      const needRecluster =
        zoomChanged ||
        !lastBoundsRef.current ||
        !boundsContain(lastBoundsRef.current, bounds) ||
        clusterBaseRef.current.length === 0;

      if (!needRecluster) {
        setMarkerItems(clusterBaseRef.current);
        return;
      }

      const visibleRegions = validRegions.filter((region) => isWithinBounds(region, bounds));

      const points = await Promise.all(
        visibleRegions.map(async (region) => {
          const point = await mapRef.current!.pointForCoordinate({
            latitude: region.latitude!,
            longitude: region.longitude!,
          });
          return { region, point };
        })
      );

      if (cancelled) return;

      const clustered = clusterRegions(points, mapSize, 40);
      clusterBaseRef.current = clustered;
      lastZoomRef.current = {
        latitudeDelta: currentRegion.latitudeDelta,
        longitudeDelta: currentRegion.longitudeDelta,
      };
      lastBoundsRef.current = bounds;
      setMarkerItems(clustered);
    };

    buildMarkers();
    return () => {
      cancelled = true;
    };
  }, [regions, currentRegion, mapSize, clusteringEnabled]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#04e1b2" />
        <Text style={styles.loadingText}>Kaart laden...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Fout bij laden</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={calculatedRegion}
        onRegionChangeComplete={handleRegionChangeComplete}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setMapSize({ width, height });
        }}
        showsUserLocation={false}
        showsCompass={true}
        showsScale={true}
      >
        {markerItems.map((item) => {
          if (item.type === "region") {
            const region = item.region;
            const isConcept = region.is_concept && !region.is_active;

            return (
              <Marker
                key={region.id}
                coordinate={{
                  latitude: region.latitude!,
                  longitude: region.longitude!,
                }}
                title={region.region_name}
                description={
                  isConcept ? "Binnenkort beschikbaar" : "Tik om te bekijken"
                }
                onPress={() => handleMarkerPress(region)}
                image={isConcept ? PIN_CONCEPT : PIN_ACTIVE}
                anchor={{ x: 0.5, y: 1 }}
              />
            );
          }

          return (
            <Marker
              key={item.id}
              coordinate={item.coordinate}
              onPress={() => handleClusterPress(item.regions)}
            >
              <View
                style={[
                  styles.clusterMarker,
                  item.regions.every((region) => region.is_concept && !region.is_active)
                    ? styles.clusterMarkerConcept
                    : styles.clusterMarkerActive,
                ]}
              >
                <Text style={styles.clusterText}>{item.regions.length}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACTIVE_COLOR }]} />
          <Text style={styles.legendText}>Beschikbaar</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CONCEPT_COLOR }]} />
          <Text style={styles.legendText}>Binnenkort</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050f08",
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050f08",
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 16,
    marginTop: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050f08",
    padding: 20,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  errorMessage: {
    color: "#ffffff",
    fontSize: 14,
    textAlign: "center",
  },
  legend: {
    position: "absolute",
    bottom: 40,
    left: 20,
    backgroundColor: "rgba(5, 15, 8, 0.9)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  legendText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "500",
  },
  clusterMarker: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#0b2a20",
    paddingHorizontal: 8,
  },
  clusterMarkerActive: {
    backgroundColor: "#04e1b2",
  },
  clusterMarkerConcept: {
    backgroundColor: "#888888",
  },
  clusterText: {
    color: "#0b2a20",
    fontSize: 14,
    fontWeight: "700",
  },
});
