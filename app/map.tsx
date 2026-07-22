import { useLanguage } from "@/contexts/LanguageContext";
import { CLUSTERING_CONFIG, DEFAULT_MAP_STYLE } from "@/lib/mapboxConfig";
import { isMapboxAvailable, Mapbox } from "@/lib/mapboxRuntime";
import { supabase } from "@/lib/supabase";
import {
  createClusterIndex,
  getClusters,
  getClusterExpansionZoom,
} from "@/utils/clusterUtils";
import { getZoomFromDelta } from "@/utils/mapUtils";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Type alias for region
type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

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

// Custom marker images (smaller sizes to avoid oversized pins on device)
const PIN_ACTIVE = require("@/assets/images/pin_groen_60.png");
const PIN_CONCEPT = require("@/assets/images/pin_grijs_60.png");
const PIN_SIZE = 28;

// Logo for branding
const SPORTINKAART_LOGO = require("@/assets/images/icon.png");

// Legend colors (matching the pin images)
const ACTIVE_COLOR = "#04e1b2";
const CONCEPT_COLOR = "#888888";

// World-wide bounds for Supercluster — covers all valid coordinates
const WORLD_BOUNDS: [[number, number], [number, number]] = [[-180, -85], [180, 85]];

// Initial zoom level when no data is loaded yet (country-level view of Netherlands)
const DEFAULT_ZOOM = 7;

type MapHomepageDevScreenProps = {
  markerItemsOverride?: CityRegion[];
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function hasValidCoordinates(
  region: CityRegion
): region is CityRegion & { latitude: number; longitude: number } {
  return (
    typeof region.latitude === "number" &&
    Number.isFinite(region.latitude) &&
    typeof region.longitude === "number" &&
    Number.isFinite(region.longitude)
  );
}

export default function MapHomepageDevScreen({
  markerItemsOverride,
}: MapHomepageDevScreenProps) {
  const mapbox = Mapbox;
  const MapboxLib = mapbox as NonNullable<typeof Mapbox>;
  const { t } = useLanguage();
  const [regions, setRegions] = useState<CityRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Track integer zoom level only — re-cluster on zoom change, not on pan
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const invalidCoordsLogRef = useRef<Set<string>>(new Set());
  const cameraRef = useRef<any>(null);
  const permissionRequestedRef = useRef(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const centerOnUser = useCallback(
    async (source: "auto" | "button") => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        if (existing.status === "granted") {
          setHasLocationPermission(true);
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          cameraRef.current?.setCamera?.({
            centerCoordinate: [current.coords.longitude, current.coords.latitude],
            zoomLevel: 12,
            animationDuration: 800,
          });
          return;
        }

        if (source === "button" && permissionRequestedRef.current && existing.status === "denied") {
          Alert.alert(
            t("location.permissionSettingsTitle"),
            t("location.permissionSettingsMessage"),
            [
              {
                text: t("location.permissionSettingsClose"),
                style: "cancel",
              },
              {
                text: t("location.permissionSettingsOpen"),
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return;
        }

        permissionRequestedRef.current = true;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          return;
        }

        setHasLocationPermission(true);
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        cameraRef.current?.setCamera?.({
          centerCoordinate: [current.coords.longitude, current.coords.latitude],
          zoomLevel: 12,
          animationDuration: 800,
        });
      } catch (err) {
        console.warn("Failed to request location:", err);
      }
    },
    [t]
  );

  const validRegions = useMemo(
    () => regions.filter(hasValidCoordinates),
    [regions]
  );

  // Calculate initial map region based on regions with coordinates
  const calculatedRegion = useMemo((): MapRegion => {
    if (validRegions.length === 0) {
      return {
        latitude: 52.1326,
        longitude: 5.2913,
        latitudeDelta: 2,
        longitudeDelta: 2,
      };
    }

    const lats = validRegions.map((r) => r.latitude!);
    const lngs = validRegions.map((r) => r.longitude!);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.5);
    const lngDelta = Math.max((maxLng - minLng) * 1.5, 0.5);

    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    };
  }, [validRegions]);

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

      const normalizedRegions = combinedRegions.map((region) => ({
        ...region,
        latitude: toFiniteNumber(region.latitude),
        longitude: toFiniteNumber(region.longitude),
      }));

      setRegions(normalizedRegions);
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

  useEffect(() => {
    if (permissionRequestedRef.current) return;
    centerOnUser("auto");
  }, [centerOnUser]);

  useEffect(() => {
    const invalidCount = regions.length - validRegions.length;
    if (invalidCount <= 0) return;

    const invalidRegionIds = regions
      .filter((region) => !hasValidCoordinates(region))
      .map((region) => region.slug || region.id)
      .filter((id) => !invalidCoordsLogRef.current.has(id));

    if (invalidRegionIds.length === 0) return;

    invalidRegionIds.forEach((id) => invalidCoordsLogRef.current.add(id));
    console.warn("[map] Skipping regions with invalid coordinates", invalidRegionIds);
  }, [regions, validRegions]);

  const handleMarkerPress = useCallback((region: CityRegion) => {
    if (region.is_active && !region.is_concept) {
      router.push(`/region/${region.slug}` as any);
    }
  }, []);

  // Only re-cluster when the integer zoom level changes — panning never triggers a re-render
  const handleCameraChanged = useCallback((state: any) => {
    const newZoom = state?.properties?.zoom;
    if (typeof newZoom !== "number") return;
    const flooredZoom = Math.floor(newZoom);
    setZoom((prev) => (flooredZoom !== prev ? flooredZoom : prev));
  }, []);

  // Supercluster index — rebuilt only when region data changes
  const clusterIndex = useMemo(() => {
    const index = createClusterIndex(
      CLUSTERING_CONFIG.RADIUS,
      CLUSTERING_CONFIG.MAX_ZOOM
    );
    const points = validRegions.map((r) => ({
      type: "Feature" as const,
      properties: { ...r, id: r.id },
      geometry: {
        type: "Point" as const,
        coordinates: [r.longitude, r.latitude] as [number, number],
      },
    }));
    index.load(points);
    return index;
  }, [validRegions]);

  // Current clusters — only recomputed when zoom changes (not on pan)
  const clusters = useMemo(
    () => getClusters(clusterIndex, WORLD_BOUNDS, zoom),
    [clusterIndex, zoom]
  );

  // Zoom into a cluster on tap to expand it
  const handleClusterPress = useCallback(
    (clusterId: number, longitude: number, latitude: number) => {
      const expansionZoom = getClusterExpansionZoom(clusterIndex, clusterId);
      cameraRef.current?.setCamera({
        centerCoordinate: [longitude, latitude],
        zoomLevel: Math.min(expansionZoom + 0.5, CLUSTERING_CONFIG.MAX_ZOOM),
        animationDuration: 350,
      });
    },
    [clusterIndex]
  );

  const markerElements = useMemo(() => {
    if (!mapbox) return [];

    // Override path: skip clustering, render markers directly
    if (markerItemsOverride) {
      return markerItemsOverride
        .filter(hasValidCoordinates)
        .map((region) => {
          const isConcept = region.is_concept && !region.is_active;
          const pinSource = isConcept ? PIN_CONCEPT : PIN_ACTIVE;
          return (
            <MapboxLib.MarkerView
              key={`region-${region.id}`}
              id={`region-${region.id}`}
              coordinate={[region.longitude, region.latitude]}
              anchor={{ x: 0.5, y: 1 }}
            >
              <TouchableOpacity
                style={styles.markerTouchTarget}
                activeOpacity={0.9}
                onPress={() => handleMarkerPress(region)}
              >
                <View collapsable={false}>
                  <Image source={pinSource} style={styles.pinImage} />
                </View>
              </TouchableOpacity>
            </MapboxLib.MarkerView>
          );
        });
    }

    // Clustered path: render clusters and individual pins from Supercluster
    return clusters
      .map((item) => {
        if (item.isCluster) {
          return (
            <MapboxLib.MarkerView
              key={`cluster-${item.id}`}
              id={`cluster-${item.id}`}
              coordinate={[item.longitude, item.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <TouchableOpacity
                onPress={() =>
                  handleClusterPress(item.clusterId!, item.longitude, item.latitude)
                }
                activeOpacity={0.8}
              >
                <View collapsable={false} style={styles.clusterMarker}>
                  <Text style={styles.clusterText}>{item.pointCount}</Text>
                </View>
              </TouchableOpacity>
            </MapboxLib.MarkerView>
          );
        }

        // Individual pin — region data was stored in properties by markersToPoints
        const props = item.properties as CityRegion;
        if (!props || !hasValidCoordinates(props)) return null;

        const isConcept = props.is_concept && !props.is_active;
        const pinSource = isConcept ? PIN_CONCEPT : PIN_ACTIVE;

        return (
          <MapboxLib.MarkerView
            key={`region-${props.id}`}
            id={`region-${props.id}`}
            coordinate={[props.longitude, props.latitude]}
            anchor={{ x: 0.5, y: 1 }}
          >
            <TouchableOpacity
              style={styles.markerTouchTarget}
              activeOpacity={0.9}
              onPress={() => handleMarkerPress(props)}
            >
              <View collapsable={false}>
                <Image source={pinSource} style={styles.pinImage} />
              </View>
            </TouchableOpacity>
          </MapboxLib.MarkerView>
        );
      })
      .filter(Boolean) as React.ReactElement[];
  }, [clusters, mapbox, markerItemsOverride, handleMarkerPress, handleClusterPress]);

  const backButton = (
    <TouchableOpacity
      style={styles.backButton}
      onPress={() => router.back()}
      activeOpacity={0.8}
    >
      <Text style={styles.backText}>← {t("map.back")}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        {backButton}
        <ActivityIndicator size="large" color="#04e1b2" />
        <Text style={styles.loadingText}>{t("map.loading")}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        {backButton}
        <Text style={styles.errorText}>{t("map.loadError")}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  if (!isMapboxAvailable || !mapbox) {
    return (
      <View style={styles.errorContainer}>
        {backButton}
        <Text style={styles.errorText}>Map unavailable in Expo Go</Text>
        <Text style={styles.errorMessage}>
          Use a development build to load Mapbox native code.
        </Text>
      </View>
    );
  }

  const initialZoomLevel = Math.max(3, Math.min(14, getZoomFromDelta(calculatedRegion.latitudeDelta)));

  return (
    <View style={styles.container}>
      {backButton}
      <MapboxLib.MapView
        testID="map-homepage-map"
        style={styles.map}
        styleURL={DEFAULT_MAP_STYLE}
        pitchEnabled={false}
        rotateEnabled={false}
        scaleBarEnabled={true}
        compassEnabled={true}
        onCameraChanged={handleCameraChanged}
      >
        <MapboxLib.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [calculatedRegion.longitude, calculatedRegion.latitude],
            zoomLevel: initialZoomLevel,
          }}
        />
        {hasLocationPermission && <MapboxLib.UserLocation visible={true} />}
        {markerElements}
      </MapboxLib.MapView>

      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => centerOnUser("button")}
        activeOpacity={0.8}
      >
        <Text style={styles.centerButtonText}>⌖</Text>
      </TouchableOpacity>

      {/* Logo */}
      <Image source={SPORTINKAART_LOGO} style={styles.logo} />

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACTIVE_COLOR }]} />
          <Text style={styles.legendText}>{t("map.available")}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: CONCEPT_COLOR }]} />
          <Text style={styles.legendText}>{t("map.comingSoon")}</Text>
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
  pinImage: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    resizeMode: "contain",
  },
  markerTouchTarget: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  clusterMarker: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CLUSTERING_CONFIG.COLORS.BACKGROUND,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: CLUSTERING_CONFIG.COLORS.BORDER,
    paddingHorizontal: 8,
  },
  clusterText: {
    color: CLUSTERING_CONFIG.COLORS.TEXT,
    fontSize: 14,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#050f08",
  },
  backButton: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 10,
    backgroundColor: "#1a3b30",
    borderWidth: 2,
    borderColor: "#04e1b2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  backText: {
    fontSize: 16,
    color: "#04e1b2",
    fontWeight: "600",
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
  centerButton: {
    position: "absolute",
    right: 20,
    bottom: 40,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1a3b30",
    borderWidth: 2,
    borderColor: "#04e1b2",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  centerButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  logo: {
    position: "absolute",
    left: 20,
    bottom: 55,
    width: 40,
    height: 40,
    borderRadius: 8,
  },
});
