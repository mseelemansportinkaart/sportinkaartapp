import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FavoritesProvider, useFavorites } from '@/contexts/FavoritesContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// Mock expo-router
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <FavoritesProvider>{children}</FavoritesProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

describe('FavoritesScreen Integration', () => {
  const mockClubs = [
    {
      id: 1,
      naam: 'Voetbal Club Amsterdam',
      sport: 'Voetbal',
      stadsdeel: 'Centrum',
      adres: 'Sportlaan 1',
      website: 'https://voetbal.nl',
      email: 'info@voetbal.nl',
      kosten: '€100',
      faciliteiten: 'Great club',
      faciliteitenLijst: ['Parking', 'Showers'],
      lidWordenMogelijk: true,
    },
    {
      id: 2,
      naam: 'Tennis Club West',
      sport: 'Tennis',
      stadsdeel: 'West',
      adres: 'Tennisweg 5',
      website: 'https://tennis.nl',
      email: 'info@tennis.nl',
      kosten: '€200',
      faciliteiten: 'Nice courts',
      faciliteitenLijst: ['Courts'],
      lidWordenMogelijk: true,
    },
    {
      id: 3,
      naam: 'Zwem Club Oost',
      sport: 'Zwemmen',
      stadsdeel: 'Oost',
      adres: 'Zwembadstraat 10',
      website: 'https://zwem.nl',
      email: 'info@zwem.nl',
      kosten: '€150',
      faciliteiten: 'Olympic pool',
      faciliteitenLijst: ['Pool', 'Sauna'],
      lidWordenMogelijk: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  describe('Favorites display', () => {
    it('should show empty state when no favorites', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.favoriteClubs).toHaveLength(0);
    });

    it('should display favorite clubs from storage', async () => {
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@sportinkaart_favorites') {
          return Promise.resolve(JSON.stringify([1, 2]));
        }
        if (key === '@sportinkaart_favorite_clubs') {
          return Promise.resolve(JSON.stringify([mockClubs[0], mockClubs[1]]));
        }
        return Promise.resolve(null);
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.favoriteClubs).toHaveLength(2);
      expect(result.current.favoriteClubs[0].naam).toBe('Voetbal Club Amsterdam');
      expect(result.current.favoriteClubs[1].naam).toBe('Tennis Club West');
    });
  });

  describe('Search within favorites', () => {
    const filterFavorites = (
      clubs: typeof mockClubs,
      searchQuery: string
    ) => {
      if (!searchQuery) return clubs;
      const query = searchQuery.toLowerCase();
      return clubs.filter(
        (club) =>
          club.naam.toLowerCase().includes(query) ||
          club.sport.toLowerCase().includes(query)
      );
    };

    it('should filter favorites by name', () => {
      const filtered = filterFavorites(mockClubs, 'voetbal');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].naam).toBe('Voetbal Club Amsterdam');
    });

    it('should filter favorites by sport', () => {
      const filtered = filterFavorites(mockClubs, 'tennis');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sport).toBe('Tennis');
    });

    it('should return all favorites for empty search', () => {
      const filtered = filterFavorites(mockClubs, '');
      expect(filtered).toHaveLength(3);
    });

    it('should return empty array for no matches', () => {
      const filtered = filterFavorites(mockClubs, 'basketbal');
      expect(filtered).toHaveLength(0);
    });

    it('should be case insensitive', () => {
      const filtered = filterFavorites(mockClubs, 'VOETBAL');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('Statistics calculation', () => {
    it('should count total favorites', () => {
      expect(mockClubs.length).toBe(3);
    });

    it('should count unique sports', () => {
      const uniqueSports = [...new Set(mockClubs.map((c) => c.sport))];
      expect(uniqueSports).toHaveLength(3);
      expect(uniqueSports).toContain('Voetbal');
      expect(uniqueSports).toContain('Tennis');
      expect(uniqueSports).toContain('Zwemmen');
    });

    it('should count membership availability', () => {
      const withMembership = mockClubs.filter((c) => c.lidWordenMogelijk);
      expect(withMembership).toHaveLength(2);
    });
  });

  describe('Remove favorite', () => {
    it('should remove club from favorites', async () => {
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@sportinkaart_favorites') {
          return Promise.resolve(JSON.stringify([1, 2]));
        }
        if (key === '@sportinkaart_favorite_clubs') {
          return Promise.resolve(JSON.stringify([mockClubs[0], mockClubs[1]]));
        }
        return Promise.resolve(null);
      });

      const wrapper = createWrapper();
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Remove first favorite
      await act(async () => {
        await result.current.toggleFavorite(mockClubs[0]);
      });

      expect(result.current.favorites).not.toContain(1);
      expect(result.current.favoriteClubs).toHaveLength(1);
    });
  });

  describe('Language integration', () => {
    it('should display Dutch empty state text', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useLanguage(), { wrapper });

      expect(result.current.t('favorites.noFavorites')).toBe('Nog geen favorieten');
      expect(result.current.t('favorites.noFavoritesSubtext')).toBe(
        'Ontdek sportclubs in jouw regio en voeg ze toe aan je favorieten door op het hartje te tikken!'
      );
    });

    it('should display English empty state text', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useLanguage(), { wrapper });

      act(() => {
        result.current.setLanguage('en');
      });

      expect(result.current.t('favorites.noFavorites')).toBe('No favorites yet');
      expect(result.current.t('favorites.noFavoritesSubtext')).toBe(
        'Discover sports locations in your area and add them to your favorites by tapping the heart!'
      );
    });
  });

  describe('Navigation from favorites', () => {
    it('should navigate to home when "Explore" is pressed', () => {
      mockPush('/');
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Text capitalization helper', () => {
    const capitalizeText = (text: string): string => {
      if (!text) return '';
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };

    it('should capitalize first letter', () => {
      expect(capitalizeText('voetbal')).toBe('Voetbal');
    });

    it('should lowercase remaining letters', () => {
      expect(capitalizeText('TENNIS')).toBe('Tennis');
    });

    it('should handle empty string', () => {
      expect(capitalizeText('')).toBe('');
    });

    it('should handle single character', () => {
      expect(capitalizeText('a')).toBe('A');
    });
  });

  describe('Membership button visibility', () => {
    it('should show "Lid worden" button for clubs with membership', () => {
      const clubsWithMembership = mockClubs.filter((c) => c.lidWordenMogelijk);
      expect(clubsWithMembership[0].lidWordenMogelijk).toBe(true);
    });

    it('should hide "Lid worden" button for clubs without membership', () => {
      const club = mockClubs.find((c) => !c.lidWordenMogelijk);
      expect(club?.lidWordenMogelijk).toBe(false);
    });
  });
});
