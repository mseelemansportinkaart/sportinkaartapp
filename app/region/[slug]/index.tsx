import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SuggestionForm } from '@/components/SuggestionForm';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useFilters } from '@/contexts/FiltersContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/lib/supabase';
import { getSportEmoji } from '@/utils/sportEmoji';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

// Type definitions
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
  sport: string; // Always set - defaults to 'Diverse sporten'/'Various sports' if not available
  sports: string[]; // Array of all sports
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
}

interface Facility {
  id: string;
  name: string;
  category: string;
}

// Custom marker images (smaller sizes to avoid oversized pins on device)

// Helper function to convert UUID to numeric ID for favorites - OUTSIDE component for stable reference
const getNumericId = (uuidString: string | undefined | null): number => {
  // Convert to string and check for empty/invalid values
  const str = String(uuidString || '');
  if (!str || str === 'undefined' || str === 'null' || str.length === 0) {
    return 0;
  }

  // Create a consistent numeric ID from UUID string using a simple hash
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

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

const getDistanceKm = (
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(destination.latitude - origin.latitude);
  const dLng = toRad(destination.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(destination.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};


export default function LocationScreen() {
  const { t, language } = useLanguage();
  const params = useLocalSearchParams();
  const regionSlug = params.slug as string; // Get slug from route parameter
  const { toggleFavorite, favorites } = useFavorites();
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
  
  console.log('LocationScreen loaded with params:', params);
  console.log('Extracted regionSlug:', regionSlug);

  useEffect(() => {
    if (regionSlug) {
      setRegionSlug(regionSlug);
    }
  }, [regionSlug, setRegionSlug]);
  
  // State for data from Supabase
  const [region, setRegion] = useState<Region | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]); // Store all locations
  const [rawLocationsData, setRawLocationsData] = useState<any[]>([]); // Store raw data with both languages
  const [displayedLocations, setDisplayedLocations] = useState<Location[]>([]); // Paginated locations
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Filter states
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce search input
  const [showFilters, setShowFilters] = useState(false);
  const [distanceFilterKm, setDistanceFilterKm] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const permissionRequestedRef = useRef(false);

  // Modal states
  const [activeFilterModal, setActiveFilterModal] = useState<'sport' | 'faciliteiten' | 'kosten' | null>(null);
  const [tempSelectedSports, setTempSelectedSports] = useState<string[]>([]);
  const [tempSelectedFaciliteiten, setTempSelectedFaciliteiten] = useState<string[]>([]);
  const [tempMinKosten, setTempMinKosten] = useState('');
  const [tempMaxKosten, setTempMaxKosten] = useState('');
  const [tempCostStructure, setTempCostStructure] = useState<'monthly' | 'yearly' | 'lesson' | null>(null);
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);

  // Helper function to capitalize text (first letter of each word)
  const capitalizeText = (text: string): string => {
    return text.trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Memoize unique sports from all locations - extract from ONLY current language
  const availableSports = useMemo(() => {
    const sportsMap = new Map<string, string>();

    rawLocationsData.forEach((location: any) => {
      // Get sports from the current language ONLY
      const currentLangSports = language === 'nl' ? location.sport_nl : location.sport_en;

      // Helper to process sports (could be string or array)
      const processSports = (sports: string | string[]) => {
        const sportsArray = Array.isArray(sports) ? sports : [sports];
        sportsArray.forEach(sport => {
          if (sport && sport.trim() !== '') {
            const normalized = sport.toLowerCase();
            // Store normalized key with capitalized display value
            if (!sportsMap.has(normalized)) {
              sportsMap.set(normalized, capitalizeText(sport));
            }
          }
        });
      };

      // Process current language sports only
      if (currentLangSports) processSports(currentLangSports);
    });

    // Sort by the capitalized display values with proper locale
    return Array.from(sportsMap.values()).sort((a, b) =>
      a.localeCompare(b, language === 'nl' ? 'nl' : 'en', { sensitivity: 'base' })
    );
  }, [rawLocationsData, language]);

  const activeFilterCount =
    selectedSports.length +
    selectedFaciliteiten.length +
    (kostenFilterActive ? 1 : 0) +
    (distanceFilterKm ? 1 : 0);

  const distanceOptions = [2, 5, 10, 25];
  const costStructureOptions: { key: 'monthly' | 'yearly' | 'lesson'; label: string }[] = [
    { key: 'monthly', label: labelFromCostTemplate(t('region.costFromMonthly')) },
    { key: 'yearly', label: labelFromCostTemplate(t('region.costFromYearly')) },
    { key: 'lesson', label: labelFromCostTemplate(t('region.costFromLesson')) },
  ];

  // Memoize filtered locations with debounced search
  const filteredLocations = useMemo(() => {
    let filtered = allLocations;

    if (debouncedSearchQuery !== '') {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((location: Location) =>
        location.naam.toLowerCase().includes(query) ||
        // Search in the actual sports array, not just the display label
        location.sports.some(sport => sport.toLowerCase().includes(query))
      );
    }

    if (selectedSports.length > 0) {
      // Normalize selected sports to lowercase for case-insensitive comparison
      const normalizedSelectedSports = selectedSports.map(s => s.toLowerCase());
      filtered = filtered.filter((location: Location) =>
        // Check if any sport in the location's sports array matches the selected sports (case-insensitive)
        location.sports.some(sport => normalizedSelectedSports.includes(sport.toLowerCase()))
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
        // Always include locations with "Unknown" or "Niet bekend" facilities
        const hasUnknownFacilities = location.faciliteitenLijst.includes('Unknown') ||
                                      location.faciliteitenLijst.includes('Niet bekend');

        if (hasUnknownFacilities) return true;

        // Otherwise, check if location has any of the selected facilities (case-insensitive)
        return selectedFaciliteiten.some(selectedFaciliteit =>
          location.faciliteitenLijst && location.faciliteitenLijst.some(
            facility => facility.toLowerCase() === selectedFaciliteit.toLowerCase()
          )
        );
      });
    }

    if (distanceFilterKm && userLocation) {
      filtered = filtered.filter((location: Location) => {
        if (!hasValidCoordinates(location)) return false;
        const distance = getDistanceKm(userLocation, {
          latitude: location.latitude,
          longitude: location.longitude,
        });
        return distance <= distanceFilterKm;
      });
    }

    // Sort filtered results: Featured first (alphabetically), then Partner (alphabetically), then others (alphabetically)
    return filtered.sort((a, b) => {
      // First, sort by featured status
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;

      // If both have same featured status, sort by partner status
      if (a.is_featured === b.is_featured) {
        if (a.is_partner && !b.is_partner) return -1;
        if (!a.is_partner && b.is_partner) return 1;
      }

      // If both have same featured and partner status, sort alphabetically by name
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
    distanceFilterKm,
    userLocation,
  ]);


  // Helper function to convert Location to Club format
  const locationToClub = (location: Location) => ({
    id: getNumericId(location.id),
    naam: location.naam,
    sport: location.sport,
    stadsdeel: location.stadsdeel,
    adres: location.adres,
    doelgroepen: '', // Empty string for compatibility
    website: location.website,
    email: location.email,
    kosten: location.kosten,
    faciliteiten: location.faciliteiten,
    faciliteitenLijst: location.faciliteitenLijst,
    lidWordenMogelijk: location.lidWordenMogelijk,
    is_featured: location.is_featured,
    is_partner: location.is_partner
  });

  // Fetch data from Supabase
  useEffect(() => {
    console.log('useEffect triggered with regionSlug:', regionSlug);
    if (regionSlug) {
      fetchRegionDataProgressive();
    } else {
      console.log('No regionSlug provided');
      setError('Geen regio geselecteerd');
      setLoading(false);
    }
  }, [regionSlug, language]);

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

  // Helper function to transform raw location data to Location type
  const transformLocationData = (location: any, regionName: string): Location => {
    const sportValue = language === 'nl' ? location.sport_nl : location.sport_en;

    let sportsArray: string[] = [];
    if (Array.isArray(sportValue)) {
      sportsArray = sportValue.filter((s: string) => s && s.trim() !== '');
    } else if (sportValue && typeof sportValue === 'string' && sportValue.trim() !== '') {
      sportsArray = [sportValue];
    }

    const sport = sportsArray.length > 1
      ? (language === 'nl' ? 'Diverse sporten' : 'Various sports')
      : sportsArray.length === 1
      ? sportsArray[0]
      : (language === 'nl' ? 'Diverse sporten' : 'Various sports');

    const description = language === 'nl' ? (location.description_nl || '') : (location.description_en || '');
    const facilitiesData = language === 'nl' ? (location.facilities_nl || []) : (location.facilities_en || []);

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
      longitude: toFiniteNumber(location.longitude)
    };
  };

  // Sort locations: Featured first, then Partner, then alphabetically
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

  // Progressive loading: load first batch quickly, then load rest in background
  const fetchRegionDataProgressive = async () => {
    console.log('=== STARTING fetchRegionDataProgressive ===');

    try {
      setLoading(true);
      setError(null);

      // Step 1: Fetch region data first
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

      // Step 2: Fetch ONLY first batch of locations (featured/partner first, limited)
      // Use ordering to get featured and partner locations first
      const { data: initialData, error: initialError } = await supabase
        .from(locationTableName)
        .select(`
          id, name, sport_nl, sport_en, description_nl, description_en,
          facilities_nl, facilities_en, address, website, email,
          cost_range, cost_structure, membership_available, is_featured, is_partner,
          main_image_url, phone, is_active, latitude, longitude
        `)
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('is_partner', { ascending: false })
        .order('name', { ascending: true })
        .limit(ITEMS_PER_PAGE);

      if (initialError) throw initialError;

      // Transform and display first batch immediately
      const initialLocations = (initialData || []).map((loc: any) =>
        transformLocationData(loc, regionData.region_name)
      );
      const sortedInitial = sortLocations(initialLocations);

      setAllLocations(sortedInitial);
      setDisplayedLocations(sortedInitial);
      setRawLocationsData(initialData || []);
      setCurrentPage(1);

      // IMPORTANT: Stop loading here - show the page with first batch
      setLoading(false);
      console.log('=== FIRST BATCH LOADED, PAGE NOW VISIBLE ===');

      // Step 3: Load remaining locations in background
      const { data: remainingData, error: remainingError } = await supabase
        .from(locationTableName)
        .select(`
          id, name, sport_nl, sport_en, description_nl, description_en,
          facilities_nl, facilities_en, address, website, email,
          cost_range, cost_structure, membership_available, is_featured, is_partner,
          main_image_url, phone, is_active, latitude, longitude
        `)
        .eq('is_active', true)
        .order('is_featured', { ascending: false })
        .order('is_partner', { ascending: false })
        .order('name', { ascending: true })
        .range(ITEMS_PER_PAGE, 9999); // Get everything after first batch

      if (remainingError) {
        console.error('Error loading remaining locations:', remainingError);
        return; // Don't throw - we already have initial data displayed
      }

      // Combine all data
      const allRawData = [...(initialData || []), ...(remainingData || [])];
      const allTransformed = allRawData.map((loc: any) =>
        transformLocationData(loc, regionData.region_name)
      );
      const sortedAll = sortLocations(allTransformed);

      // Update state with full data
      setRawLocationsData(allRawData);
      setAllLocations(sortedAll);
      // Keep displayed locations as first page - user can scroll to load more

      // Extract facilities for filters
      const facilitiesMap = new Map<string, string>();
      allRawData.forEach((location: any) => {
        const currentLangFacilities = language === 'nl'
          ? (location.facilities_nl || [])
          : (location.facilities_en || []);
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
        .map(name => ({ id: name, name: name, category: 'Faciliteit' }));

      setFacilities(uniqueFacilities);
      console.log('=== ALL DATA LOADED IN BACKGROUND ===');

    } catch (err) {
      console.error('Error in fetchRegionDataProgressive:', err);
      const errorMessage = err instanceof Error ? err.message : 'Er is een fout opgetreden';
      setError(errorMessage);
      setLoading(false);
    }
  };

  // Filter functions (memoized with useCallback)
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  // Modal helper functions
  const openFilterModal = useCallback((filterType: 'sport' | 'faciliteiten' | 'kosten') => {
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
  }, [selectedSports, selectedFaciliteiten, minKosten, maxKosten, selectedCostStructure]);

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

  const resetAllFilters = useCallback(() => {
    resetSharedFilters();
    setDistanceFilterKm(null);
  }, [resetSharedFilters]);

  const handleDistanceSelect = useCallback(async (km: number | null) => {
    if (km === null) {
      setDistanceFilterKm(null);
      return;
    }

    try {
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status === 'granted') {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        });
        setDistanceFilterKm(km);
        return;
      }

      // If permission was previously denied, guide to Settings
      if (permissionRequestedRef.current && existing.status === 'denied') {
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

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      setDistanceFilterKm(km);
    } catch (err) {
      console.warn('Failed to request location:', err);
    }
  }, [t]);

  const handleLocationPress = useCallback((location: Location) => {
    console.log(`Clicked on ${location.naam}`);
    // You can navigate to location detail page here
    // router.push(`/location/${location.id}`);
  }, []);

  const handleMoreInfo = useCallback(async (location: Location) => {
    if (location.website) {
      try {
        const url = location.website.startsWith('http')
          ? location.website
          : `https://${location.website}`;

        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          console.log('Cannot open URL:', url);
        }
      } catch (error) {
        console.error('Error opening website:', error);
      }
    } else {
      console.log('No website available for', location.naam);
    }
  }, []);

  const handleFavoriteToggle = useCallback(async (location: Location, event: any) => {
    event.stopPropagation();

    try {
      const club = locationToClub(location);
      await toggleFavorite(club);
    } catch (error) {
      Alert.alert('Fout', 'Er ging iets mis bij het opslaan van je favoriet');
    }
  }, [toggleFavorite]);

  const handleContactPress = useCallback(() => {
    setShowSuggestionForm(true);
  }, []);

  // Load more items when scrolling
  const loadMore = useCallback(() => {
    if (loadingMore || displayedLocations.length >= allLocations.length) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;
    const startIndex = currentPage * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const newItems = allLocations.slice(startIndex, endIndex);

    // Add new items to displayed locations
    setDisplayedLocations(prev => [...prev, ...newItems]);
    setCurrentPage(nextPage);
    setLoadingMore(false);
  }, [loadingMore, displayedLocations.length, allLocations, currentPage, ITEMS_PER_PAGE]);

  // Render item for FlashList (memoized)
  const renderLocationItem = useCallback(({ item: location }: { item: Location }) => {
    const numericId = getNumericId(location.id);
    const isLocationFavorite = favorites.includes(numericId);

    return (
      <TouchableOpacity
        style={[
          styles.clubCard,
          location.is_featured && styles.featuredClubCard
        ]}
        onPress={() => handleLocationPress(location)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#ffffff', '#f8f9fa']}
          style={styles.clubCardGradient}
        >
          <View style={styles.clubHeader}>
            <Text style={styles.clubName}>{location.naam}</Text>
            <View style={styles.clubHeaderRight}>
              <View style={styles.sportTag}>
                <Text style={styles.sportText}>{location.sport}</Text>
              </View>
              <TouchableOpacity
                style={styles.favoriteButton}
                onPress={(event) => handleFavoriteToggle(location, event)}
              >
                <Text style={[
                  styles.favoriteIcon,
                  { color: isLocationFavorite ? '#04e1b2' : '#999' }
                ]}>
                  {isLocationFavorite ? '♥' : '♡'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {(location.is_featured || location.is_partner) && (
          <View style={styles.tagsRowContainer}>
            <View style={styles.tagsRow}>
              {location.is_featured && (
                <View style={styles.featuredTag}>
                  <Text style={styles.featuredText}>⭐ {t('region.featured')}</Text>
                </View>
              )}
              {location.is_partner && (
                <View style={styles.partnerTag}>
                  <Text style={styles.partnerText}>🤝 {t('region.partner')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {location.sports.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>{getSportEmoji(location.sports, location.sport)}</Text>
            <Text style={styles.infoText}>{location.sports.map(capitalizeText).join(', ')}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>📍</Text>
          <Text style={styles.infoText}>{location.adres}</Text>
        </View>
        {location.kosten !== '' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>💰</Text>
            {(() => {
              const parts = splitCostLabel(location.kosten);
              if (!parts) {
                return <Text style={styles.infoText}>{location.kosten}</Text>;
              }
              return (
                <Text style={styles.infoText}>
                  {parts.prefix} <Text style={styles.infoTextEmphasis}>{parts.timeframe}</Text>
                </Text>
              );
            })()}
          </View>
        )}
        {(() => {
          const validFacilities = location.faciliteitenLijst.filter(
            (f) => f && f.toLowerCase() !== 'unknown' && f.toLowerCase() !== 'niet bekend'
          );
          return validFacilities.length > 0 ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoEmoji}>🏛️</Text>
              <Text style={styles.infoText}>{validFacilities.map(capitalizeText).join(', ')}</Text>
            </View>
          ) : null;
        })()}

        {location.lidWordenMogelijk && location.website && (
          <TouchableOpacity
            style={styles.lidWordenButtonContainer}
            onPress={(event) => {
              event.stopPropagation();
              handleMoreInfo(location);
            }}
          >
            <LinearGradient
              colors={['#04e1b2', '#1a3b30']}
              style={styles.lidWordenButton}
            >
              <Text style={styles.lidWordenText}>{t('region.moreInfo')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </TouchableOpacity>
    );
  }, [handleLocationPress, handleFavoriteToggle, handleMoreInfo, favorites, t]);

  // Key extractor for FlashList
  const keyExtractor = useCallback((item: Location) => item.id, []);

  // Loading state with back button
  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        {/* Header with back button during loading */}
        <View style={styles.loadingHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('region.back')}</Text>
          </TouchableOpacity>
        </View>

        {/* Loading content */}
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#04e1b2" />
          <Text style={styles.loadingText}>{t('region.loading')}</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        {/* Header with back button during error */}
        <View style={styles.errorHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('region.back')}</Text>
          </TouchableOpacity>
        </View>

        {/* Error content */}
        <View style={styles.errorContent}>
          <Text style={styles.errorText}>{t('region.error')}</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchRegionDataProgressive}>
            <Text style={styles.retryButtonText}>{t('home.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>← {t('region.back')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>{t('region.locations')} {region?.region_name}</Text>
          <Text style={styles.subtitle}>
            {filteredLocations.length} {t('region.locationsFound')}
          </Text>
        </View>

        <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder={t('region.search')}
              placeholderTextColor="#1a3b30"
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>

          {/* Filter Toggle Button */}
          <View style={styles.filterToggleContainer}>
            <View style={styles.filterToggleRow}>
              <TouchableOpacity
                style={[
                  styles.filterToggleButton,
                  showFilters && styles.filterToggleButtonActive,
                ]}
                onPress={() => setShowFilters(!showFilters)}
              >
                <Text
                  style={[
                    styles.filterToggleText,
                    showFilters && styles.filterToggleTextActive,
                  ]}
                >
                  {showFilters ? t('region.hideFilters') : t('region.filters')}
                </Text>
                {activeFilterCount > 0 && (
                  <View
                    style={[
                      styles.filterBadge,
                      showFilters && styles.filterBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        showFilters && styles.filterBadgeTextActive,
                      ]}
                    >
                      {activeFilterCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.mapToggleButton}
                onPress={() => router.push(`/region/${regionSlug}/map` as any)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#0b2419', '#1a3b30']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.mapToggleGradient}
                >
                  <Text style={styles.mapToggleIcon}>🗺️</Text>
                  <Text style={styles.mapToggleText}>{t('home.map')}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Filters */}
          {showFilters && (
            <View style={styles.filtersContainer}>
              <View style={styles.filtersGrid}>
                {/* Sport Filter */}
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('region.sport')}:</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => openFilterModal('sport')}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {selectedSports.length === 0 ? t('filter.allSports') : `${selectedSports.length} ${t('filter.selected')}`}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Faciliteiten Filter */}
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('region.facilities')}:</Text>
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => openFilterModal('faciliteiten')}
                  >
                    <Text style={styles.dropdownButtonText}>
                      {selectedFaciliteiten.length === 0 ? t('filter.allFacilities') : `${selectedFaciliteiten.length} ${t('filter.selected')}`}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Kosten */}
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('filter.costStructure')}:</Text>
                  <TouchableOpacity
                    style={[styles.kostenToggle, kostenFilterActive && styles.kostenToggleActive]}
                    onPress={() => openFilterModal('kosten')}
                  >
                    <Text style={[styles.kostenToggleText, kostenFilterActive && styles.kostenToggleTextActive]}>
                      {kostenFilterActive ? t('filter.active') : t('filter.select')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Afstand */}
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('filter.distance')}:</Text>
                  <View style={styles.distanceRow}>
                    <TouchableOpacity
                      style={[
                        styles.distanceButton,
                        distanceFilterKm === null && styles.distanceButtonActive,
                      ]}
                      onPress={() => handleDistanceSelect(null)}
                    >
                      <Text
                        style={[
                          styles.distanceButtonText,
                          distanceFilterKm === null && styles.distanceButtonTextActive,
                        ]}
                      >
                        {t('filter.allDistances')}
                      </Text>
                    </TouchableOpacity>
                    {distanceOptions.map((km) => (
                      <TouchableOpacity
                        key={km}
                        style={[
                          styles.distanceButton,
                          distanceFilterKm === km && styles.distanceButtonActive,
                        ]}
                        onPress={() => handleDistanceSelect(km)}
                      >
                        <Text
                          style={[
                            styles.distanceButtonText,
                            distanceFilterKm === km && styles.distanceButtonTextActive,
                          ]}
                        >
                          {km} km
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              {/* Reset Button */}
              {(selectedSports.length > 0 || kostenFilterActive || selectedFaciliteiten.length > 0 || searchQuery !== '') && (
                <View style={styles.resetButtonContainer}>
                  <TouchableOpacity style={styles.resetButton} onPress={resetAllFilters}>
                    <Text style={styles.resetButtonText}>{t('filter.resetAll')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Locations List with FlashList */}
          <View style={styles.clubsContainer}>
            {filteredLocations.length > 0 ? (
              <FlashList
                data={filteredLocations}
                renderItem={renderLocationItem}
                keyExtractor={keyExtractor}
                extraData={favorites}
                showsVerticalScrollIndicator={false}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loadingMore ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#04e1b2" />
                    </View>
                  ) : null
                }
              />
            ) : !loading && (
              <View style={styles.noResultsContainer}>
                <Text style={styles.noResultsText}>{t('region.noLocations')}</Text>
                <Text style={styles.noResultsSubtext}>{t('region.noLocationsSubtext')}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t('footer.missingLocation')}
            </Text>

            <View style={styles.buttonRow}>
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
          </View>
        </ScrollView>
      </View>

      <SuggestionForm
        visible={showSuggestionForm}
        onClose={() => setShowSuggestionForm(false)}
      />

      {/* Filter Modals - Positioned outside main container for proper overlay */}
      {/* Sport Modal */}
      <Modal
        visible={activeFilterModal === 'sport'}
        animationType="slide"
        transparent={true}
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
                style={[styles.modalItem, tempSelectedSports.length === 0 && styles.modalItemSpecial]}
                onPress={() => setTempSelectedSports([])}
              >
                <Text style={tempSelectedSports.length === 0 ? styles.modalItemTextSpecial : styles.modalItemText}>
                  {tempSelectedSports.length === 0 ? '✓ ' : ''}{t('filter.allSports')}
                </Text>
              </TouchableOpacity>
              {availableSports.map((sport) => (
                <TouchableOpacity
                  key={sport}
                  style={styles.modalItem}
                  onPress={() => {
                    if (tempSelectedSports.includes(sport)) {
                      setTempSelectedSports(tempSelectedSports.filter(s => s !== sport));
                    } else {
                      setTempSelectedSports([...tempSelectedSports, sport]);
                    }
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    tempSelectedSports.includes(sport) && styles.modalItemTextSelected
                  ]}>
                    {tempSelectedSports.includes(sport) ? '✓ ' : ''}{sport}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalFooterCompact}>
              <TouchableOpacity style={styles.modalApplyButton} onPress={applyFilterModal}>
                <Text style={styles.modalApplyButtonText}>{t('filter.apply')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Faciliteiten Modal */}
      <Modal
        visible={activeFilterModal === 'faciliteiten'}
        animationType="slide"
        transparent={true}
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
                style={[styles.modalItem, tempSelectedFaciliteiten.length === 0 && styles.modalItemSpecial]}
                onPress={() => setTempSelectedFaciliteiten([])}
              >
                <Text style={tempSelectedFaciliteiten.length === 0 ? styles.modalItemTextSpecial : styles.modalItemText}>
                  {tempSelectedFaciliteiten.length === 0 ? '✓ ' : ''}{t('filter.allFacilities')}
                </Text>
              </TouchableOpacity>
              {facilities.map((facility) => (
                <TouchableOpacity
                  key={facility.id}
                  style={styles.modalItem}
                  onPress={() => {
                    if (tempSelectedFaciliteiten.includes(facility.name)) {
                      setTempSelectedFaciliteiten(tempSelectedFaciliteiten.filter(f => f !== facility.name));
                    } else {
                      setTempSelectedFaciliteiten([...tempSelectedFaciliteiten, facility.name]);
                    }
                  }}
                >
                  <Text style={[
                    styles.modalItemText,
                    tempSelectedFaciliteiten.includes(facility.name) && styles.modalItemTextSelected
                  ]}>
                    {tempSelectedFaciliteiten.includes(facility.name) ? '✓ ' : ''}{facility.name}
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

      {/* Kosten Modal */}
      <Modal
        visible={activeFilterModal === 'kosten'}
        animationType="slide"
        transparent={true}
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
                        value={tempMinKosten}
                        onChangeText={setTempMinKosten}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                      />
                    </View>
                    <Text style={styles.rangeSeparator}>-</Text>
                    <View style={styles.rangeInputContainer}>
                      <Text style={styles.rangeLabel}>Max €</Text>
                      <TextInput
                        style={styles.rangeInput}
                        value={tempMaxKosten}
                        onChangeText={setTempMaxKosten}
                        placeholder="999"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
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
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050f08',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Loading screen styles
  loadingHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    marginTop: 15,
  },
  loadingSubtext: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 8,
    opacity: 0.7,
  },
  
  // Error screen styles
  errorHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  errorContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
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
  
  // Header
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#050f08',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  mapToggleButton: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(4, 225, 178, 0.35)',
    height: 40,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
    flex: 1,
  },
  mapToggleGradient: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mapToggleIcon: {
    fontSize: 15,
    color: '#ffffff',
  },
  mapToggleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 4,
  },
  backText: {
    fontSize: 16,
    color: '#04e1b2',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
  },
  
  // Content
  contentScroll: {
    flex: 1,
  },

  
  // Search
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  searchInput: {
    height: 50,
    backgroundColor: '#04e1b2',
    borderRadius: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#0b2419',
    fontWeight: '500',
  },

  // Filter Toggle
  filterToggleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  filterToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterToggleButton: {
    backgroundColor: '#1a3b30',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(4, 225, 178, 0.35)',
    height: 40,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: 1,
  },
  filterToggleButtonActive: {
    backgroundColor: '#04e1b2',
    borderColor: '#04e1b2',
  },
  filterToggleText: {
    fontSize: 12,
    color: '#04e1b2',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  filterToggleTextActive: {
    color: '#0b2419',
  },
  filterBadge: {
    backgroundColor: '#0b2419',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    fontSize: 11,
    color: '#04e1b2',
    fontWeight: '700',
  },
  filterBadgeActive: {
    backgroundColor: '#04e1b2',
  },
  filterBadgeTextActive: {
    color: '#0b2419',
  },
  distanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  distanceButton: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(4, 225, 178, 0.35)',
  },
  distanceButtonActive: {
    backgroundColor: '#04e1b2',
    borderColor: '#04e1b2',
  },
  distanceButtonText: {
    fontSize: 12,
    color: '#04e1b2',
    fontWeight: '600',
  },
  distanceButtonTextActive: {
    color: '#0b2419',
  },

  // Filters
  filtersContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  filtersGrid: {
    gap: 15,
  },
  filterRow: {
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 14,
    color: '#04e1b2',
    fontWeight: '600',
    marginBottom: 8,
  },
  dropdownButton: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#ffffff',
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 14,
    color: '#04e1b2',
    fontWeight: 'bold',
  },
  dropdownMenu: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    marginTop: 10,
    marginBottom: 10,
    overflow: 'hidden',
    maxHeight: 200,
  },
  dropdownScrollView: {
    flexGrow: 0,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(4, 225, 178, 0.2)',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#ffffff',
  },
  dropdownItemTextSelected: {
    color: '#04e1b2',
    fontWeight: 'bold',
  },
  dropdownItemSpecial: {
    backgroundColor: 'rgba(4, 225, 178, 0.1)',
  },
  dropdownItemTextSpecial: {
    fontSize: 14,
    color: '#04e1b2',
    fontWeight: 'bold',
  },
  kostenToggle: {
    backgroundColor: '#1a3b30',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  kostenToggleActive: {
    backgroundColor: '#04e1b2',
  },
  kostenToggleText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  kostenToggleTextActive: {
    color: '#0b2419',
  },
  rangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 225, 178, 0.15)',
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
    gap: 15,
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
  rangeHelperText: {
    color: '#ffffff',
    fontSize: 12,
    opacity: 0.7,
    marginTop: 8,
    textAlign: 'center',
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
  rangeSeparator: {
    color: '#04e1b2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resetButtonContainer: {
    alignItems: 'center',
    marginTop: 15,
  },
  resetButton: {
    backgroundColor: '#0b2419',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 25,
  },
  resetButtonText: {
    color: '#04e1b2',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Clubs
  clubsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 5,
    minHeight: 300, // Minimum height for FlashList to work properly
  },
  clubCard: {
    marginBottom: 15,
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
    padding: 20,
  },
  clubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 10,
  },
  clubName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b2419',
    flex: 1,
    marginRight: 10,
  },
  clubHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  tagsRowContainer: {
    marginBottom: 12,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sportText: {
    color: '#0b2419',
    fontSize: 14,
    fontWeight: '700',
  },
  favoriteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteIcon: {
    fontSize: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  infoEmoji: {
    fontSize: 14,
    color: '#1a3b30',
    marginRight: 8,
    width: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#1a3b30',
    lineHeight: 20,
    flex: 1,
  },
  infoTextEmphasis: {
    fontWeight: '700',
  },
  lidWordenButtonContainer: {
    marginTop: 15,
    borderRadius: 12,
    overflow: 'hidden',
  },
  lidWordenButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  lidWordenText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  
  // No results
  noResultsContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.7,
    textAlign: 'center',
  },

  // Footer
  footer: {
    paddingVertical: 30,
    paddingHorizontal: 25,
    alignItems: 'center',
    backgroundColor: '#050f08',
    marginTop: 20,
  },
  footerText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    width: '100%',
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
    paddingHorizontal: 14,
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
    paddingHorizontal: 14,
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

  // Modal Styles
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
  modalFooterCompact: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 20,
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
});
