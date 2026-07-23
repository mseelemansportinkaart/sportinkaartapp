import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderOptions } from '@testing-library/react-native';
import React, { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { FiltersProvider } from '@/contexts/FiltersContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Create a new QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

// Deterministic safe-area metrics so useSafeAreaInsets() resolves without a
// native layout pass. Mirrors a typical device with a status-bar/notch inset.
const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// All providers wrapper for integration tests
function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <FavoritesProvider>
            <FiltersProvider>
              {children}
            </FiltersProvider>
          </FavoritesProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// Query provider only wrapper
function QueryProviderWrapper({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// Language provider only wrapper
function LanguageProviderWrapper({ children }: WrapperProps) {
  return <LanguageProvider>{children}</LanguageProvider>;
}

// Favorites provider only wrapper
function FavoritesProviderWrapper({ children }: WrapperProps) {
  return <FavoritesProvider>{children}</FavoritesProvider>;
}

// Custom render with all providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options });

// Export render functions for different scenarios
export const renderWithProviders = customRender;
export const renderWithQuery = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: QueryProviderWrapper, ...options });
export const renderWithLanguage = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: LanguageProviderWrapper, ...options });
export const renderWithFavorites = (ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  render(ui, { wrapper: FavoritesProviderWrapper, ...options });

// Re-export everything from testing library
export * from '@testing-library/react-native';
export { customRender as render };

// Test data factories
export const createMockRegion = (overrides = {}) => ({
  id: 'test-region-id',
  region_name: 'Test Region',
  slug: 'test-region',
  is_active: true,
  is_concept: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
});

export const createMockRawLocation = (overrides = {}) => ({
  id: 'test-location-id',
  name: 'Test Sports Club',
  sport_nl: 'Voetbal',
  sport_en: 'Football',
  description_nl: 'Een geweldige sportclub',
  description_en: 'A great sports club',
  facilities_nl: ['Kleedkamers', 'Parkeren'],
  facilities_en: ['Changing rooms', 'Parking'],
  address: 'Sportlaan 1, 1234 AB Teststad',
  website: 'https://test.com',
  email: 'info@test.com',
  cost_range: '100-200',
  membership_available: true,
  is_featured: false,
  is_partner: false,
  main_image_url: 'https://test.com/image.jpg',
  phone: '+31 6 12345678',
  is_active: true,
  ...overrides,
});

export const createMockLocation = (overrides = {}) => ({
  id: 'test-location-id',
  naam: 'Test Sports Club',
  sport: 'Voetbal',
  sports: ['Voetbal'],
  stadsdeel: 'Sportlaan 1',
  adres: 'Sportlaan 1, 1234 AB Teststad',
  website: 'https://test.com',
  email: 'info@test.com',
  kosten: '€100-200',
  faciliteiten: 'Een geweldige sportclub',
  faciliteitenLijst: ['Kleedkamers', 'Parkeren'],
  lidWordenMogelijk: true,
  is_featured: false,
  is_partner: false,
  main_image_url: 'https://test.com/image.jpg',
  images: [],
  phone: '+31 6 12345678',
  description_nl: 'Een geweldige sportclub',
  description_en: 'A great sports club',
  facilities_nl: ['Kleedkamers', 'Parkeren'],
  facilities_en: ['Changing rooms', 'Parking'],
  sport_nl: 'Voetbal',
  sport_en: 'Football',
  sports_nl: ['Voetbal'],
  sports_en: ['Football'],
  ...overrides,
});

export const createMockClub = (overrides = {}) => ({
  id: 1,
  naam: 'Test Club',
  sport: 'Voetbal',
  stadsdeel: 'Test District',
  adres: 'Test Address 1',
  website: 'https://test.com',
  email: 'test@test.com',
  kosten: '€100',
  faciliteiten: 'Test facilities',
  faciliteitenLijst: ['Parking', 'Showers'],
  lidWordenMogelijk: true,
  ...overrides,
});

// Async utilities
export const waitForAsync = (ms: number = 0) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const flushPromises = () => new Promise(setImmediate);
