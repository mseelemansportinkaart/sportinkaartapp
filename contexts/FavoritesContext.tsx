import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

// Types
interface Club {
  id: number;
  naam: string;
  sport: string;
  stadsdeel: string;
  adres: string;
  website: string;
  email: string;
  kosten: string;
  faciliteiten: string;
  faciliteitenLijst: string[];
  lidWordenMogelijk: boolean;
  is_featured?: boolean;
  is_partner?: boolean;
}

interface FavoritesContextType {
  favorites: number[];
  isFavorite: (clubId: number) => boolean;
  toggleFavorite: (club: Club) => Promise<void>;
  getFavoriteClubs: () => Club[];
  favoriteClubs: Club[];
  loading: boolean;
}

// Context
const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

// Storage keys
const FAVORITES_KEY = '@sportinkaart_favorites';
const FAVORITE_CLUBS_KEY = '@sportinkaart_favorite_clubs';

// Provider component
interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider: React.FC<FavoritesProviderProps> = ({ children }) => {
  const [favorites, setFavorites] = useState<number[]>([]);
  const [favoriteClubs, setFavoriteClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);

  // Load favorieten bij app start
  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const [favIds, favClubs] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(FAVORITE_CLUBS_KEY)
      ]);

      if (favIds) {
        setFavorites(JSON.parse(favIds));
      }
      
      if (favClubs) {
        setFavoriteClubs(JSON.parse(favClubs));
      }
    } catch (error) {
      console.error('Fout bij laden favorieten:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveFavorites = async (newFavorites: number[], newFavoriteClubs: Club[]) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites)),
        AsyncStorage.setItem(FAVORITE_CLUBS_KEY, JSON.stringify(newFavoriteClubs))
      ]);
    } catch (error) {
      console.error('Fout bij opslaan favorieten:', error);
    }
  };

  const isFavorite = useCallback((clubId: number): boolean => {
    return favorites.includes(clubId);
  }, [favorites]);

  const toggleFavorite = async (club: Club) => {
    const isCurrentlyFavorite = isFavorite(club.id);
    
    let newFavorites: number[];
    let newFavoriteClubs: Club[];

    if (isCurrentlyFavorite) {
      // Verwijder uit favorieten
      newFavorites = favorites.filter(id => id !== club.id);
      newFavoriteClubs = favoriteClubs.filter(c => c.id !== club.id);
    } else {
      // Voeg toe aan favorieten
      newFavorites = [...favorites, club.id];
      newFavoriteClubs = [...favoriteClubs, club];
    }

    setFavorites(newFavorites);
    setFavoriteClubs(newFavoriteClubs);
    await saveFavorites(newFavorites, newFavoriteClubs);
  };

  const getFavoriteClubs = (): Club[] => {
    return favoriteClubs;
  };

  const value: FavoritesContextType = {
    favorites,
    isFavorite,
    toggleFavorite,
    getFavoriteClubs,
    favoriteClubs,
    loading
  };

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
};

// Hook voor gebruik in components
export const useFavorites = (): FavoritesContextType => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};