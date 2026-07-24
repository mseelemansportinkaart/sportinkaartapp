import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../setup/test-utils';
import RegionMapScreen from '@/app/region/[slug]/map';
import { supabase } from '@/lib/supabase';
import { getEmojiIconKey } from '@/utils/locationFeatures';

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

const createLocationsQuery = (allData: LocationRow[]) => ({
  select: jest.fn((_: unknown, options?: { head?: boolean }) => {
    if (options?.head) {
      return {
        eq: jest.fn().mockResolvedValue({ count: allData.length, error: null }),
      };
    }

    const pagedQuery: any = {};
    pagedQuery.eq = jest.fn(() => pagedQuery);
    pagedQuery.order = jest.fn(() => pagedQuery);
    pagedQuery.range = jest.fn((from: number, to: number) =>
      Promise.resolve({
        data: allData.slice(from, to + 1),
        error: null,
      })
    );

    return pagedQuery;
  }),
});

describe('RegionMapScreen integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockFrom = supabase.from as jest.Mock;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'regions') {
        return createRegionQuery(mockRegion);
      }

      if (table === 'almere') {
        return createLocationsQuery(mockLocations);
      }

      return createLocationsQuery([]);
    });
  });

  it('feeds region locations into the clustered shape source', async () => {
    const { getByTestId, getByText } = renderWithProviders(<RegionMapScreen />);

    await waitFor(() => getByTestId('region-map'));

    expect(getByText('Sportlocaties Almere')).toBeTruthy();

    const shapeSource = await waitFor(() => getByTestId('shape-source-region-locations'));
    expect(shapeSource.props.cluster).toBe(true);
    await waitFor(() => {
      expect(shapeSource.props.shape.features).toHaveLength(1);
    });

    const feature = shapeSource.props.shape.features[0];
    expect(feature.properties.id).toBe('loc-1');
    expect(feature.geometry.coordinates).toEqual([4.9, 52.37]);

    // The football emoji is registered as a style image for the symbol layer.
    expect(getByTestId(`map-image-${getEmojiIconKey('⚽️')}`)).toBeTruthy();
  });

  it('selects a location when its feature is pressed', async () => {
    const { getByTestId, getByText } = renderWithProviders(<RegionMapScreen />);

    const shapeSource = await waitFor(() => getByTestId('shape-source-region-locations'));
    await waitFor(() => {
      expect(shapeSource.props.shape.features).toHaveLength(1);
    });

    fireEvent(shapeSource, 'press', {
      features: shapeSource.props.shape.features,
    });

    await waitFor(() => expect(getByText('Club One')).toBeTruthy());
    expect(getByTestId('marker-selected-loc-1')).toBeTruthy();
  });

  it('zooms in when a cluster is pressed', async () => {
    const mapboxMock = jest.requireMock('@rnmapbox/maps');
    const { getByTestId } = renderWithProviders(<RegionMapScreen />);

    const shapeSource = await waitFor(() => getByTestId('shape-source-region-locations'));

    fireEvent(shapeSource, 'press', {
      features: [
        {
          type: 'Feature',
          properties: { cluster: true, cluster_id: 7, point_count: 12 },
          geometry: { type: 'Point', coordinates: [5.2, 52.35] },
        },
      ],
    });

    await waitFor(() => {
      expect(mapboxMock.__mockSetCamera).toHaveBeenCalledWith(
        expect.objectContaining({
          centerCoordinate: [5.2, 52.35],
          zoomLevel: 14.4,
        })
      );
    });
  });
});
