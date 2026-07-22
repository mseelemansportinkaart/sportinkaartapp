import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { MapboxClusterMarker } from '@/components/MapboxClusterMarker';
import { SuggestionForm } from '@/components/SuggestionForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { CLUSTERING_CONFIG, DEFAULT_MAP_STYLE } from '@/lib/mapboxConfig';
import { isMapboxAvailable, Mapbox } from '@/lib/mapboxRuntime';
import { supabase } from '@/lib/supabase';
import { getZoomFromDelta } from '@/utils/mapUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Supercluster from 'supercluster';

// Type definitions
interface Region {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  latitude?: number | string | null;
  longitude?: number | string | null;
  created_at: string;
  updated_at: string;
}

type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapCameraEvent = {
  properties?: {
    zoom?: number;
    bounds?: unknown;
  };
};

const DEFAULT_MAP_REGION: MapRegion = {
  latitude: 52.1326,
  longitude: 5.2913,
  latitudeDelta: 5.5,
  longitudeDelta: 5.5,
};

const PIN_ACTIVE = require('@/assets/images/pin_groen_60.png');
const PIN_CONCEPT = require('@/assets/images/pin_grijs_60.png');
const PIN_BASE_SIZE = 48;
const PIN_MIN_SIZE = 36;
const PIN_MAX_SIZE = 110;
const HOME_CLUSTER_UPDATE_THROTTLE_MS = 100;
const HOME_FIT_BOUNDS_PADDING: [number, number, number, number] = [130, 40, 220, 40]; // [top, right, bottom, left]

// Logo for branding
const SPORTINKAART_LOGO = require('@/assets/images/icon.png');

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPinSize(zoomLevel: number): number {
  // Approximate marker scaling from Mapbox zoom levels.
  const scale = Math.max(0.65, Math.min(2.2, (zoomLevel - 4) / 7));
  return clamp(PIN_BASE_SIZE * scale, PIN_MIN_SIZE, PIN_MAX_SIZE);
}

export default function HomeScreen() {
  const { t } = useLanguage();
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [regionLocationCounts, setRegionLocationCounts] = useState<Record<string, number>>({});
  const [currentZoom, setCurrentZoom] = useState<number>(getZoomFromDelta(DEFAULT_MAP_REGION.latitudeDelta));
  const [clusterData, setClusterData] = useState<any[]>([]);
  const superclusterRef = useRef<Supercluster | null>(null);
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const zoomRef = useRef<number>(getZoomFromDelta(DEFAULT_MAP_REGION.latitudeDelta));
  const hasCenteredOnRegionsRef = useRef(false);
  const lastClusterUpdateTsRef = useRef(0);
  const lastClusterSignatureRef = useRef('');

  const regionToBbox = useCallback((region: MapRegion): [number, number, number, number] => {
    return [
      region.longitude - region.longitudeDelta / 2,
      region.latitude - region.latitudeDelta / 2,
      region.longitude + region.longitudeDelta / 2,
      region.latitude + region.latitudeDelta / 2,
    ];
  }, []);

  const boundsToBbox = useCallback((bounds: unknown): [number, number, number, number] | null => {
    if (!Array.isArray(bounds) || bounds.length < 2) return null;
    const a = bounds[0] as unknown;
    const b = bounds[1] as unknown;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return null;

    const lng1 = Number(a[0]);
    const lat1 = Number(a[1]);
    const lng2 = Number(b[0]);
    const lat2 = Number(b[1]);

    if (![lng1, lat1, lng2, lat2].every(Number.isFinite)) return null;
    return [Math.min(lng1, lng2), Math.min(lat1, lat2), Math.max(lng1, lng2), Math.max(lat1, lat2)];
  }, []);

  // Fetch regions from Supabase (memoized)
  const fetchRegions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch active regions and concept regions separately, then combine them
      const [activeRegionsResponse, conceptRegionsResponse] = await Promise.all([
        supabase
          .from('regions')
          .select('*')
          .eq('is_active', true)
          .eq('is_concept', false)
          .order('region_name'),
        supabase
          .from('regions')
          .select('*')
          .eq('is_active', false)
          .eq('is_concept', true)
          .order('region_name')
      ]);

      if (activeRegionsResponse.error) throw activeRegionsResponse.error;
      if (conceptRegionsResponse.error) throw conceptRegionsResponse.error;

      // Sort each group alphabetically and combine active regions first, then concept regions
      const sortedActiveRegions = (activeRegionsResponse.data || []).sort((a, b) =>
        a.region_name.localeCompare(b.region_name, 'nl', { sensitivity: 'base' })
      );
      const sortedConceptRegions = (conceptRegionsResponse.data || []).sort((a, b) =>
        a.region_name.localeCompare(b.region_name, 'nl', { sensitivity: 'base' })
      );

      const combinedRegions = [
        ...sortedActiveRegions,
        ...sortedConceptRegions
      ];

      setRegions(combinedRegions);
    } catch (err) {
      console.error('Error fetching regions:', err);
      const errorMessage = err instanceof Error ? err.message : 'Er is een fout opgetreden bij het laden van de regios';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRegionPress = useCallback((region: Region) => {
    // Don't navigate if region is a concept
    if (!region.is_active && region.is_concept) {
      return;
    }
    console.log('Navigating to region:', region);
    router.push('/region/' + region.slug as any);
  }, []);

  const handleContactPress = useCallback(() => {
    setShowSuggestionForm(true);
  }, []);

  // Fetch regions on mount
  useEffect(() => {
    fetchRegions();
  }, [fetchRegions]);

  const mapRegions = useMemo(() => (
    regions
      .map((region) => {
        const latitude = toFiniteNumber(region.latitude);
        const longitude = toFiniteNumber(region.longitude);
        if (latitude === null || longitude === null) {
          return null;
        }
        return {
          ...region,
          latitude,
          longitude,
        };
      })
      .filter(Boolean) as (Region & { latitude: number; longitude: number })[]
  ), [regions]);

  const computedMapRegion = useMemo(() => {
    if (mapRegions.length === 0) {
      return DEFAULT_MAP_REGION;
    }

    const latitudes = mapRegions.map((region) => region.latitude);
    const longitudes = mapRegions.map((region) => region.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);

    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLng + maxLng) / 2;
    const latitudeDelta = Math.max(0.2, (maxLat - minLat) * 1.4);
    const longitudeDelta = Math.max(0.2, (maxLng - minLng) * 1.4);

    return {
      latitude,
      longitude,
      latitudeDelta,
      longitudeDelta,
    };
  }, [mapRegions]);

  const handleCameraChanged = useCallback((state: MapCameraEvent) => {
    const props = (state?.properties ?? {}) as { zoom?: number; bounds?: unknown };
    const incomingZoom = Number(props.zoom);
    const nextZoom = Number.isFinite(incomingZoom) ? incomingZoom : zoomRef.current;
    const zoomFloor = Math.max(
      CLUSTERING_CONFIG.MIN_ZOOM,
      Math.min(CLUSTERING_CONFIG.MAX_ZOOM, Math.floor(nextZoom))
    );

    if (Number.isFinite(incomingZoom)) {
      zoomRef.current = incomingZoom;
      setCurrentZoom((prev) => {
        const diff = Math.abs(prev - incomingZoom);
        return diff > 0.12 ? incomingZoom : prev;
      });
    }

    if (!superclusterRef.current) return;

    const stateBbox = boundsToBbox(props.bounds);
    const bbox = stateBbox ?? regionToBbox(computedMapRegion);
    const signature = `${zoomFloor}|${bbox.map((value) => value.toFixed(5)).join(',')}`;
    const now = Date.now();

    if (signature === lastClusterSignatureRef.current) return;
    if (now - lastClusterUpdateTsRef.current < HOME_CLUSTER_UPDATE_THROTTLE_MS) return;

    lastClusterSignatureRef.current = signature;
    lastClusterUpdateTsRef.current = now;

    const clusters = superclusterRef.current.getClusters(bbox, zoomFloor).map((feature: any) => {
      if (!feature?.properties?.cluster) return feature;
      const exactPinCount = Number(feature?.properties?.point_count) || 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          exact_pin_count: exactPinCount,
        },
      };
    });
    setClusterData(clusters);
  }, [boundsToBbox, computedMapRegion, regionToBbox]);

  const handleMapIdle = useCallback((state: MapCameraEvent) => {
    const props = (state?.properties ?? {}) as { zoom?: number; bounds?: unknown };
    const incomingZoom = Number(props.zoom);
    const nextZoom = Number.isFinite(incomingZoom) ? incomingZoom : zoomRef.current;
    const zoomFloor = Math.max(
      CLUSTERING_CONFIG.MIN_ZOOM,
      Math.min(CLUSTERING_CONFIG.MAX_ZOOM, Math.floor(nextZoom))
    );

    if (!superclusterRef.current) return;
    const stateBbox = boundsToBbox(props.bounds);
    const bbox = stateBbox ?? regionToBbox(computedMapRegion);
    const signature = `${zoomFloor}|${bbox.map((value) => value.toFixed(5)).join(',')}`;

    lastClusterSignatureRef.current = signature;
    lastClusterUpdateTsRef.current = Date.now();

    const clusters = superclusterRef.current.getClusters(bbox, zoomFloor).map((feature: any) => {
      if (!feature?.properties?.cluster) return feature;
      const exactPinCount = Number(feature?.properties?.point_count) || 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          exact_pin_count: exactPinCount,
        },
      };
    });
    setClusterData(clusters);
  }, [boundsToBbox, computedMapRegion, regionToBbox]);

  const pinSize = useMemo(() => getPinSize(currentZoom), [currentZoom]);
  const defaultZoomLevel = useMemo(
    () => clamp(getZoomFromDelta(computedMapRegion.latitudeDelta), 3, 15),
    [computedMapRegion.latitudeDelta]
  );

  useEffect(() => {
    if (mapRegions.length === 0) {
      superclusterRef.current = null;
      setClusterData([]);
      return;
    }

    const cluster = new Supercluster({
      radius: CLUSTERING_CONFIG.RADIUS,
      maxZoom: CLUSTERING_CONFIG.MAX_ZOOM,
      minZoom: CLUSTERING_CONFIG.MIN_ZOOM,
      map: (properties: any) => ({
        locationCount: Number(properties?.locationCount) || 0,
      }),
      reduce: (accumulated: any, properties: any) => {
        accumulated.locationCount =
          (Number(accumulated.locationCount) || 0) + (Number(properties?.locationCount) || 0);
      },
    });

    const points = mapRegions.map((region) => ({
      type: 'Feature' as const,
      properties: {
        ...region,
        id: region.id,
        locationCount: Number(regionLocationCounts[region.id]) || 0,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [region.longitude, region.latitude],
      },
    }));

    cluster.load(points);
    superclusterRef.current = cluster;

    const bbox = regionToBbox(computedMapRegion);
    const clusters = cluster.getClusters(bbox, Math.floor(defaultZoomLevel)).map((feature: any) => {
      if (!feature?.properties?.cluster) return feature;
      const exactPinCount = Number(feature?.properties?.point_count) || 0;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          exact_pin_count: exactPinCount,
        },
      };
    });
    setClusterData(clusters);
    zoomRef.current = defaultZoomLevel;
    lastClusterSignatureRef.current = '';
    lastClusterUpdateTsRef.current = 0;
    hasCenteredOnRegionsRef.current = false;
  }, [mapRegions, computedMapRegion, defaultZoomLevel, regionToBbox, regionLocationCounts]);

  useEffect(() => {
    if (hasCenteredOnRegionsRef.current) return;
    if (!cameraRef.current || mapRegions.length === 0) return;

    const latitudes = mapRegions.map((region) => region.latitude);
    const longitudes = mapRegions.map((region) => region.longitude);
    const northEast: [number, number] = [Math.max(...longitudes), Math.max(...latitudes)];
    const southWest: [number, number] = [Math.min(...longitudes), Math.min(...latitudes)];

    hasCenteredOnRegionsRef.current = true;
    cameraRef.current.fitBounds(
      northEast,
      southWest,
      HOME_FIT_BOUNDS_PADDING,
      800
    );
  }, [mapRegions]);

  const handleClusterPress = useCallback((clusterId: number, coordinate: [number, number]) => {
    const clusterIndex = superclusterRef.current;
    if (!clusterIndex || !cameraRef.current) return;

    const expansionZoom = clusterIndex.getClusterExpansionZoom(clusterId);
    cameraRef.current.setCamera({
      centerCoordinate: coordinate,
      zoomLevel: expansionZoom,
      animationDuration: 700,
    });
  }, []);

  const markerData = useMemo(() => {
    if (clusterData.length > 0) return clusterData;
    return mapRegions.map((region) => ({
      type: 'Feature',
      properties: {
        ...region,
        id: region.id,
        cluster: false,
      },
      geometry: {
        type: 'Point',
        coordinates: [region.longitude, region.latitude],
      },
    }));
  }, [clusterData, mapRegions]);

  const fetchRegionCounts = useCallback(async () => {
    if (regions.length === 0) {
      setRegionLocationCounts({});
      return;
    }

    try {
      const activeRegions = regions.filter((region) => region.is_active && !region.is_concept);
      const entries = await Promise.all(
        activeRegions.map(async (region) => {
          const tableName = region.region_name.toLowerCase();
          const { count, error: countError } = await supabase
            .from(tableName)
            .select('id', { count: 'exact', head: true })
            .eq('is_active', true);
          if (countError) {
            throw countError;
          }
          return [region.id, count ?? 0] as const;
        })
      );
      setRegionLocationCounts(Object.fromEntries(entries));
    } catch (err) {
      console.error('Error fetching location counts:', err);
      setRegionLocationCounts({});
    }
  }, [regions]);

  useEffect(() => {
    fetchRegionCounts();
  }, [fetchRegionCounts]);

  const mapbox = Mapbox;
  const MapboxLib = mapbox as NonNullable<typeof Mapbox>;

  return (
    <View style={styles.container}>
      <View style={styles.mapPreviewWrapper}>
        {isMapboxAvailable && mapbox ? (
          <MapboxLib.MapView
            style={styles.mapPreview}
            styleURL={DEFAULT_MAP_STYLE}
            onCameraChanged={handleCameraChanged}
            onMapIdle={handleMapIdle}
            pitchEnabled={false}
            rotateEnabled={false}
            scaleBarEnabled={true}
            compassEnabled={true}
            ref={mapRef}
          >
            <MapboxLib.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [computedMapRegion.longitude, computedMapRegion.latitude],
                zoomLevel: defaultZoomLevel,
              }}
            />
            {markerData.map((item: any) => {
              const [longitude, latitude] = item.geometry.coordinates;
              if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

              const isCluster = Boolean(item?.properties?.cluster);
              if (isCluster) {
                const clusterId = item?.properties?.cluster_id ?? item?.id;
                const pointCount =
                  item?.properties?.exact_pin_count ??
                  item?.properties?.point_count ??
                  0;
                return (
                  <MapboxLib.MarkerView
                    key={`cluster-${clusterId}`}
                    id={`cluster-${clusterId}`}
                    coordinate={[longitude, latitude]}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <TouchableOpacity
                      style={styles.clusterTouchTarget}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (typeof clusterId === 'number') {
                          handleClusterPress(clusterId, [longitude, latitude]);
                        }
                      }}
                    >
                      <MapboxClusterMarker count={pointCount} size="small" />
                    </TouchableOpacity>
                  </MapboxLib.MarkerView>
                );
              }

              const region = item.properties as Region & { latitude: number; longitude: number };
              const isConcept = !region.is_active && region.is_concept;
              return (
                <MapboxLib.MarkerView
                  key={region.id}
                  id={`region-${region.id}`}
                  coordinate={[longitude, latitude]}
                  anchor={{ x: 0.5, y: 1 }}
                >
                  <TouchableOpacity
                    style={[styles.pinTouchTarget, { width: pinSize, height: pinSize }]}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (!isConcept) {
                        handleRegionPress(region);
                      }
                    }}
                  >
                    <View collapsable={false} style={[styles.pinWrapper, { width: pinSize, height: pinSize }]}>
                      <Image
                        source={isConcept ? PIN_CONCEPT : PIN_ACTIVE}
                        style={[styles.pinImage, { width: pinSize, height: pinSize }]}
                      />
                      {regionLocationCounts[region.id] !== undefined && (() => {
                        const count = regionLocationCounts[region.id];
                        const digitCount = String(count).length;
                        // Keep badge proportional to pin size and scale text down for longer values.
                        const badgeSize = clamp(
                          Math.round(pinSize * (0.52 + Math.max(0, digitCount - 1) * 0.08)),
                          11,
                          Math.round(pinSize * 0.88)
                        );
                        const fontSize = clamp(
                          Math.round(
                            pinSize * (digitCount >= 4 ? 0.24 : digitCount === 3 ? 0.28 : 0.34)
                          ),
                          11,
                          18
                        );
                        return (
                          <View style={[
                            styles.pinCountBadge,
                            {
                              width: badgeSize,
                              height: badgeSize,
                              borderRadius: badgeSize / 2,
                              // Position at top-right, attached to the pin edge
                              top: -badgeSize / 2,
                              right: -badgeSize / 2,
                            }
                          ]}>
                            <Text
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.55}
                              style={[styles.pinCountText, { fontSize }]}
                            >
                              {count}
                            </Text>
                          </View>
                        );
                      })()}
                    </View>
                  </TouchableOpacity>
                </MapboxLib.MarkerView>
              );
            })}
          </MapboxLib.MapView>
        ) : (
          <View style={styles.mapUnavailable}>
            <Text style={styles.mapUnavailableTitle}>Map unavailable in Expo Go</Text>
            <Text style={styles.mapUnavailableText}>Use a development build to load Mapbox native code.</Text>
          </View>
        )}
      </View>

      {/* Logo */}
      <Image source={SPORTINKAART_LOGO} style={styles.logo} />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#04e1b2" />
          <Text style={styles.loadingText}>{t('home.loading')}</Text>
        </View>
      )}
      {error && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{t('home.error')}</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRegions}>
            <Text style={styles.retryButtonText}>{t('home.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.fixedButtonBar}>
        <TouchableOpacity
          style={styles.favoritesButtonWrapper}
          onPress={() => router.push('/(tabs)/favorites')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#1a3b30', '#04e1b2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.favoritesGradient}
          >
            <Text style={styles.favoritesIcon}>♥</Text>
            <Text style={styles.favoritesText}>{t('home.favorites')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactButtonWrapper}
          onPress={handleContactPress}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#04e1b2', '#1a3b30']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.contactGradient}
          >
            <Text style={styles.contactIcon}>✉️</Text>
            <Text style={styles.contactButtonText}>{t('home.contact')}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <LanguageSwitcher inline={true} />
      </View>

      <SuggestionForm
        visible={showSuggestionForm}
        onClose={() => setShowSuggestionForm(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050f08',
  },
  mapPreviewWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  mapPreview: {
    flex: 1,
  },
  mapUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#06120b',
  },
  mapUnavailableTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  mapUnavailableText: {
    marginTop: 8,
    color: '#c8d6cf',
    fontSize: 14,
    textAlign: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(5, 15, 8, 0.85)',
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 15,
  },
  errorOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#04e1b2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#0b2419',
    fontSize: 14,
    fontWeight: 'bold',
  },
  fixedButtonBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 15,
    paddingBottom: 25,
    backgroundColor: '#050f08',
  },
  favoritesButtonWrapper: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  favoritesGradient: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  favoritesIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  favoritesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  contactButtonWrapper: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  contactGradient: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  contactIcon: {
    fontSize: 16,
    color: '#ffffff',
  },
  contactButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  pinWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinTouchTarget: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterTouchTarget: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinImage: {
    resizeMode: 'contain',
  },
  pinCountBadge: {
    position: 'absolute',
    backgroundColor: '#04e1b2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: '#0b2419',
  },
  pinCountText: {
    color: '#0b2419',
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false,
  },
  logo: {
    position: 'absolute',
    left: 20,
    bottom: 105,
    width: 40,
    height: 40,
    borderRadius: 8,
  },
});
