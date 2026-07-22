import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LanguageProvider>{children}</LanguageProvider>
);

describe('LanguageContext', () => {
  describe('Initial state', () => {
    it('should start with Dutch as default language', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      expect(result.current.language).toBe('nl');
    });
  });

  describe('setLanguage', () => {
    it('should switch to English', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      act(() => {
        result.current.setLanguage('en');
      });

      expect(result.current.language).toBe('en');
    });

    it('should switch back to Dutch', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      act(() => {
        result.current.setLanguage('en');
      });
      expect(result.current.language).toBe('en');

      act(() => {
        result.current.setLanguage('nl');
      });
      expect(result.current.language).toBe('nl');
    });
  });

  describe('Translation function (t)', () => {
    describe('Dutch translations', () => {
      it('should return Dutch home screen translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('home.tagline')).toBe(
          'Vind jouw perfecte sportclub in de regio'
        );
        expect(result.current.t('home.loading')).toBe("Regio's laden...");
        expect(result.current.t('home.favorites')).toBe('Favorieten');
        expect(result.current.t('home.comingSoon')).toBe('Binnenkort');
      });

      it('should return Dutch region screen translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('region.back')).toBe('Terug');
        expect(result.current.t('region.locations')).toBe('Sportlocaties');
        expect(result.current.t('region.search')).toBe('Zoek op naam of sport...');
        expect(result.current.t('region.filters')).toBe('Filters');
      });

      it('should return Dutch filter translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('filter.selectSport')).toBe('Selecteer sport');
        expect(result.current.t('filter.allSports')).toBe('Alle sporten');
        expect(result.current.t('filter.apply')).toBe('Toepassen');
      });

      it('should return Dutch favorites translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('favorites.title')).toBe('Mijn favorieten');
        expect(result.current.t('favorites.noFavorites')).toBe('Nog geen favorieten');
      });

      it('should return Dutch form translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('form.selectType')).toBe('Hoe kunnen we helpen?');
        expect(result.current.t('form.addLocation')).toBe('Nieuwe locatie toevoegen');
        expect(result.current.t('form.submit')).toBe('Versturen');
        expect(result.current.t('form.cancel')).toBe('Annuleren');
      });

      it('should return Dutch validation messages', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('form.fillAllFields')).toBe(
          'Vul alle verplichte velden in'
        );
        expect(result.current.t('form.invalidEmail')).toBe(
          'Voer een geldig e-mailadres in'
        );
      });
    });

    describe('English translations', () => {
      it('should return English home screen translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('home.tagline')).toBe(
          'Find your perfect sports location in the region'
        );
        expect(result.current.t('home.loading')).toBe('Loading regions...');
        expect(result.current.t('home.favorites')).toBe('Favorites');
        expect(result.current.t('home.comingSoon')).toBe('Coming soon');
      });

      it('should return English region screen translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('region.back')).toBe('Back');
        expect(result.current.t('region.locations')).toBe('Sports locations');
        expect(result.current.t('region.search')).toBe('Search by name or sport...');
        expect(result.current.t('region.filters')).toBe('Filters');
      });

      it('should return English filter translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('filter.selectSport')).toBe('Select sport');
        expect(result.current.t('filter.allSports')).toBe('All sports');
        expect(result.current.t('filter.apply')).toBe('Apply');
      });

      it('should return English favorites translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('favorites.title')).toBe('My favorites');
        expect(result.current.t('favorites.noFavorites')).toBe('No favorites yet');
      });

      it('should return English form translations', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('form.selectType')).toBe('How can we help?');
        expect(result.current.t('form.addLocation')).toBe('Add new location');
        expect(result.current.t('form.submit')).toBe('Submit');
        expect(result.current.t('form.cancel')).toBe('Cancel');
      });

      it('should return English validation messages', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('form.fillAllFields')).toBe(
          'Please fill in all required fields'
        );
        expect(result.current.t('form.invalidEmail')).toBe(
          'Please enter a valid email address'
        );
      });
    });

    describe('Fallback behavior', () => {
      it('should return key when translation is missing', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        expect(result.current.t('nonexistent.key')).toBe('nonexistent.key');
      });

      it('should return key for missing translation in English', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        act(() => {
          result.current.setLanguage('en');
        });

        expect(result.current.t('nonexistent.translation')).toBe(
          'nonexistent.translation'
        );
      });
    });

    describe('Language switching maintains translation consistency', () => {
      it('should switch translations when language changes', () => {
        const { result } = renderHook(() => useLanguage(), { wrapper });

        // Start with Dutch
        expect(result.current.t('home.favorites')).toBe('Favorieten');

        // Switch to English
        act(() => {
          result.current.setLanguage('en');
        });
        expect(result.current.t('home.favorites')).toBe('Favorites');

        // Switch back to Dutch
        act(() => {
          result.current.setLanguage('nl');
        });
        expect(result.current.t('home.favorites')).toBe('Favorieten');
      });
    });
  });

  describe('useLanguage hook errors', () => {
    it('should return fallback context when used outside provider', () => {
      const { result } = renderHook(() => useLanguage());

      expect(result.current.language).toBe('nl');
      expect(result.current.t('home.favorites')).toBe('Favorieten');
    });
  });

  describe('Complete translation coverage', () => {
    it('should have all required Dutch translation keys', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      const requiredKeys = [
        // Home
        'home.tagline',
        'home.loading',
        'home.error',
        'home.retry',
        'home.noRegions',
        'home.favorites',
        'home.contact',
        'home.comingSoon',

        // Region
        'region.back',
        'region.locations',
        'region.locationsFound',
        'region.search',
        'region.filters',
        'region.sport',
        'region.facilities',
        'region.cost',
        'region.loading',
        'region.error',
        'region.noLocations',
        'region.featured',
        'region.partner',

        // Filters
        'filter.selectSport',
        'filter.allSports',
        'filter.apply',

        // Favorites
        'favorites.title',
        'favorites.noFavorites',

        // Form
        'form.selectType',
        'form.addLocation',
        'form.changeLocation',
        'form.otherQuestion',
        'form.cancel',
        'form.submit',
        'form.email',
        'form.name',

        // Validation
        'form.errorTitle',
        'form.successTitle',
        'form.fillAllFields',
        'form.invalidEmail',
      ];

      requiredKeys.forEach((key) => {
        const translation = result.current.t(key);
        expect(translation).not.toBe(key); // Should not return the key itself
        expect(translation.length).toBeGreaterThan(0);
      });
    });

    it('should have matching English translation keys', () => {
      const { result } = renderHook(() => useLanguage(), { wrapper });

      act(() => {
        result.current.setLanguage('en');
      });

      const requiredKeys = [
        'home.tagline',
        'home.loading',
        'home.favorites',
        'region.back',
        'region.search',
        'filter.selectSport',
        'favorites.title',
        'form.submit',
        'form.cancel',
      ];

      requiredKeys.forEach((key) => {
        const translation = result.current.t(key);
        expect(translation).not.toBe(key);
        expect(translation.length).toBeGreaterThan(0);
      });
    });
  });
});
