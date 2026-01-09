import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Type definitions
export interface Region {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  created_at: string;
  updated_at: string;
}

export interface RawLocation {
  id: string;
  name: string;
  sport_nl: string | string[];
  sport_en: string | string[];
  description_nl: string;
  description_en: string;
  facilities_nl: string[];
  facilities_en: string[];
  address: string;
  website: string;
  email: string;
  cost_range: string;
  membership_available: boolean;
  is_featured: boolean;
  is_partner: boolean;
  main_image_url?: string;
  phone?: string;
  is_active: boolean;
}

export interface Location {
  id: string;
  naam: string;
  sport: string;
  sports: string[];
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
  // Store both language versions
  description_nl: string;
  description_en: string;
  facilities_nl: string[];
  facilities_en: string[];
  sport_nl: string;
  sport_en: string;
  sports_nl: string[];
  sports_en: string[];
}

// Fetch region by slug
async function fetchRegion(slug: string): Promise<Region> {
  const { data, error } = await supabase
    .from('regions')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('is_concept', false)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Region not found');

  return data;
}

// Fetch locations with ALL language columns at once
async function fetchLocations(regionName: string): Promise<RawLocation[]> {
  const locationTableName = regionName.toLowerCase();

  const { data, error } = await supabase
    .from(locationTableName)
    .select(`
      id,
      name,
      sport_nl,
      sport_en,
      description_nl,
      description_en,
      facilities_nl,
      facilities_en,
      address,
      website,
      email,
      cost_range,
      membership_available,
      is_featured,
      is_partner,
      main_image_url,
      phone,
      is_active
    `)
    .eq('is_active', true)
    .order('is_featured', { ascending: false })
    .order('name');

  if (error) throw error;

  return data || [];
}

// Transform raw location data to Location format for a specific language
export function transformLocationForLanguage(
  rawLocation: RawLocation,
  language: 'nl' | 'en',
  regionName: string
): Location {
  // Get the language-specific sport value
  const sportValue = language === 'nl' ? rawLocation.sport_nl : rawLocation.sport_en;

  // Handle sports array - could be an array or a string
  let sportsArray: string[] = [];
  if (Array.isArray(sportValue)) {
    sportsArray = sportValue.filter(s => s && s.trim() !== '');
  } else if (sportValue && typeof sportValue === 'string' && sportValue.trim() !== '') {
    sportsArray = [sportValue];
  }

  // Set sport to "Diverse sporten" if multiple sports, first sport if single, or default
  const sport = sportsArray.length > 1
    ? (language === 'nl' ? 'Diverse sporten' : 'Various sports')
    : sportsArray.length === 1
    ? sportsArray[0]
    : (language === 'nl' ? 'Diverse sporten' : 'Various sports');

  // Process both languages for sports
  const sportValueNl = rawLocation.sport_nl;
  const sportValueEn = rawLocation.sport_en;

  let sportsArrayNl: string[] = [];
  if (Array.isArray(sportValueNl)) {
    sportsArrayNl = sportValueNl.filter(s => s && s.trim() !== '');
  } else if (sportValueNl && typeof sportValueNl === 'string' && sportValueNl.trim() !== '') {
    sportsArrayNl = [sportValueNl];
  }

  let sportsArrayEn: string[] = [];
  if (Array.isArray(sportValueEn)) {
    sportsArrayEn = sportValueEn.filter(s => s && s.trim() !== '');
  } else if (sportValueEn && typeof sportValueEn === 'string' && sportValueEn.trim() !== '') {
    sportsArrayEn = [sportValueEn];
  }

  const sportNl = sportsArrayNl.length > 1
    ? 'Diverse sporten'
    : sportsArrayNl.length === 1
    ? sportsArrayNl[0]
    : 'Diverse sporten';

  const sportEn = sportsArrayEn.length > 1
    ? 'Various sports'
    : sportsArrayEn.length === 1
    ? sportsArrayEn[0]
    : 'Various sports';

  const description = language === 'nl' ? rawLocation.description_nl : rawLocation.description_en;
  const facilities = language === 'nl' ? rawLocation.facilities_nl : rawLocation.facilities_en;

  return {
    id: rawLocation.id,
    naam: rawLocation.name || 'Unknown',
    sport: sport,
    sports: sportsArray,
    stadsdeel: rawLocation.address ? rawLocation.address.split(',')[0] : regionName,
    adres: rawLocation.address || '',
    website: rawLocation.website || '',
    email: rawLocation.email || '',
    kosten: (rawLocation.cost_range && rawLocation.cost_range.toLowerCase() !== 'unknown')
      ? `€${rawLocation.cost_range}`
      : (language === 'nl' ? 'Prijs op aanvraag' : 'Price on request'),
    faciliteiten: description || '',
    faciliteitenLijst: facilities || [],
    lidWordenMogelijk: rawLocation.membership_available !== false,
    is_featured: rawLocation.is_featured || false,
    is_partner: rawLocation.is_partner || false,
    main_image_url: rawLocation.main_image_url,
    images: [],
    phone: rawLocation.phone,
    // Store all language versions
    description_nl: rawLocation.description_nl || '',
    description_en: rawLocation.description_en || '',
    facilities_nl: rawLocation.facilities_nl || [],
    facilities_en: rawLocation.facilities_en || [],
    sport_nl: sportNl,
    sport_en: sportEn,
    sports_nl: sportsArrayNl,
    sports_en: sportsArrayEn,
  };
}

// Custom hook to fetch region data with caching
export function useRegion(slug: string) {
  return useQuery({
    queryKey: ['region', slug],
    queryFn: () => fetchRegion(slug),
    enabled: !!slug,
  });
}

// Custom hook to fetch locations with caching
export function useLocations(regionName: string, language: 'nl' | 'en') {
  return useQuery({
    queryKey: ['locations', regionName],
    queryFn: () => fetchLocations(regionName),
    enabled: !!regionName,
    // Transform the data after fetching
    select: (rawLocations) =>
      rawLocations.map(loc => transformLocationForLanguage(loc, language, regionName)),
  });
}

// Combined hook that fetches both region and locations
export function useRegionData(slug: string, language: 'nl' | 'en') {
  const regionQuery = useRegion(slug);

  const locationsQuery = useLocations(
    regionQuery.data?.region_name || '',
    language
  );

  return {
    region: regionQuery.data,
    locations: locationsQuery.data || [],
    isLoading: regionQuery.isLoading || locationsQuery.isLoading,
    error: regionQuery.error || locationsQuery.error,
    refetch: () => {
      regionQuery.refetch();
      locationsQuery.refetch();
    },
  };
}
