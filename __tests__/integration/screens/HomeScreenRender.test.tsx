import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../setup/test-utils';
import HomeScreen from '@/app/(tabs)/index';
import { supabase } from '@/lib/supabase';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const mockRegions = [
  {
    id: '1',
    region_name: 'Almere',
    slug: 'almere',
    is_active: true,
    is_concept: false,
    latitude: 52.37,
    longitude: 5.22,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: '2',
    region_name: 'Utrecht',
    slug: 'utrecht',
    is_active: false,
    is_concept: true,
    latitude: 52.09,
    longitude: 5.12,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

const createSupabaseQuery = (data: typeof mockRegions) => {
  const query: any = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.order = jest.fn().mockResolvedValue({ data, error: null });

  return query;
};

const createCountQuery = (count: number) => ({
  select: jest.fn((_: string, options?: { head?: boolean }) => {
    if (options?.head) {
      return {
        eq: jest.fn().mockResolvedValue({ count, error: null }),
      };
    }

    const query: any = {};
    query.eq = jest.fn(() => query);
    query.order = jest.fn().mockResolvedValue({ data: [], error: null });
    return query;
  }),
});

describe('HomeScreen render', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const mockFrom = supabase.from as jest.Mock;
    let regionCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'regions') {
        regionCallCount += 1;
        return createSupabaseQuery(regionCallCount === 1 ? [mockRegions[0]] : [mockRegions[1]]);
      }
      return createCountQuery(12);
    });
  });

  it('renders the home screen with regions', async () => {
    const { getByTestId, getByText } = renderWithProviders(<HomeScreen />);

    await waitFor(() => getByTestId('marker-region-1'));

    expect(getByTestId('marker-region-1')).toBeTruthy();
    expect(getByText('Favorieten')).toBeTruthy();
  });
});
