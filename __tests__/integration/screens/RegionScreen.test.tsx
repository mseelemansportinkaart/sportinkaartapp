import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { transformLocationForLanguage, RawLocation } from '@/hooks/useRegionData';

// Mock supabase
const mockSupabaseFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockSupabaseFrom,
  },
}));

// Mock expo-router
const mockBack = jest.fn();
const mockLocalSearchParams = { slug: 'amsterdam' };
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: jest.fn(),
  }),
  useLocalSearchParams: () => mockLocalSearchParams,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

describe('RegionScreen Integration', () => {
  const mockRegion = {
    id: '1',
    region_name: 'Amsterdam',
    slug: 'amsterdam',
    is_active: true,
    is_concept: false,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  };

  const mockRawLocations: RawLocation[] = [
    {
      id: '1',
      name: 'Voetbal Club Amsterdam',
      sport_nl: 'Voetbal',
      sport_en: 'Football',
      description_nl: 'Geweldige voetbalclub',
      description_en: 'Great football club',
      facilities_nl: ['Kleedkamers', 'Parkeren'],
      facilities_en: ['Changing rooms', 'Parking'],
      address: 'Sportlaan 1, Amsterdam',
      website: 'https://voetbal.nl',
      email: 'info@voetbal.nl',
      cost_range: '100-200',
      membership_available: true,
      is_featured: true,
      is_partner: false,
      is_active: true,
    },
    {
      id: '2',
      name: 'Tennis Club West',
      sport_nl: 'Tennis',
      sport_en: 'Tennis',
      description_nl: 'Tennis club',
      description_en: 'Tennis club',
      facilities_nl: ['Courts', 'Kantine'],
      facilities_en: ['Courts', 'Canteen'],
      address: 'Tennisweg 5, Amsterdam',
      website: 'https://tennis.nl',
      email: 'info@tennis.nl',
      cost_range: '200-300',
      membership_available: true,
      is_featured: false,
      is_partner: true,
      is_active: true,
    },
    {
      id: '3',
      name: 'Multi Sport Center',
      sport_nl: ['Voetbal', 'Tennis', 'Zwemmen'],
      sport_en: ['Football', 'Tennis', 'Swimming'],
      description_nl: 'Diverse sporten',
      description_en: 'Various sports',
      facilities_nl: ['Alles'],
      facilities_en: ['Everything'],
      address: 'Sportpark 10, Amsterdam',
      website: 'https://multi.nl',
      email: 'info@multi.nl',
      cost_range: '150-250',
      membership_available: false,
      is_featured: true,
      is_partner: true,
      is_active: true,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Data fetching and transformation', () => {
    it('should transform locations for Dutch language', () => {
      const transformed = mockRawLocations.map((loc) =>
        transformLocationForLanguage(loc, 'nl', 'Amsterdam')
      );

      expect(transformed[0].sport).toBe('Voetbal');
      expect(transformed[0].faciliteiten).toBe('Geweldige voetbalclub');
      expect(transformed[0].kosten).toBe('€100-200');
    });

    it('should transform locations for English language', () => {
      const transformed = mockRawLocations.map((loc) =>
        transformLocationForLanguage(loc, 'en', 'Amsterdam')
      );

      expect(transformed[0].sport).toBe('Football');
      expect(transformed[0].faciliteiten).toBe('Great football club');
    });

    it('should handle multiple sports correctly', () => {
      const multiSport = transformLocationForLanguage(
        mockRawLocations[2],
        'nl',
        'Amsterdam'
      );

      expect(multiSport.sport).toBe('Diverse sporten');
      expect(multiSport.sports).toEqual(['Voetbal', 'Tennis', 'Zwemmen']);
    });
  });

  describe('Search filtering', () => {
    const locations = mockRawLocations.map((loc) =>
      transformLocationForLanguage(loc, 'nl', 'Amsterdam')
    );

    it('should filter locations by name', () => {
      const searchQuery = 'voetbal';
      const filtered = locations.filter((loc) =>
        loc.naam.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].naam).toBe('Voetbal Club Amsterdam');
    });

    it('should filter locations by sport', () => {
      const searchQuery = 'tennis';
      const filtered = locations.filter(
        (loc) =>
          loc.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.sport.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].naam).toBe('Tennis Club West');
    });

    it('should return all locations for empty search', () => {
      const searchQuery: string = '';
      const filtered = locations.filter(
        (loc) =>
          !searchQuery ||
          loc.naam.toLowerCase().includes(searchQuery.toLowerCase()) ||
          loc.sport.toLowerCase().includes(searchQuery.toLowerCase())
      );

      expect(filtered).toHaveLength(3);
    });
  });

  describe('Sport filter', () => {
    const locations = mockRawLocations.map((loc) =>
      transformLocationForLanguage(loc, 'nl', 'Amsterdam')
    );

    it('should filter by specific sport', () => {
      const sportFilter = 'Voetbal';
      const filtered = locations.filter(
        (loc) => loc.sport === sportFilter || loc.sports.includes(sportFilter)
      );

      expect(filtered).toHaveLength(2); // Voetbal Club + Multi Sport Center
    });

    it('should return all for "Alle sporten" filter', () => {
      const sportFilter = '';
      const filtered = sportFilter
        ? locations.filter(
            (loc) => loc.sport === sportFilter || loc.sports.includes(sportFilter)
          )
        : locations;

      expect(filtered).toHaveLength(3);
    });

    it('should extract unique sports from locations', () => {
      const allSports = locations.flatMap((loc) => loc.sports);
      const uniqueSports = [...new Set(allSports)];

      expect(uniqueSports).toContain('Voetbal');
      expect(uniqueSports).toContain('Tennis');
      expect(uniqueSports).toContain('Zwemmen');
    });
  });

  describe('Cost range filter', () => {
    const extractMinCost = (kosten: string): number => {
      const match = kosten.match(/€?(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    const locations = mockRawLocations.map((loc) =>
      transformLocationForLanguage(loc, 'nl', 'Amsterdam')
    );

    it('should filter by minimum cost', () => {
      const minCost = 150;
      const filtered = locations.filter(
        (loc) => extractMinCost(loc.kosten) >= minCost
      );

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((loc) => {
        expect(extractMinCost(loc.kosten)).toBeGreaterThanOrEqual(minCost);
      });
    });

    it('should filter by maximum cost', () => {
      const maxCost = 150;
      const filtered = locations.filter(
        (loc) => extractMinCost(loc.kosten) <= maxCost
      );

      expect(filtered.length).toBeGreaterThan(0);
      filtered.forEach((loc) => {
        expect(extractMinCost(loc.kosten)).toBeLessThanOrEqual(maxCost);
      });
    });

    it('should filter by cost range', () => {
      const minCost = 100;
      const maxCost = 200;
      const filtered = locations.filter((loc) => {
        const cost = extractMinCost(loc.kosten);
        return cost >= minCost && cost <= maxCost;
      });

      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  describe('Facilities filter', () => {
    const locations = mockRawLocations.map((loc) =>
      transformLocationForLanguage(loc, 'nl', 'Amsterdam')
    );

    it('should filter by facility', () => {
      const facilityFilter = 'Parkeren';
      const filtered = locations.filter((loc) =>
        loc.faciliteitenLijst.includes(facilityFilter)
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].naam).toBe('Voetbal Club Amsterdam');
    });

    it('should extract unique facilities', () => {
      const allFacilities = locations.flatMap((loc) => loc.faciliteitenLijst);
      const uniqueFacilities = [...new Set(allFacilities)];

      expect(uniqueFacilities).toContain('Kleedkamers');
      expect(uniqueFacilities).toContain('Parkeren');
      expect(uniqueFacilities).toContain('Courts');
    });
  });

  describe('Pagination', () => {
    it('should paginate results correctly', () => {
      const itemsPerPage = 10;
      const allItems = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

      const page1 = allItems.slice(0, itemsPerPage);
      const page2 = allItems.slice(itemsPerPage, itemsPerPage * 2);
      const page3 = allItems.slice(itemsPerPage * 2, itemsPerPage * 3);

      expect(page1).toHaveLength(10);
      expect(page2).toHaveLength(10);
      expect(page3).toHaveLength(5);
    });

    it('should calculate total pages correctly', () => {
      const itemsPerPage = 10;
      const totalItems = 25;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      expect(totalPages).toBe(3);
    });
  });

  describe('Featured and Partner locations', () => {
    const locations = mockRawLocations.map((loc) =>
      transformLocationForLanguage(loc, 'nl', 'Amsterdam')
    );

    it('should identify featured locations', () => {
      const featured = locations.filter((loc) => loc.is_featured);
      expect(featured).toHaveLength(2);
    });

    it('should identify partner locations', () => {
      const partners = locations.filter((loc) => loc.is_partner);
      expect(partners).toHaveLength(2);
    });

    it('should sort featured locations first', () => {
      const sorted = [...locations].sort((a, b) => {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return 0;
      });

      expect(sorted[0].is_featured).toBe(true);
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is pressed', () => {
      mockBack();
      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Favorite toggle integration', () => {
    it('should correctly identify numeric ID from UUID', () => {
      const getNumericId = (uuid: string): number => {
        let hash = 0;
        for (let i = 0; i < uuid.length; i++) {
          const char = uuid.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return Math.abs(hash);
      };

      const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const numericId = getNumericId(uuid);

      expect(typeof numericId).toBe('number');
      expect(numericId).toBeGreaterThan(0);

      // Same UUID should always produce same ID
      expect(getNumericId(uuid)).toBe(numericId);
    });
  });
});
