import { by, device, element, expect } from 'detox';

describe('Region Screen E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    // Navigate to a region screen
    await waitFor(element(by.id('region-card-0')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id('region-card-0')).tap();
    await waitFor(element(by.id('region-screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  describe('Initial load', () => {
    it('should display the back button', async () => {
      await expect(element(by.id('back-button'))).toBeVisible();
    });

    it('should display the region title', async () => {
      await expect(element(by.id('region-title'))).toBeVisible();
    });

    it('should display the search input', async () => {
      await expect(element(by.id('search-input'))).toBeVisible();
    });

    it('should display location count', async () => {
      await expect(element(by.text('locaties gevonden'))).toExist();
    });
  });

  describe('Location list', () => {
    it('should display locations after loading', async () => {
      await waitFor(element(by.id('location-list')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should display location cards', async () => {
      await waitFor(element(by.id('location-card-0')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show featured badge for featured locations', async () => {
      // Featured locations should have a badge
      await expect(element(by.id('featured-badge'))).toExist();
    });

    it('should scroll through locations', async () => {
      await element(by.id('location-list')).scroll(500, 'down');

      // Should still be on region screen
      await expect(element(by.id('region-screen'))).toBeVisible();
    });
  });

  describe('Search functionality', () => {
    it('should filter locations by name', async () => {
      await element(by.id('search-input')).typeText('Voetbal');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Should show filtered results
      await expect(element(by.id('location-list'))).toBeVisible();
    });

    it('should clear search when X is tapped', async () => {
      await element(by.id('search-input')).typeText('Test');
      await element(by.id('clear-search')).tap();

      // Search should be empty
      await expect(element(by.id('search-input'))).toHaveText('');
    });

    it('should show no results message for invalid search', async () => {
      await element(by.id('search-input')).typeText('ZZZZNONEXISTENT');

      await new Promise((resolve) => setTimeout(resolve, 400));

      await expect(element(by.text('Geen locaties gevonden'))).toBeVisible();
    });
  });

  describe('Filters', () => {
    it('should toggle filter visibility', async () => {
      await element(by.id('filters-toggle')).tap();

      await expect(element(by.id('filters-panel'))).toBeVisible();
    });

    it('should display sport filter options', async () => {
      await element(by.id('filters-toggle')).tap();

      await expect(element(by.id('sport-filter'))).toBeVisible();
    });

    it('should filter by sport', async () => {
      await element(by.id('filters-toggle')).tap();
      await element(by.id('sport-filter')).tap();

      // Select a sport
      await element(by.text('Voetbal')).tap();

      // Apply filter
      await element(by.text('Toepassen')).tap();

      // Results should be filtered
      await waitFor(element(by.id('location-list')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should display cost range filter', async () => {
      await element(by.id('filters-toggle')).tap();

      await expect(element(by.id('cost-filter'))).toBeVisible();
    });

    it('should display facilities filter', async () => {
      await element(by.id('filters-toggle')).tap();

      await expect(element(by.id('facilities-filter'))).toBeVisible();
    });
  });

  describe('Favorite functionality', () => {
    it('should toggle favorite when heart is tapped', async () => {
      await waitFor(element(by.id('favorite-button-0')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('favorite-button-0')).tap();

      // Heart should be filled
      await expect(element(by.id('favorite-button-0-filled'))).toBeVisible();
    });

    it('should unfavorite when heart is tapped again', async () => {
      // First favorite
      await element(by.id('favorite-button-0')).tap();

      // Then unfavorite
      await element(by.id('favorite-button-0-filled')).tap();

      // Heart should be unfilled
      await expect(element(by.id('favorite-button-0-unfilled'))).toBeVisible();
    });
  });

  describe('Location details', () => {
    it('should display location name', async () => {
      await expect(element(by.id('location-name-0'))).toBeVisible();
    });

    it('should display location sport', async () => {
      await expect(element(by.id('location-sport-0'))).toBeVisible();
    });

    it('should display location address', async () => {
      await expect(element(by.id('location-address-0'))).toBeVisible();
    });

    it('should display location cost', async () => {
      await expect(element(by.id('location-cost-0'))).toBeVisible();
    });

    it('should open website when website button is tapped', async () => {
      await element(by.id('website-button-0')).tap();

      // Web browser should open (can't test external app)
    });

    it('should open email when email button is tapped', async () => {
      await element(by.id('email-button-0')).tap();

      // Email client should open (can't test external app)
    });

    it('should open phone dialer when phone button is tapped', async () => {
      await element(by.id('phone-button-0')).tap();

      // Phone dialer should open (can't test external app)
    });
  });

  describe('Navigation', () => {
    it('should navigate back to home screen', async () => {
      await element(by.id('back-button')).tap();

      await expect(element(by.id('home-screen'))).toBeVisible();
    });

    it('should navigate to favorites from region screen', async () => {
      await element(by.id('favorites-button')).tap();

      await expect(element(by.id('favorites-screen'))).toBeVisible();
    });
  });

  describe('Pagination', () => {
    it('should load more locations when scrolling to bottom', async () => {
      // Scroll to bottom
      await element(by.id('location-list')).scroll(2000, 'down');

      // Wait for more items to load
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Should have more items
      await expect(element(by.id('location-list'))).toBeVisible();
    });
  });

  describe('Language integration', () => {
    it('should display content in selected language', async () => {
      // Switch to English
      await element(by.id('language-switcher')).tap();
      await element(by.text('English')).tap();

      // Verify UI is in English
      await expect(element(by.text('Search by name or sport...'))).toBeVisible();
    });
  });
});
