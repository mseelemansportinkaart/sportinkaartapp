import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import React from 'react';
import { FavoritesProvider, useFavorites } from '@/contexts/FavoritesContext';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <FavoritesProvider>{children}</FavoritesProvider>
);

const mockClub = {
  id: 1,
  naam: 'Test Club',
  sport: 'Voetbal',
  stadsdeel: 'Amsterdam',
  adres: 'Sportlaan 1',
  website: 'https://test.com',
  email: 'info@test.com',
  kosten: '€100',
  faciliteiten: 'Test facilities',
  faciliteitenLijst: ['Parking', 'Showers'],
  lidWordenMogelijk: true,
};

const mockClub2 = {
  ...mockClub,
  id: 2,
  naam: 'Test Club 2',
};

describe('FavoritesContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  describe('Initial state', () => {
    it('should start with empty favorites and loading state', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

      // Initially loading should be true
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.favorites).toEqual([]);
      expect(result.current.favoriteClubs).toEqual([]);
    });

    it('should load favorites from AsyncStorage on mount', async () => {
      const storedFavorites = [1, 2, 3];
      const storedClubs = [mockClub, mockClub2];

      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@sportinkaart_favorites') {
          return Promise.resolve(JSON.stringify(storedFavorites));
        }
        if (key === '@sportinkaart_favorite_clubs') {
          return Promise.resolve(JSON.stringify(storedClubs));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.favorites).toEqual(storedFavorites);
      expect(result.current.favoriteClubs).toEqual(storedClubs);
    });
  });

  describe('isFavorite', () => {
    it('should return true for favorited clubs', async () => {
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@sportinkaart_favorites') {
          return Promise.resolve(JSON.stringify([1]));
        }
        if (key === '@sportinkaart_favorite_clubs') {
          return Promise.resolve(JSON.stringify([mockClub]));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isFavorite(1)).toBe(true);
    });

    it('should return false for non-favorited clubs', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isFavorite(999)).toBe(false);
    });
  });

  describe('toggleFavorite', () => {
    it('should add a club to favorites', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite(mockClub);
      });

      expect(result.current.favorites).toContain(mockClub.id);
      expect(result.current.favoriteClubs).toContainEqual(mockClub);
      expect(result.current.isFavorite(mockClub.id)).toBe(true);
    });

    it('should remove a club from favorites when already favorited', async () => {
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@sportinkaart_favorites') {
          return Promise.resolve(JSON.stringify([1]));
        }
        if (key === '@sportinkaart_favorite_clubs') {
          return Promise.resolve(JSON.stringify([mockClub]));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Verify it's favorited first
      expect(result.current.isFavorite(1)).toBe(true);

      // Toggle off
      await act(async () => {
        await result.current.toggleFavorite(mockClub);
      });

      expect(result.current.favorites).not.toContain(1);
      expect(result.current.favoriteClubs).not.toContainEqual(mockClub);
      expect(result.current.isFavorite(1)).toBe(false);
    });

    it('should persist favorites to AsyncStorage', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite(mockClub);
      });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@sportinkaart_favorites',
        JSON.stringify([mockClub.id])
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@sportinkaart_favorite_clubs',
        JSON.stringify([mockClub])
      );
    });

    it('should handle multiple favorites', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.toggleFavorite(mockClub);
      });

      await act(async () => {
        await result.current.toggleFavorite(mockClub2);
      });

      expect(result.current.favorites).toEqual([1, 2]);
      expect(result.current.favoriteClubs).toHaveLength(2);
    });
  });

  describe('getFavoriteClubs', () => {
    it('should return all favorite clubs', async () => {
      mockAsyncStorage.getItem.mockImplementation((key) => {
        if (key === '@sportinkaart_favorites') {
          return Promise.resolve(JSON.stringify([1, 2]));
        }
        if (key === '@sportinkaart_favorite_clubs') {
          return Promise.resolve(JSON.stringify([mockClub, mockClub2]));
        }
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const clubs = result.current.getFavoriteClubs();
      expect(clubs).toHaveLength(2);
      expect(clubs).toEqual([mockClub, mockClub2]);
    });

    it('should return empty array when no favorites', async () => {
      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.getFavoriteClubs()).toEqual([]);
    });
  });

  describe('Error handling', () => {
    it('should handle AsyncStorage load errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockAsyncStorage.getItem.mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have empty state on error
      expect(result.current.favorites).toEqual([]);
      expect(result.current.favoriteClubs).toEqual([]);

      consoleError.mockRestore();
    });

    it('should handle AsyncStorage save errors gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockAsyncStorage.setItem.mockRejectedValue(new Error('Save error'));

      const { result } = renderHook(() => useFavorites(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw, just log error
      await act(async () => {
        await result.current.toggleFavorite(mockClub);
      });

      // State should still be updated in memory
      expect(result.current.favorites).toContain(mockClub.id);

      consoleError.mockRestore();
    });
  });

  describe('useFavorites hook errors', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useFavorites());
      }).toThrow('useFavorites must be used within a FavoritesProvider');

      consoleError.mockRestore();
    });
  });
});
