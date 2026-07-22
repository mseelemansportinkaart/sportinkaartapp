import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../setup/test-utils';
import RegionIndexScreen from '@/app/region/[slug]/index';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({ slug: 'almere' }),
}));

type RegionRow = {
  id: string;
  region_name: string;
  slug: string;
  is_active: boolean;
  is_concept: boolean;
  created_at: string;
  updated_at: string;
};

type LocationRow = {
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
  main_image_url?: string | null;
  phone?: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
};

const mockRegion: RegionRow = {
  id: 'region-1',
  region_name: 'Almere',
  slug: 'almere',
  is_active: true,
  is_concept: false,
  created_at: '2024-01-01',
  updated_at: '2024-01-01',
};

const mockLocations: LocationRow[] = [
  {
    id: 'loc-1',
    name: 'Club One',
    sport_nl: 'Voetbal',
    sport_en: 'Football',
    description_nl: 'Test locatie',
    description_en: 'Test location',
    facilities_nl: ['Kleedkamers'],
    facilities_en: ['Changing rooms'],
    address: 'Sportlaan 1, Almere',
    website: 'https://example.com',
    email: 'info@example.com',
    cost_range: '100-200',
    membership_available: true,
    is_featured: false,
    is_partner: false,
    main_image_url: null,
    phone: null,
    is_active: true,
    latitude: 52.37,
    longitude: 4.9,
  },
];

const createRegionQuery = (data: RegionRow) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.single = jest.fn().mockResolvedValue({ data, error: null });

  return query;
};

const createLocationsQuery = (initialData: LocationRow[], remainingData: LocationRow[]) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.order = jest.fn(() => query);
  query.limit = jest.fn().mockResolvedValue({ data: initialData, error: null });
  query.range = jest.fn().mockResolvedValue({ data: remainingData, error: null });

  return query;
};

describe('RegionIndexScreen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(null);

    const mockFrom = supabase.from as jest.Mock;
    let locationCallCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'regions') {
        return createRegionQuery(mockRegion);
      }

      if (table === 'almere') {
        locationCallCount += 1;
        if (locationCallCount === 1) {
          return createLocationsQuery(mockLocations, []);
        }
        return createLocationsQuery([], []);
      }

      return createLocationsQuery([], []);
    });
  });

  it('renders region header, map button, and location list', async () => {
    const { getByText } = renderWithProviders(<RegionIndexScreen />);

    await waitFor(() => getByText('Sportlocaties Almere'));

    expect(getByText('Kaart')).toBeTruthy();
    expect(getByText('Club One')).toBeTruthy();
  });
});
