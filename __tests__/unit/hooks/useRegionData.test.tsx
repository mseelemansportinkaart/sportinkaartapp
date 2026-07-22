import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  transformLocationForLanguage,
  RawLocation,
} from '@/hooks/useRegionData';

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('transformLocationForLanguage', () => {
  const baseRawLocation: RawLocation = {
    id: 'test-id',
    name: 'Test Club',
    sport_nl: 'Voetbal',
    sport_en: 'Football',
    description_nl: 'Nederlandse beschrijving',
    description_en: 'English description',
    facilities_nl: ['Kleedkamers', 'Parkeren'],
    facilities_en: ['Changing rooms', 'Parking'],
    address: 'Sportlaan 1, Amsterdam',
    website: 'https://test.com',
    email: 'info@test.com',
    cost_range: '100-200',
    membership_available: true,
    is_featured: true,
    is_partner: false,
    main_image_url: 'https://test.com/image.jpg',
    phone: '+31612345678',
    is_active: true,
  };

  describe('Language-specific transformations', () => {
    it('should transform location for Dutch language', () => {
      const result = transformLocationForLanguage(baseRawLocation, 'nl', 'Amsterdam');

      expect(result.sport).toBe('Voetbal');
      expect(result.faciliteiten).toBe('Nederlandse beschrijving');
      expect(result.faciliteitenLijst).toEqual(['Kleedkamers', 'Parkeren']);
      expect(result.sport_nl).toBe('Voetbal');
      expect(result.sport_en).toBe('Football');
    });

    it('should transform location for English language', () => {
      const result = transformLocationForLanguage(baseRawLocation, 'en', 'Amsterdam');

      expect(result.sport).toBe('Football');
      expect(result.faciliteiten).toBe('English description');
      expect(result.faciliteitenLijst).toEqual(['Changing rooms', 'Parking']);
    });
  });

  describe('Sports handling', () => {
    it('should handle single sport as string', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: 'Tennis',
        sport_en: 'Tennis',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.sport).toBe('Tennis');
      expect(result.sports).toEqual(['Tennis']);
    });

    it('should handle multiple sports as array', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: ['Voetbal', 'Tennis', 'Zwemmen'],
        sport_en: ['Football', 'Tennis', 'Swimming'],
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.sport).toBe('Diverse sporten');
      expect(result.sports).toEqual(['Voetbal', 'Tennis', 'Zwemmen']);
    });

    it('should handle multiple sports with English language', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: ['Voetbal', 'Tennis'],
        sport_en: ['Football', 'Tennis'],
      };

      const result = transformLocationForLanguage(location, 'en', 'Test');
      expect(result.sport).toBe('Various sports');
      expect(result.sports).toEqual(['Football', 'Tennis']);
    });

    it('should filter out empty strings from sports array', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: ['Voetbal', '', '  ', 'Tennis'],
        sport_en: ['Football', '', 'Tennis'],
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.sports).toEqual(['Voetbal', 'Tennis']);
    });

    it('should handle empty sport with default value in Dutch', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: '',
        sport_en: '',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.sport).toBe('Diverse sporten');
    });

    it('should handle empty sport with default value in English', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: '',
        sport_en: '',
      };

      const result = transformLocationForLanguage(location, 'en', 'Test');
      expect(result.sport).toBe('Various sports');
    });

    it('should handle empty array for sports', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        sport_nl: [] as unknown as string,
        sport_en: [] as unknown as string,
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.sport).toBe('Diverse sporten');
      expect(result.sports).toEqual([]);
    });
  });

  describe('Cost range formatting', () => {
    it('should format cost range with euro symbol', () => {
      const result = transformLocationForLanguage(baseRawLocation, 'nl', 'Test');
      expect(result.kosten).toBe('€100-200');
    });

    it('should handle "unknown" cost range in Dutch', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        cost_range: 'unknown',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.kosten).toBe('Prijs op aanvraag');
    });

    it('should handle "Unknown" cost range (case insensitive) in English', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        cost_range: 'Unknown',
      };

      const result = transformLocationForLanguage(location, 'en', 'Test');
      expect(result.kosten).toBe('Price on request');
    });

    it('should handle empty cost range', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        cost_range: '',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.kosten).toBe('Prijs op aanvraag');
    });
  });

  describe('Address and stadsdeel handling', () => {
    it('should extract stadsdeel from address', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        address: 'Sportlaan 1, 1234 AB Amsterdam',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test Region');
      expect(result.stadsdeel).toBe('Sportlaan 1');
      expect(result.adres).toBe('Sportlaan 1, 1234 AB Amsterdam');
    });

    it('should use region name when address is empty', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        address: '',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Amsterdam');
      expect(result.stadsdeel).toBe('Amsterdam');
    });
  });

  describe('Optional fields handling', () => {
    it('should handle missing phone', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        phone: undefined,
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.phone).toBeUndefined();
    });

    it('should handle missing main_image_url', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        main_image_url: undefined,
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.main_image_url).toBeUndefined();
    });

    it('should handle missing name with default', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        name: '',
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.naam).toBe('Unknown');
    });
  });

  describe('Boolean fields', () => {
    it('should preserve is_featured and is_partner flags', () => {
      const result = transformLocationForLanguage(baseRawLocation, 'nl', 'Test');
      expect(result.is_featured).toBe(true);
      expect(result.is_partner).toBe(false);
    });

    it('should handle membership_available', () => {
      const result = transformLocationForLanguage(baseRawLocation, 'nl', 'Test');
      expect(result.lidWordenMogelijk).toBe(true);

      const locationNoMembership: RawLocation = {
        ...baseRawLocation,
        membership_available: false,
      };
      const result2 = transformLocationForLanguage(locationNoMembership, 'nl', 'Test');
      expect(result2.lidWordenMogelijk).toBe(false);
    });

    it('should default membership_available to true when undefined', () => {
      const location = {
        ...baseRawLocation,
        membership_available: undefined as unknown as boolean,
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      // When membership_available is undefined, !== false is true
      expect(result.lidWordenMogelijk).toBe(true);
    });
  });

  describe('Facilities handling', () => {
    it('should handle empty facilities array', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        facilities_nl: [],
        facilities_en: [],
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.faciliteitenLijst).toEqual([]);
    });

    it('should handle null facilities', () => {
      const location: RawLocation = {
        ...baseRawLocation,
        facilities_nl: null as unknown as string[],
        facilities_en: null as unknown as string[],
      };

      const result = transformLocationForLanguage(location, 'nl', 'Test');
      expect(result.faciliteitenLijst).toEqual([]);
    });
  });

  describe('Both language versions stored', () => {
    it('should store both language versions in transformed location', () => {
      const result = transformLocationForLanguage(baseRawLocation, 'nl', 'Test');

      // Should have both NL and EN versions
      expect(result.description_nl).toBe('Nederlandse beschrijving');
      expect(result.description_en).toBe('English description');
      expect(result.facilities_nl).toEqual(['Kleedkamers', 'Parkeren']);
      expect(result.facilities_en).toEqual(['Changing rooms', 'Parking']);
      expect(result.sports_nl).toEqual(['Voetbal']);
      expect(result.sports_en).toEqual(['Football']);
    });
  });

  describe('Edge cases', () => {
    it('should handle location with all empty/null fields', () => {
      const emptyLocation: RawLocation = {
        id: 'test-id',
        name: '',
        sport_nl: '',
        sport_en: '',
        description_nl: '',
        description_en: '',
        facilities_nl: [],
        facilities_en: [],
        address: '',
        website: '',
        email: '',
        cost_range: '',
        membership_available: false,
        is_featured: false,
        is_partner: false,
        is_active: true,
      };

      const result = transformLocationForLanguage(emptyLocation, 'nl', 'Default Region');

      expect(result.naam).toBe('Unknown');
      expect(result.sport).toBe('Diverse sporten');
      expect(result.stadsdeel).toBe('Default Region');
      expect(result.kosten).toBe('Prijs op aanvraag');
    });
  });
});
