import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SuggestionForm } from '@/components/SuggestionForm';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/lib/supabase';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  faciliteiten: string;
  faciliteitenLijst: string[];
  lidWordenMogelijk: boolean;
  is_featured: boolean;
  is_partner: boolean;
  main_image_url?: string;
  images: any[];
  phone?: string;
}

interface Facility {
  id: string;
  name: string;
  category: string;
}

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

export default function LocationScreen() {
  const { t, language } = useLanguage();
  const params = useLocalSearchParams();
  const regionSlug = params.slug as string; // Get slug from route parameter
  const { toggleFavorite, favorites } = useFavorites();
  
  console.log('LocationScreen loaded with params:', params);
  console.log('Extracted regionSlug:', regionSlug);
  
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
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // Debounce search input
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [kostenFilterActive, setKostenFilterActive] = useState(false);
  const [minKosten, setMinKosten] = useState('');
  const [maxKosten, setMaxKosten] = useState('');
  const [selectedFaciliteiten, setSelectedFaciliteiten] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [activeFilterModal, setActiveFilterModal] = useState<'sport' | 'faciliteiten' | 'kosten' | null>(null);
  const [tempSelectedSports, setTempSelectedSports] = useState<string[]>([]);
  const [tempSelectedFaciliteiten, setTempSelectedFaciliteiten] = useState<string[]>([]);
  const [tempMinKosten, setTempMinKosten] = useState('');
  const [tempMaxKosten, setTempMaxKosten] = useState('');
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
        // Extract numbers from cost string, handle cases where no numbers exist
        const kostenMatch = location.kosten.match(/\d+/g);
        if (!kostenMatch) return true; // If no numbers in cost, include in results

        const kostenNummer = parseInt(kostenMatch[0]);
        const min = minKosten ? parseInt(minKosten) : 0;
        const max = maxKosten ? parseInt(maxKosten) : 99999;
        return kostenNummer >= min && kostenNummer <= max;
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
  }, [allLocations, debouncedSearchQuery, selectedSports, kostenFilterActive, minKosten, maxKosten, selectedFaciliteiten]);

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
    lidWordenMogelijk: location.lidWordenMogelijk
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
      kosten: (location.cost_range && location.cost_range.toLowerCase() !== 'unknown')
        ? `€${location.cost_range}`
        : (language === 'nl' ? 'Prijs op aanvraag' : 'Price on request'),
      faciliteiten: description,
      faciliteitenLijst: facilitiesData,
      lidWordenMogelijk: location.membership_available !== false,
      is_featured: location.is_featured || false,
      is_partner: location.is_partner || false,
      main_image_url: location.main_image_url,
      images: [],
      phone: location.phone
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
          cost_range, membership_available, is_featured, is_partner,
          main_image_url, phone, is_active
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
          cost_range, membership_available, is_featured, is_partner,
          main_image_url, phone, is_active
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
    }
    setActiveFilterModal(filterType);
  }, [selectedSports, selectedFaciliteiten, minKosten, maxKosten]);

  const closeFilterModal = useCallback(() => {
    setActiveFilterModal(null);
  }, []);

  const applyFilterModal = useCallback(() => {
    if (activeFilterModal === 'sport') {
      setSelectedSports([...tempSelectedSports]);
    } else if (activeFilterModal === 'faciliteiten') {
      setSelectedFaciliteiten([...tempSelectedFaciliteiten]);
    } else if (activeFilterModal === 'kosten') {
      setMinKosten(tempMinKosten);
      setMaxKosten(tempMaxKosten);
      setKostenFilterActive(tempMinKosten !== '' || tempMaxKosten !== '');
    }
    setActiveFilterModal(null);
  }, [activeFilterModal, tempSelectedSports, tempSelectedFaciliteiten, tempMinKosten, tempMaxKosten]);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedSports([]);
    setKostenFilterActive(false);
    setMinKosten('');
    setMaxKosten('');
    setSelectedFaciliteiten([]);
  }, []);

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
        style={styles.clubCard}
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
                  <Text style={styles.featuredText}>⭐ Featured</Text>
                </View>
              )}
              {location.is_partner && (
                <View style={styles.partnerTag}>
                  <Text style={styles.partnerText}>🤝 Partner</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {location.sports.length > 0 && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>⚽</Text>
            <Text style={styles.infoText}>{location.sports.map(capitalizeText).join(', ')}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoEmoji}>📍</Text>
          <Text style={styles.infoText}>{location.adres}</Text>
        </View>
        {location.kosten !== 'Prijs op aanvraag' && location.kosten !== 'Price on request' && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>💰</Text>
            <Text style={styles.infoText}>{location.kosten}</Text>
          </View>
        )}
        {location.faciliteitenLijst.length > 0 &&
         !location.faciliteitenLijst.includes('Unknown') &&
         !location.faciliteitenLijst.includes('Niet bekend') && (
          <View style={styles.infoRow}>
            <Text style={styles.infoEmoji}>🏛️</Text>
            <Text style={styles.infoText}>{location.faciliteitenLijst.map(capitalizeText).join(', ')}</Text>
          </View>
        )}

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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← {t('region.back')}</Text>
          </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.filterToggleButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={styles.filterToggleText}>
                {showFilters ? `▲ ${t('region.hideFilters')}` : `▼ ${t('region.filters')}`}
              </Text>
              {(selectedSports.length > 0 || selectedFaciliteiten.length > 0 || kostenFilterActive) && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>
                    {selectedSports.length + selectedFaciliteiten.length + (kostenFilterActive ? 1 : 0)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
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

                {/* Kosten per jaar */}
                <View style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{t('region.costPerYear')}:</Text>
                  <TouchableOpacity
                    style={[styles.kostenToggle, kostenFilterActive && styles.kostenToggleActive]}
                    onPress={() => openFilterModal('kosten')}
                  >
                    <Text style={[styles.kostenToggleText, kostenFilterActive && styles.kostenToggleTextActive]}>
                      {kostenFilterActive ? 'Actief' : 'Selecteer'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reset Button */}
              {(selectedSports.length > 0 || kostenFilterActive || selectedFaciliteiten.length > 0 || searchQuery !== '') && (
                <View style={styles.resetButtonContainer}>
                  <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                    <Text style={styles.resetButtonText}>Reset alle filters</Text>
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
            <View style={styles.modalFooter}>
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
              <Text style={styles.modalTitle}>{t('region.costPerYear')}</Text>
              <TouchableOpacity onPress={closeFilterModal}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.modalContent, { padding: 20 }]}>
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
            </View>
            <View style={styles.modalFooter}>
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
  backButton: {
    marginBottom: 15,
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
  filterToggleButton: {
    backgroundColor: '#1a3b30',
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  filterToggleText: {
    fontSize: 16,
    color: '#04e1b2',
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: '#04e1b2',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  filterBadgeText: {
    fontSize: 12,
    color: '#0b2419',
    fontWeight: '700',
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
    backgroundColor: '#ff6b6b',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  partnerText: {
    color: '#ffffff',
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