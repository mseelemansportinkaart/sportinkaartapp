import { useLanguage } from '@/contexts/LanguageContext';
import { useFilters } from '@/contexts/FiltersContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useDebounce } from '@/hooks/useDebounce';
import { isMapboxAvailable, Mapbox } from '@/lib/mapboxRuntime';
import { supabase } from '@/lib/supabase';
import { getSportEmoji } from '@/utils/sportEmoji';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// Mapbox imports
import {
  DEFAULT_MAP_STYLE,
  CAMERA_CONFIG,
  CLUSTERING_CONFIG,
  LOCATION_CLUSTERING,
  MARKER_CONFIG,
} from '@/lib/mapboxConfig';
import { getZoomFromDelta } from '@/utils/mapUtils';
import {
  buildLocationFeatureCollection,
  collectEmojiIcons,
} from '@/utils/locationFeatures';
import { MapboxLocationPin } from '@/components/MapboxLocationPin';

// Type alias for region (keeping compatibility with existing code)
type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

interface Region {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  created_at: string;
  updated_at: string;
}

interface Location {
  id: string;
  naam: string;
  sport: string;
  sports: string[];
  stadsdeel: string;
  adres: string;
  website: string;
  email: string;
  kosten: string;
  cost_range?: string | null;
  cost_structure?: string | null;
  faciliteiten: string;
  faciliteitenLijst: string[];
  lidWordenMogelijk: boolean;
  is_featured: boolean;
  is_partner: boolean;
  main_image_url?: string;
  images: any[];
  phone?: string;
  latitude: number | null;
  longitude: number | null;
  locationCount?: number;
}

interface Facility {
  id: string;
  name: string;
  category: string;
}

// Helper function to convert IDs to numeric IDs for favorites checks
const getNumericId = (uuidString: string | undefined | null): number => {
  const str = String(uuidString || '');
  if (!str || str === 'undefined' || str === 'null' || str.length === 0) {
    return 0;
  }

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Constants
const PAGE_SIZE = 1000;
const FIT_BOUNDS_PADDING: [number, number, number, number] = [180, 36, 90, 36]; // [top, right, bottom, left]

const FAVORITE_ICON_KEY = 'location-favorite-heart';

// Style objects for the clustered ShapeSource layers. Marker rendering lives on
// the map thread, so panning/zooming never waits on React re-renders.
const CLUSTER_CIRCLE_STYLE = {
  circleColor: CLUSTERING_CONFIG.COLORS.BACKGROUND,
  circleRadius: ['step', ['get', 'point_count'], 15, 10, 19, 25, 23, 75, 27],
  circleStrokeWidth: 2,
  circleStrokeColor: CLUSTERING_CONFIG.COLORS.TEXT,
} as const;

const CLUSTER_COUNT_STYLE = {
  textField: ['to-string', ['get', 'point_count']],
  textSize: 13,
  textColor: CLUSTERING_CONFIG.COLORS.TEXT,
  textAllowOverlap: true,
  textIgnorePlacement: true,
} as const;

const LOCATION_DOT_STYLE = {
  circleColor: MARKER_CONFIG.LOCATION_PIN.SELECTED_BACKGROUND_COLOR,
  circleRadius: 6,
  circleStrokeWidth: MARKER_CONFIG.LOCATION_PIN.BORDER_WIDTH,
  circleStrokeColor: MARKER_CONFIG.LOCATION_PIN.BORDER_COLOR,
} as const;

const EMOJI_PIN_STYLE = {
  iconImage: ['get', 'emojiIcon'],
  iconAnchor: 'bottom',
  iconOffset: [0, -9],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
} as const;

const FAVORITE_BADGE_STYLE = {
  iconImage: FAVORITE_ICON_KEY,
  iconAnchor: 'bottom',
  iconOffset: [-14, -24],
  iconAllowOverlap: true,
  iconIgnorePlacement: true,
} as const;

const CLUSTER_FILTER = ['has', 'point_count'] as const;
const SINGLE_POINT_FILTER = ['!', ['has', 'point_count']] as const;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = value.trim().replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeCostStructure = (value?: string | null): 'monthly' | 'yearly' | 'lesson' | null => {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (
    normalized === 'monthly' ||
    normalized === 'per_month' ||
    normalized === 'maandelijks' ||
    normalized.includes('per month') ||
    normalized.includes('per maand')
  ) {
    return 'monthly';
  }
  if (
    normalized === 'yearly' ||
    normalized === 'per_year' ||
    normalized === 'jaarlijks' ||
    normalized.includes('per year') ||
    normalized.includes('per jaar')
  ) {
    return 'yearly';
  }
  if (
    normalized === 'per_lesson' ||
    normalized === 'per_les' ||
    normalized === 'lesson' ||
    normalized.includes('per lesson') ||
    normalized.includes('per les')
  ) {
    return 'lesson';
  }
  return null;
};

const labelFromCostTemplate = (template: string): string => {
  return template.replace('Vanaf €{amount} ', '').replace('From €{amount} ', '').trim();
};

const hasValidCoordinates = (
  location: Location
): location is Location & { latitude: number; longitude: number } => {
  return (
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude)
  );
};

export default function RegionMapScreen() {
  const mapbox = Mapbox;
  const MapboxLib = mapbox as NonNullable<typeof Mapbox>;
  const { t, language } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const params = useLocalSearchParams();
  const regionSlug = params.slug as string;
  const {
    setRegionSlug,
    searchQuery,
    setSearchQuery,
    selectedSports,
    setSelectedSports,
    selectedFaciliteiten,
    setSelectedFaciliteiten,
    kostenFilterActive,
    setKostenFilterActive,
    minKosten,
    setMinKosten,
    maxKosten,
    setMaxKosten,
    selectedCostStructure,
    setSelectedCostStructure,
    resetFilters: resetSharedFilters,
  } = useFilters();

  const [region, setRegion] = useState<Region | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [rawLocationsData, setRawLocationsData] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);

  useEffect(() => {
    if (regionSlug) {
      setRegionSlug(regionSlug);
    }
  }, [regionSlug, setRegionSlug]);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showFilters, setShowFilters] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const [activeFilterModal, setActiveFilterModal] = useState<
    'sport' | 'faciliteiten' | 'kosten' | null
  >(null);
  const [tempSelectedSports, setTempSelectedSports] = useState<string[]>([]);
  const [tempSelectedFaciliteiten, setTempSelectedFaciliteiten] = useState<string[]>([]);
  const [tempMinKosten, setTempMinKosten] = useState('');
  const [tempMaxKosten, setTempMaxKosten] = useState('');
  const [tempCostStructure, setTempCostStructure] = useState<'monthly' | 'yearly' | 'lesson' | null>(null);

  const invalidCoordsLogRef = useRef<Set<string>>(new Set());
  const mapRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const shapeSourceRef = useRef<any>(null);
  const permissionRequestedRef = useRef(false);
  const hasCenteredOnLocationsRef = useRef(false);
  // A tap on a feature fires both the ShapeSource and MapView press handlers;
  // this keeps the map-level handler from immediately clearing the selection.
  const suppressMapPressUntilRef = useRef(0);


  // Safe location selection handler with batched state updates
  const handleLocationPress = useCallback((location: Location) => {
    // Use requestAnimationFrame to batch the state update and prevent race conditions
    requestAnimationFrame(() => {
      setSelectedLocation(location);
    });
  }, []);

  const centerOnUser = useCallback(
    async (source: 'auto' | 'button') => {
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        if (existing.status === 'granted') {
          setHasLocationPermission(true);
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          // Use Mapbox camera
          cameraRef.current?.setCamera({
            centerCoordinate: [current.coords.longitude, current.coords.latitude],
            zoomLevel: 14,
            animationDuration: CAMERA_CONFIG.DURATION,
          });
          return;
        }

        // If permission was previously denied and user taps button again, guide to Settings
        if (source === 'button' && permissionRequestedRef.current && existing.status === 'denied') {
          Alert.alert(
            t('location.permissionSettingsTitle'),
            t('location.permissionSettingsMessage'),
            [
              {
                text: t('location.permissionSettingsClose'),
                style: 'cancel',
              },
              {
                text: t('location.permissionSettingsOpen'),
                onPress: () => Linking.openSettings(),
              },
            ]
          );
          return;
        }

        // Request permission directly - OS will show native dialog
        permissionRequestedRef.current = true;
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        setHasLocationPermission(true);
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // Use Mapbox camera
        cameraRef.current?.setCamera({
          centerCoordinate: [current.coords.longitude, current.coords.latitude],
          zoomLevel: 14,
          animationDuration: CAMERA_CONFIG.DURATION,
        });
      } catch (err) {
        console.warn('Failed to request location:', err);
      }
    },
    [t]
  );

  const capitalizeText = (text: string): string => {
    return text
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const availableSports = useMemo(() => {
    const sportsMap = new Map<string, string>();

    rawLocationsData.forEach((location: any) => {
      const currentLangSports = language === 'nl' ? location.sport_nl : location.sport_en;

      const processSports = (sports: string | string[]) => {
        const sportsArray = Array.isArray(sports) ? sports : [sports];
        sportsArray.forEach((sport) => {
          if (sport && sport.trim() !== '') {
            const normalized = sport.toLowerCase();
            if (!sportsMap.has(normalized)) {
              sportsMap.set(normalized, capitalizeText(sport));
            }
          }
        });
      };

      if (currentLangSports) processSports(currentLangSports);
    });

    return Array.from(sportsMap.values()).sort((a, b) =>
      a.localeCompare(b, language === 'nl' ? 'nl' : 'en', { sensitivity: 'base' })
    );
  }, [rawLocationsData, language]);

  const activeFilterCount =
    selectedSports.length +
    selectedFaciliteiten.length +
    (kostenFilterActive ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const costStructureOptions: { key: 'monthly' | 'yearly' | 'lesson'; label: string }[] = [
    { key: 'monthly', label: labelFromCostTemplate(t('region.costFromMonthly')) },
    { key: 'yearly', label: labelFromCostTemplate(t('region.costFromYearly')) },
    { key: 'lesson', label: labelFromCostTemplate(t('region.costFromLesson')) },
  ];

  const filteredLocations = useMemo(() => {
    let filtered = allLocations;

    if (debouncedSearchQuery !== '') {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((location: Location) =>
        location.naam.toLowerCase().includes(query) ||
        location.sports.some((sport) => sport.toLowerCase().includes(query))
      );
    }

    if (selectedSports.length > 0) {
      const normalizedSelectedSports = selectedSports.map((s) => s.toLowerCase());
      filtered = filtered.filter((location: Location) =>
        location.sports.some((sport) =>
          normalizedSelectedSports.includes(sport.toLowerCase())
        )
      );
    }

    if (kostenFilterActive && (minKosten !== '' || maxKosten !== '')) {
      filtered = filtered.filter((location: Location) => {
        const costRange = location.cost_range ?? '';
        const kostenMatch = costRange.match(/\d+/g);
        const numbers = (kostenMatch || [])
          .map((value) => parseInt(value, 10))
          .filter((value) => !Number.isNaN(value));

        const structure = normalizeCostStructure(location.cost_structure);
        if (!structure && numbers.length === 0) return true;

        if (structure && selectedCostStructure && structure !== selectedCostStructure) {
          return false;
        }

        if (numbers.length === 0) return true;

        const minValue = Math.min(...numbers);
        const maxValue = Math.max(...numbers);
        const minTrimmed = minKosten.trim();
        const maxTrimmed = maxKosten.trim();
        const min = minTrimmed ? parseInt(minTrimmed, 10) : 0;
        const max = maxTrimmed ? parseInt(maxTrimmed, 10) : 99999;

        if (minTrimmed !== '' && minValue < min) return false;
        if (maxTrimmed !== '' && maxValue > max) return false;
        return true;
      });
    }

    if (selectedFaciliteiten.length > 0) {
      filtered = filtered.filter((location: Location) => {
        const hasUnknownFacilities =
          location.faciliteitenLijst.includes('Unknown') ||
          location.faciliteitenLijst.includes('Niet bekend');

        if (hasUnknownFacilities) return true;

        return selectedFaciliteiten.some((selectedFaciliteit) =>
          location.faciliteitenLijst &&
          location.faciliteitenLijst.some(
            (facility) => facility.toLowerCase() === selectedFaciliteit.toLowerCase()
          )
        );
      });
    }

    return filtered.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.is_featured === b.is_featured) {
        if (a.is_partner && !b.is_partner) return -1;
        if (!a.is_partner && b.is_partner) return 1;
      }
      return a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' });
    });
  }, [
    allLocations,
    debouncedSearchQuery,
    selectedSports,
    kostenFilterActive,
    minKosten,
    maxKosten,
    selectedCostStructure,
    selectedFaciliteiten,
  ]);

  const validLocations = useMemo(
    () => filteredLocations.filter(hasValidCoordinates),
    [filteredLocations]
  );


  const calculatedRegion = useMemo((): MapRegion => {
    if (validLocations.length === 0) {
      return {
        latitude: 52.1326,
        longitude: 5.2913,
        latitudeDelta: 2,
        longitudeDelta: 2,
      };
    }

    const lats = validLocations.map((location) => location.latitude);
    const lngs = validLocations.map((location) => location.longitude);

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
  }, [validLocations]);


  useEffect(() => {
    if (!selectedLocation) return;
    const stillVisible = validLocations.some((loc) => String(loc.id) === String(selectedLocation.id));
    if (!stillVisible) {
      requestAnimationFrame(() => {
        setSelectedLocation(null);
      });
    }
  }, [validLocations, selectedLocation]);

  useEffect(() => {
    if (hasCenteredOnLocationsRef.current) return;
    if (!cameraRef.current || validLocations.length === 0) return;

    hasCenteredOnLocationsRef.current = true;

    // Use proper NE/SW corners for fitBounds to avoid centering away from pins.
    const latitudes = validLocations.map((location) => location.latitude);
    const longitudes = validLocations.map((location) => location.longitude);
    const northEast: [number, number] = [Math.max(...longitudes), Math.max(...latitudes)];
    const southWest: [number, number] = [Math.min(...longitudes), Math.min(...latitudes)];

    cameraRef.current.fitBounds(
      northEast,
      southWest,
      FIT_BOUNDS_PADDING,
      CAMERA_CONFIG.DURATION
    );
  }, [validLocations]);


  // GeoJSON for the clustered ShapeSource; the map engine does the clustering
  // and draws every marker natively, so gestures never drop or lag markers.
  const locationShape = useMemo(
    () =>
      buildLocationFeatureCollection(validLocations, (location) =>
        isFavorite(getNumericId(String(location.id)))
      ),
    [validLocations, isFavorite]
  );

  const emojiIcons = useMemo(() => collectEmojiIcons(validLocations), [validLocations]);

  // The selected location renders as a MarkerView tooltip, so hide its native
  // emoji symbol to avoid drawing the tooltip twice.
  const selectedLocationId = selectedLocation ? String(selectedLocation.id) : null;
  const emojiPinFilter = useMemo(() => {
    if (!selectedLocationId) return SINGLE_POINT_FILTER;
    return ['all', SINGLE_POINT_FILTER, ['!=', ['get', 'id'], selectedLocationId]];
  }, [selectedLocationId]);

  const favoriteBadgeFilter = useMemo(() => {
    const base: any[] = ['all', SINGLE_POINT_FILTER, ['==', ['get', 'isFavorite'], true]];
    if (selectedLocationId) {
      base.push(['!=', ['get', 'id'], selectedLocationId]);
    }
    return base;
  }, [selectedLocationId]);

  const handleShapeSourcePress = useCallback(
    async (event: any) => {
      const feature = event?.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return;

      suppressMapPressUntilRef.current = Date.now() + 350;
      const properties = feature.properties ?? {};

      if (properties.cluster) {
        let zoomLevel: number | null = null;
        try {
          const expansionZoom = await shapeSourceRef.current?.getClusterExpansionZoom(feature);
          if (Number.isFinite(expansionZoom)) {
            zoomLevel = Math.min(Number(expansionZoom) + 0.4, 17);
          }
        } catch {
          // Fall through to the fixed fallback zoom below.
        }
        cameraRef.current?.setCamera({
          centerCoordinate: [coordinates[0], coordinates[1]],
          zoomLevel: zoomLevel ?? LOCATION_CLUSTERING.EMOJI_MIN_ZOOM,
          animationDuration: CAMERA_CONFIG.DURATION,
        });
        return;
      }

      const location = validLocations.find(
        (candidate) => String(candidate.id) === String(properties.id)
      );
      if (location) {
        handleLocationPress(location);
      }
    },
    [validLocations, handleLocationPress]
  );


  // Helper function to format cost with structure
  // Returns empty string for Unknown/null to hide the cost row
  const formatCostWithStructure = (costRange: string | null, costStructure: string | null): string => {
    // Hide costs for Unknown or null cost_structure
    if (!costStructure || costStructure.toLowerCase() === 'unknown') {
      return '';
    }

    if (!costRange || costRange.toLowerCase() === 'unknown') {
      return '';
    }

    // Extract numeric value from cost_range
    const amount = costRange.replace(/[^0-9.,]/g, '').trim();
    if (!amount) {
      return '';
    }

    // Format based on cost_structure
    const structure = costStructure.toLowerCase();

    // Handle "From xxx to yyy" range format - extract both numbers
    if (structure.includes(' to ') || structure.includes(' tot ')) {
      const numbers = costRange.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        return language === 'nl'
          ? `Vanaf €${numbers[0]} tot €${numbers[1]} per maand`
          : `From €${numbers[0]} to €${numbers[1]} per month`;
      }
      return language === 'nl'
        ? `Vanaf €${amount} per maand`
        : `From €${amount} per month`;
    }

    if (structure === 'monthly' || structure === 'per_month' || structure === 'maandelijks' || structure.includes('per month') || structure.includes('per maand')) {
      return language === 'nl'
        ? `Vanaf €${amount} per maand`
        : `From €${amount} per month`;
    } else if (structure === 'yearly' || structure === 'per_year' || structure === 'jaarlijks' || structure.includes('per year') || structure.includes('per jaar')) {
      return language === 'nl'
        ? `Vanaf €${amount} per jaar`
        : `From €${amount} per year`;
    } else if (structure === 'per_lesson' || structure === 'per_les' || structure === 'lesson' || structure.includes('per lesson') || structure.includes('per les')) {
      return language === 'nl'
        ? `Vanaf €${amount} per les`
        : `From €${amount} per lesson`;
    }

    // Default: just show the amount with euro sign
    return `€${amount}`;
  };

  const splitCostLabel = (label: string): { prefix: string; timeframe: string } | null => {
    const tokens = [
      ' per maand',
      ' per jaar',
      ' per les',
      ' per month',
      ' per year',
      ' per lesson',
    ];

    for (const token of tokens) {
      const index = label.indexOf(token);
      if (index !== -1) {
        const prefix = label.slice(0, index).trimEnd();
        const timeframe = label.slice(index).trim();
        return { prefix, timeframe };
      }
    }

    return null;
  };

  const locationToClub = useCallback((location: Location) => ({
    id: getNumericId(location.id),
    naam: location.naam,
    sport: location.sport,
    stadsdeel: location.stadsdeel,
    adres: location.adres,
    doelgroepen: '',
    website: location.website,
    email: location.email,
    kosten: location.kosten,
    faciliteiten: location.faciliteiten,
    faciliteitenLijst: location.faciliteitenLijst,
    lidWordenMogelijk: location.lidWordenMogelijk,
    is_featured: location.is_featured,
    is_partner: location.is_partner,
  }), []);

  const handleMoreInfo = useCallback(async (location: Location) => {
    if (location.website) {
      try {
        const url = location.website.startsWith('http')
          ? location.website
          : `https://${location.website}`;

        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      } catch (error) {
        console.error('Error opening website:', error);
      }
    }
  }, []);

  const handleFavoriteToggle = useCallback(async (location: Location) => {
    try {
      const club = locationToClub(location);
      await toggleFavorite(club);
    } catch (error) {
      Alert.alert('Fout', 'Er ging iets mis bij het opslaan van je favoriet');
    }
  }, [locationToClub, toggleFavorite]);

  const transformLocationData = (location: any, regionName: string): Location => {
    const sportValue = language === 'nl' ? location.sport_nl : location.sport_en;

    let sportsArray: string[] = [];
    if (Array.isArray(sportValue)) {
      sportsArray = sportValue.filter((s: string) => s && s.trim() !== '');
    } else if (sportValue && typeof sportValue === 'string' && sportValue.trim() !== '') {
      sportsArray = [sportValue];
    }

    const sport =
      sportsArray.length > 1
        ? language === 'nl'
          ? 'Diverse sporten'
          : 'Various sports'
        : sportsArray.length === 1
        ? sportsArray[0]
        : language === 'nl'
        ? 'Diverse sporten'
        : 'Various sports';

    const description =
      language === 'nl' ? location.description_nl || '' : location.description_en || '';
    const facilitiesData =
      language === 'nl' ? location.facilities_nl || [] : location.facilities_en || [];
    const rawLocationCount = Number(location?.location_count ?? location?.locationCount);
    const normalizedLocationCount =
      Number.isFinite(rawLocationCount) && rawLocationCount > 0 ? Math.round(rawLocationCount) : 1;

    return {
      id: location.id,
      naam: location.name || 'Unknown',
      sport: sport,
      sports: sportsArray,
      stadsdeel: location.address ? location.address.split(',')[0] : regionName,
      adres: location.address || '',
      website: location.website || '',
      email: location.email || '',
      kosten: formatCostWithStructure(location.cost_range, location.cost_structure),
      cost_range: location.cost_range ?? null,
      cost_structure: location.cost_structure ?? null,
      faciliteiten: description,
      faciliteitenLijst: facilitiesData,
      lidWordenMogelijk: location.membership_available !== false,
      is_featured: location.is_featured || false,
      is_partner: location.is_partner || false,
      main_image_url: location.main_image_url,
      images: [],
      phone: location.phone,
      latitude: toFiniteNumber(location.latitude),
      longitude: toFiniteNumber(location.longitude),
      locationCount: normalizedLocationCount,
    };
  };

  const sortLocations = (locations: Location[]): Location[] => {
    return locations.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      if (a.is_featured === b.is_featured) {
        if (a.is_partner && !b.is_partner) return -1;
        if (!a.is_partner && b.is_partner) return 1;
      }
      return a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' });
    });
  };

  const fetchRegionDataProgressive = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: regionData, error: regionError } = await supabase
        .from('regions')
        .select('*')
        .eq('slug', regionSlug)
        .eq('is_active', true)
        .eq('is_concept', false)
        .single();

      if (regionError) throw regionError;
      if (!regionData) throw new Error('Region not found');

      setRegion(regionData);
      const locationTableName = regionData.region_name.toLowerCase();
      const selectFields = `
        id, name, sport_nl, sport_en, description_nl, description_en,
        facilities_nl, facilities_en, address, website, email,
        cost_range, cost_structure, membership_available, is_featured, is_partner,
        main_image_url, phone, is_active, latitude, longitude
      `;

      const { count: totalCount, error: countError } = await supabase
        .from(locationTableName)
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      if (countError) throw countError;

      const allRawData: any[] = [];
      let offset = 0;
      const expectedTotal = typeof totalCount === 'number' ? totalCount : null;

      while (expectedTotal === null || offset < expectedTotal) {
        const { data: pageData, error: pageError } = await supabase
          .from(locationTableName)
          .select(selectFields)
          .eq('is_active', true)
          .order('is_featured', { ascending: false })
          .order('is_partner', { ascending: false })
          .order('name', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (pageError) throw pageError;

        const rows = pageData || [];
        allRawData.push(...rows);

        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;

        if (expectedTotal !== null && allRawData.length >= expectedTotal) break;
      }

      const allTransformed = allRawData.map((loc: any) =>
        transformLocationData(loc, regionData.region_name)
      );
      const sortedAll = sortLocations(allTransformed);

      setRawLocationsData(allRawData);
      setAllLocations(sortedAll);

      const facilitiesMap = new Map<string, string>();
      allRawData.forEach((location: any) => {
        const currentLangFacilities =
          language === 'nl' ? location.facilities_nl || [] : location.facilities_en || [];
        currentLangFacilities.forEach((facility: string) => {
          if (facility && facility !== 'Unknown' && facility !== 'Niet bekend') {
            const normalized = facility.toLowerCase();
            if (!facilitiesMap.has(normalized)) {
              facilitiesMap.set(normalized, capitalizeText(facility));
            }
          }
        });
      });

      const uniqueFacilities = Array.from(facilitiesMap.values())
        .sort((a, b) => a.localeCompare(b, language === 'nl' ? 'nl' : 'en', { sensitivity: 'base' }))
        .map((name) => ({ id: name, name: name, category: 'Faciliteit' }));

      setFacilities(uniqueFacilities);
    } catch (err) {
      console.error('Error loading region map data:', err);
      const errorMessage =
        err instanceof Error ? err.message : t('region.error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [language, regionSlug, t]);

  useEffect(() => {
    if (regionSlug) {
      fetchRegionDataProgressive();
    } else {
      setError(t('region.error'));
      setLoading(false);
    }
  }, [fetchRegionDataProgressive, regionSlug]);

  useEffect(() => {
    const invalidCount = filteredLocations.length - validLocations.length;
    if (invalidCount <= 0) return;

    const invalidLocationIds = filteredLocations
      .filter((location) => !hasValidCoordinates(location))
      .map((location) => location.id)
      .filter((id) => !invalidCoordsLogRef.current.has(id));

    if (invalidLocationIds.length === 0) return;

    invalidLocationIds.forEach((id) => invalidCoordsLogRef.current.add(id));
    console.warn('[map] Skipping locations with invalid coordinates', invalidLocationIds);
  }, [filteredLocations, validLocations]);

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const openFilterModal = useCallback(
    (filterType: 'sport' | 'faciliteiten' | 'kosten') => {
      if (filterType === 'sport') {
        setTempSelectedSports([...selectedSports]);
      } else if (filterType === 'faciliteiten') {
        setTempSelectedFaciliteiten([...selectedFaciliteiten]);
      } else if (filterType === 'kosten') {
        setTempMinKosten(minKosten);
        setTempMaxKosten(maxKosten);
        setTempCostStructure(selectedCostStructure);
      }
      setActiveFilterModal(filterType);
    },
    [selectedSports, selectedFaciliteiten, minKosten, maxKosten, selectedCostStructure]
  );

  const closeFilterModal = useCallback(() => {
    setActiveFilterModal(null);
  }, []);

  const applyFilterModal = useCallback(() => {
    if (activeFilterModal === 'sport') {
      setSelectedSports([...tempSelectedSports]);
    } else if (activeFilterModal === 'faciliteiten') {
      setSelectedFaciliteiten([...tempSelectedFaciliteiten]);
    } else if (activeFilterModal === 'kosten') {
      const trimmedMin = tempMinKosten.trim();
      const trimmedMax = tempMaxKosten.trim();
      setMinKosten(trimmedMin);
      setMaxKosten(trimmedMax);
      setSelectedCostStructure(tempCostStructure);
      setKostenFilterActive(
        tempCostStructure !== null && (trimmedMin !== '' || trimmedMax !== '')
      );
    }
    setActiveFilterModal(null);
  }, [
    activeFilterModal,
    tempSelectedSports,
    tempSelectedFaciliteiten,
    tempMinKosten,
    tempMaxKosten,
    tempCostStructure,
  ]);

  const resetFilters = useCallback(() => {
    resetSharedFilters();
  }, [resetSharedFilters]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#04e1b2" />
        <Text style={styles.loadingText}>{t('region.loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('region.error')}</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRegionDataProgressive}>
          <Text style={styles.retryButtonText}>{t('home.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!isMapboxAvailable || !mapbox) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Map unavailable in Expo Go</Text>
        <Text style={styles.errorMessage}>
          Use a development build to load Mapbox native code.
        </Text>
      </View>
    );
  }

  return (
      <View style={styles.container}>
      <MapboxLib.MapView
        testID="region-map"
        style={styles.map}
        styleURL={DEFAULT_MAP_STYLE}
        compassEnabled={true}
        scaleBarEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        onPress={() => {
          if (Date.now() < suppressMapPressUntilRef.current) return;
          requestAnimationFrame(() => {
            setSelectedLocation(null);
          });
        }}
        ref={mapRef}
      >
        <MapboxLib.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [calculatedRegion.longitude, calculatedRegion.latitude],
            zoomLevel: getZoomFromDelta(calculatedRegion.latitudeDelta),
          }}
        />

        {hasLocationPermission && (
          <MapboxLib.UserLocation visible={true} />
        )}

        <MapboxLib.Images>
          {emojiIcons.map(({ key, emoji }) => (
            <MapboxLib.Image key={key} name={key}>
              <View collapsable={false} style={styles.emojiIconWrapper}>
                <View style={styles.emojiIconTooltip}>
                  <Text style={styles.emojiIconText}>{emoji}</Text>
                </View>
                <View style={styles.emojiIconPointer} />
              </View>
            </MapboxLib.Image>
          ))}
          <MapboxLib.Image name={FAVORITE_ICON_KEY}>
            <View collapsable={false} style={styles.favoriteIconWrapper}>
              <Text style={styles.favoriteIconText}>♥</Text>
            </View>
          </MapboxLib.Image>
        </MapboxLib.Images>

        <MapboxLib.ShapeSource
          id="region-locations"
          ref={shapeSourceRef}
          shape={locationShape}
          cluster
          clusterRadius={LOCATION_CLUSTERING.RADIUS}
          clusterMaxZoomLevel={LOCATION_CLUSTERING.MAX_ZOOM}
          onPress={handleShapeSourcePress}
        >
          <MapboxLib.CircleLayer
            id="location-cluster-circles"
            filter={CLUSTER_FILTER as any}
            style={CLUSTER_CIRCLE_STYLE as any}
          />
          <MapboxLib.SymbolLayer
            id="location-cluster-counts"
            filter={CLUSTER_FILTER as any}
            style={CLUSTER_COUNT_STYLE as any}
          />
          <MapboxLib.CircleLayer
            id="location-dots"
            filter={SINGLE_POINT_FILTER as any}
            style={LOCATION_DOT_STYLE as any}
          />
          <MapboxLib.SymbolLayer
            id="location-emoji-pins"
            filter={emojiPinFilter as any}
            minZoomLevel={LOCATION_CLUSTERING.EMOJI_MIN_ZOOM}
            style={EMOJI_PIN_STYLE as any}
          />
          <MapboxLib.SymbolLayer
            id="location-favorite-badges"
            filter={favoriteBadgeFilter as any}
            minZoomLevel={LOCATION_CLUSTERING.EMOJI_MIN_ZOOM}
            style={FAVORITE_BADGE_STYLE as any}
          />
        </MapboxLib.ShapeSource>

        {selectedLocation && hasValidCoordinates(selectedLocation) && (
          <MapboxLib.MarkerView
            key={`selected-${selectedLocation.id}`}
            id={`selected-${selectedLocation.id}`}
            coordinate={[selectedLocation.longitude, selectedLocation.latitude]}
            anchor={{ x: 0.5, y: 1 }}
            allowOverlap
          >
            <View style={styles.locationMarkerTouchTarget} pointerEvents="none">
              <MapboxLocationPin
                sportEmoji={getSportEmoji(selectedLocation.sports || [], selectedLocation.sport)}
                isFavorite={isFavorite(getNumericId(selectedLocation.id))}
                showEmoji
                isSelected
              />
            </View>
          </MapboxLib.MarkerView>
        )}
      </MapboxLib.MapView>

      {selectedLocation && (
        <View style={styles.selectedCard}>
          <View
            style={[
              styles.clubCard,
              selectedLocation.is_featured && styles.featuredClubCard,
            ]}
          >
            <LinearGradient colors={['#ffffff', '#f8f9fa']} style={styles.clubCardGradient}>
              <View style={styles.clubHeader}>
                  <Text style={styles.clubName} numberOfLines={2} ellipsizeMode="tail">
                    {selectedLocation.naam}
                  </Text>
                <View style={styles.clubHeaderRight}>
                  <View style={styles.sportTag}>
                    <Text style={styles.sportText}>{selectedLocation.sport}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.favoriteButton}
                    onPress={() => handleFavoriteToggle(selectedLocation)}
                  >
                    <Text
                      style={[
                        styles.favoriteIcon,
                        {
                          color: isFavorite(getNumericId(selectedLocation.id))
                            ? '#04e1b2'
                            : '#999',
                        },
                      ]}
                    >
                      {isFavorite(getNumericId(selectedLocation.id)) ? '♥' : '♡'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {(selectedLocation.is_featured || selectedLocation.is_partner) && (
                <View style={styles.tagsRowContainer}>
                  <View style={styles.tagsRow}>
                    {selectedLocation.is_featured && (
                      <View style={styles.featuredTag}>
                        <Text style={styles.featuredText}>⭐ {t('region.featured')}</Text>
                      </View>
                    )}
                    {selectedLocation.is_partner && (
                      <View style={styles.partnerTag}>
                        <Text style={styles.partnerText}>🤝 {t('region.partner')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {selectedLocation.sports.length > 0 && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>{getSportEmoji(selectedLocation.sports, selectedLocation.sport)}</Text>
                  <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                    {selectedLocation.sports.map(capitalizeText).join(', ')}
                  </Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoEmoji}>📍</Text>
                <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                  {selectedLocation.adres}
                </Text>
              </View>
              {selectedLocation.kosten !== '' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoEmoji}>💰</Text>
                  {(() => {
                    const parts = splitCostLabel(selectedLocation.kosten);
                    if (!parts) {
                      return (
                        <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                          {selectedLocation.kosten}
                        </Text>
                      );
                    }
                    return (
                      <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                        {parts.prefix} <Text style={styles.infoTextEmphasis}>{parts.timeframe}</Text>
                      </Text>
                    );
                  })()}
                </View>
              )}
              {(() => {
                const validFacilities = selectedLocation.faciliteitenLijst.filter(
                  (f) => f && f.toLowerCase() !== 'unknown' && f.toLowerCase() !== 'niet bekend'
                );
                return validFacilities.length > 0 ? (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoEmoji}>🏛️</Text>
                    <Text style={styles.infoText} numberOfLines={1} ellipsizeMode="tail">
                      {validFacilities.map(capitalizeText).join(', ')}
                    </Text>
                  </View>
                ) : null;
              })()}

              {selectedLocation.lidWordenMogelijk && selectedLocation.website && (
                <TouchableOpacity
                  style={styles.lidWordenButtonContainer}
                  onPress={() => handleMoreInfo(selectedLocation)}
                >
                  <LinearGradient colors={['#04e1b2', '#1a3b30']} style={styles.lidWordenButton}>
                    <Text style={styles.lidWordenText}>{t('region.moreInfo')}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        </View>
      )}

      <TouchableOpacity
        style={styles.centerButton}
        onPress={() => centerOnUser('button')}
        activeOpacity={0.8}
      >
        <Text style={styles.centerButtonText}>⌖</Text>
      </TouchableOpacity>

      <View style={styles.headerWithFilters}>
        <View style={[styles.header, !showFilters && styles.headerClosed]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('region.back')}</Text>
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={styles.title}>
                {t('region.locations')} {region?.region_name}
              </Text>
              <Text style={styles.subtitle}>
                {filteredLocations.length} {t('region.locationsFound')}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.toggleFiltersButton}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Text style={styles.toggleFiltersText}>
                {showFilters ? `▲ ${t('region.hideFilters')}` : `▼ ${t('region.filters')}`}
              </Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {showFilters && (
          <View style={styles.filtersPanel}>
            <ScrollView
              contentContainerStyle={styles.filtersContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.filtersTitle}>{t('region.filters')}</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('region.search')}
                  placeholderTextColor="#1a3b30"
                  value={searchQuery}
                  onChangeText={handleSearch}
                />
              </View>

              <View style={styles.filtersGrid}>
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('region.sport')}:</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => openFilterModal('sport')}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {selectedSports.length === 0
                        ? t('filter.allSports')
                        : `${selectedSports.length} ${t('filter.selected')}`}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('region.facilities')}:</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => openFilterModal('faciliteiten')}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {selectedFaciliteiten.length === 0
                        ? t('filter.allFacilities')
                        : `${selectedFaciliteiten.length} ${t('filter.selected')}`}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('filter.costStructure')}:</Text>
                  <TouchableOpacity
                    style={[styles.kostenToggle, kostenFilterActive && styles.kostenToggleActive]}
                    onPress={() => openFilterModal('kosten')}
                  >
                    <Text
                      style={[
                        styles.kostenToggleText,
                        kostenFilterActive && styles.kostenToggleTextActive,
                      ]}
                    >
                      {kostenFilterActive ? t('filter.active') : t('filter.select')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {activeFilterCount > 0 && (
                <View style={styles.resetButtonContainer}>
                  <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                    <Text style={styles.resetButtonText}>{t('filter.resetAll')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.confirmButtonText}>{t('filter.confirm')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {validLocations.length === 0 && (
        <View style={styles.noMarkers}>
          <Text style={styles.noMarkersText}>{t('region.noLocations')}</Text>
          <Text style={styles.noMarkersSubtext}>{t('region.noLocationsSubtext')}</Text>
        </View>
      )}

      <Modal
        visible={activeFilterModal === 'sport'}
        transparent={true}
        animationType="slide"
        onRequestClose={closeFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('filter.selectSport')}</Text>
              <TouchableOpacity onPress={closeFilterModal}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  tempSelectedSports.length === 0 && styles.modalItemSpecial,
                ]}
                onPress={() => setTempSelectedSports([])}
              >
                <Text
                  style={
                    tempSelectedSports.length === 0
                      ? styles.modalItemTextSpecial
                      : styles.modalItemText
                  }
                >
                  {tempSelectedSports.length === 0 ? '✓ ' : ''}
                  {t('filter.allSports')}
                </Text>
              </TouchableOpacity>
              {availableSports.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={styles.modalItem}
                  onPress={() => {
                    setTempSelectedSports((prev) =>
                      prev.includes(sport)
                        ? prev.filter((s) => s !== sport)
                        : [...prev, sport]
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      tempSelectedSports.includes(sport) && styles.modalItemTextSelected,
                    ]}
                  >
                    {tempSelectedSports.includes(sport) ? '✓ ' : ''}
                    {sport}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalApplyButton} onPress={applyFilterModal}>
                <Text style={styles.modalApplyButtonText}>{t('filter.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={activeFilterModal === 'faciliteiten'}
        transparent={true}
        animationType="slide"
        onRequestClose={closeFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('filter.selectFacilities')}</Text>
              <TouchableOpacity onPress={closeFilterModal}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  tempSelectedFaciliteiten.length === 0 && styles.modalItemSpecial,
                ]}
                onPress={() => setTempSelectedFaciliteiten([])}
              >
                <Text
                  style={
                    tempSelectedFaciliteiten.length === 0
                      ? styles.modalItemTextSpecial
                      : styles.modalItemText
                  }
                >
                  {tempSelectedFaciliteiten.length === 0 ? '✓ ' : ''}
                  {t('filter.allFacilities')}
                </Text>
              </TouchableOpacity>
              {facilities.map((facility) => (
                <TouchableOpacity
                  key={facility.name}
                  style={styles.modalItem}
                  onPress={() => {
                    setTempSelectedFaciliteiten((prev) =>
                      prev.includes(facility.name)
                        ? prev.filter((f) => f !== facility.name)
                        : [...prev, facility.name]
                    );
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      tempSelectedFaciliteiten.includes(facility.name) &&
                        styles.modalItemTextSelected,
                    ]}
                  >
                    {tempSelectedFaciliteiten.includes(facility.name) ? '✓ ' : ''}
                    {facility.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.modalApplyButton} onPress={applyFilterModal}>
                <Text style={styles.modalApplyButtonText}>{t('filter.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={activeFilterModal === 'kosten'}
        transparent={true}
        animationType="slide"
        onRequestClose={closeFilterModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('filter.costStructure')}</Text>
              <TouchableOpacity onPress={closeFilterModal}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.modalContent, { padding: 20, paddingBottom: 0 }]}>
              <Text style={styles.modalSectionLabel}>{t('filter.costStructure')}</Text>
              <View style={styles.costStructureRow}>
                {costStructureOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.costStructureButton,
                      tempCostStructure === option.key && styles.costStructureButtonActive,
                    ]}
                    onPress={() => setTempCostStructure(option.key)}
                  >
                    <Text
                      style={[
                        styles.costStructureButtonText,
                        tempCostStructure === option.key && styles.costStructureButtonTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tempCostStructure && (
                <>
                  <Text style={[styles.modalSectionLabel, styles.modalSectionLabelCompact]}>
                    {t('filter.costRange')}
                  </Text>
                  <View style={styles.rangeContainer}>
                    <View style={styles.rangeInputContainer}>
                      <Text style={styles.rangeLabel}>Min €</Text>
                      <TextInput
                        style={styles.rangeInput}
                        keyboardType="numeric"
                        placeholder="0"
                        value={tempMinKosten}
                        onChangeText={setTempMinKosten}
                      />
                    </View>
                    <Text style={styles.rangeSeparator}>-</Text>
                    <View style={styles.rangeInputContainer}>
                      <Text style={styles.rangeLabel}>Max €</Text>
                      <TextInput
                        style={styles.rangeInput}
                        keyboardType="numeric"
                        placeholder="999"
                        value={tempMaxKosten}
                        onChangeText={setTempMaxKosten}
                      />
                    </View>
                  </View>
                  <View style={styles.rangeFooter}>
                    <TouchableOpacity
                      style={styles.rangeResetButton}
                      onPress={() => {
                        setTempMinKosten('');
                        setTempMaxKosten('');
                        setTempCostStructure(null);
                        setActiveFilterModal(null);
                      }}
                    >
                      <Text style={styles.rangeResetButtonText}>{t('filter.resetCost')}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
            <View style={styles.modalFooterCompact}>
              <TouchableOpacity style={styles.modalApplyButton} onPress={applyFilterModal}>
                <Text style={styles.modalApplyButtonText}>{t('filter.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050f08',
  },
  map: {
    flex: 1,
  },
  locationMarkerTouchTarget: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // Rendered off-screen into Mapbox style images (see <MapboxLib.Image>), then
  // drawn by the emoji SymbolLayer; mirrors the MapboxLocationPin tooltip.
  emojiIconWrapper: {
    width: 28,
    height: 26,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  emojiIconTooltip: {
    backgroundColor: '#f7f4ec',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 19,
  },
  emojiIconText: {
    fontSize: 10,
  },
  emojiIconPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#f7f4ec',
  },
  favoriteIconWrapper: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: MARKER_CONFIG.LOCATION_PIN.FAVORITE_BADGE_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  favoriteIconText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginTop: -1,
  },
  circlePin: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#04e1b2',
    borderWidth: 1,
    borderColor: '#0b2419',
  },
  headerWithFilters: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 4,
    maxHeight: '80%',
  },
  header: {
    backgroundColor: 'rgba(5, 15, 8, 0.95)',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    padding: 14,
  },
  headerClosed: {
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: '#04e1b2',
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleBlock: {
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#ffffff',
    opacity: 0.8,
  },
  toggleFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
  },
  toggleFiltersText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#04e1b2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#0b2419',
    fontSize: 10,
    fontWeight: '700',
  },
  filtersPanel: {
    backgroundColor: 'rgba(5, 15, 8, 0.95)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 225, 178, 0.2)',
  },
  filtersContent: {
    paddingBottom: 10,
  },
  filtersTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchContainer: {
    marginBottom: 12,
  },
  searchInput: {
    height: 44,
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0b2419',
    fontWeight: '500',
  },
  filtersGrid: {
    gap: 12,
  },
  filterRow: {
    marginBottom: 6,
  },
  filterLabel: {
    fontSize: 13,
    color: '#04e1b2',
    fontWeight: '600',
    marginBottom: 6,
  },
  dropdownButton: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 13,
    color: '#ffffff',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 13,
    color: '#04e1b2',
    fontWeight: 'bold',
  },
  kostenToggle: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  kostenToggleActive: {
    backgroundColor: '#04e1b2',
  },
  kostenToggleText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '600',
  },
  kostenToggleTextActive: {
    color: '#0b2419',
  },
  resetButtonContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  resetButton: {
    backgroundColor: '#0b2419',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  resetButtonText: {
    color: '#04e1b2',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#0b2419',
    fontSize: 16,
    fontWeight: '700',
  },
  noMarkers: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(5, 15, 8, 0.9)',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    zIndex: 4,
  },
  noMarkersText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  noMarkersSubtext: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  centerButton: {
    position: 'absolute',
    right: 20,
    bottom: 45,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a3b30',
    borderWidth: 2,
    borderColor: '#04e1b2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  centerButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  selectedCard: {
    position: 'absolute',
    left: 20,
    right: 80,
    bottom: 45,
  },
  clubCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  featuredClubCard: {
    borderWidth: 4,
    borderColor: '#04e1b2',
  },
  clubCardGradient: {
    padding: 12,
  },
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  clubName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0b2419',
    flex: 1,
    marginRight: 8,
  },
  clubHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  tagsRowContainer: {
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  featuredTag: {
    backgroundColor: '#ffd700',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featuredText: {
    color: '#0b2419',
    fontSize: 10,
    fontWeight: '700',
  },
  partnerTag: {
    backgroundColor: '#04e1b2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  partnerText: {
    color: '#0b2419',
    fontSize: 10,
    fontWeight: '700',
  },
  sportTag: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sportText: {
    color: '#0b2419',
    fontSize: 12,
    fontWeight: '700',
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 32,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    fontSize: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  infoEmoji: {
    fontSize: 14,
    color: '#1a3b30',
    marginRight: 8,
    width: 20,
  },
  infoText: {
    fontSize: 12,
    color: '#1a3b30',
    lineHeight: 16,
    flex: 1,
  },
  infoTextEmphasis: {
    fontWeight: '700',
  },
  lidWordenButtonContainer: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lidWordenButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  lidWordenText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050f08',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 15,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050f08',
    padding: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#04e1b2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#0b2419',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a3b30',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(4, 225, 178, 0.2)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalCloseButton: {
    fontSize: 28,
    color: '#04e1b2',
    fontWeight: '300',
  },
  modalContent: {
    maxHeight: 400,
  },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(4, 225, 178, 0.1)',
  },
  modalItemSpecial: {
    backgroundColor: 'rgba(4, 225, 178, 0.15)',
  },
  modalItemText: {
    fontSize: 16,
    color: '#ffffff',
  },
  modalItemTextSelected: {
    color: '#04e1b2',
    fontWeight: '600',
  },
  modalItemTextSpecial: {
    fontSize: 16,
    color: '#04e1b2',
    fontWeight: '600',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 225, 178, 0.2)',
  },
  modalApplyButton: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  modalApplyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0b2419',
  },
  modalSectionLabel: {
    color: '#04e1b2',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  modalSectionLabelCompact: {
    marginBottom: 2,
  },
  costStructureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  costStructureButton: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 225, 178, 0.35)',
  },
  costStructureButtonActive: {
    backgroundColor: '#04e1b2',
    borderColor: '#04e1b2',
  },
  costStructureButtonText: {
    color: '#04e1b2',
    fontSize: 12,
    fontWeight: '700',
  },
  costStructureButtonTextActive: {
    color: '#0b2419',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 225, 178, 0.15)',
    borderRadius: 12,
    padding: 15,
    gap: 12,
  },
  rangeInputContainer: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 12,
    color: '#04e1b2',
    marginBottom: 5,
    fontWeight: '600',
  },
  rangeInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0b2419',
  },
  rangeSeparator: {
    color: '#04e1b2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  rangeFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  rangeResetButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#1a3b30',
    borderWidth: 1,
    borderColor: 'rgba(4, 225, 178, 0.35)',
  },
  rangeResetButtonText: {
    color: '#04e1b2',
    fontSize: 12,
    fontWeight: '600',
  },
  modalFooterCompact: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(4, 225, 178, 0.2)',
  },
});
