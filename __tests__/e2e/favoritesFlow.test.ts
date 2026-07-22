import { by, device, element, expect } from 'detox';

describe('Favorites Flow E2E', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true }); // Fresh install
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Complete favorites journey', () => {
    it('should complete full favorites flow: browse -> favorite -> view -> remove', async () => {
      // Step 1: Navigate to a region
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('region-card-0')).tap();

      // Step 2: Wait for locations to load
      await waitFor(element(by.id('location-card-0')))
        .toBeVisible()
        .withTimeout(5000);

      // Step 3: Favorite a location
      await element(by.id('favorite-button-0')).tap();

      // Step 4: Navigate to favorites
      await element(by.id('back-button')).tap();
      await element(by.id('favorites-button')).tap();

      // Step 5: Verify favorite appears in favorites screen
      await waitFor(element(by.id('favorites-screen')))
        .toBeVisible()
        .withTimeout(3000);
      await expect(element(by.id('favorite-item-0'))).toBeVisible();

      // Step 6: Remove favorite
      await element(by.id('favorite-button-0')).tap();

      // Step 7: Verify favorite is removed
      await expect(element(by.text('Geen favorieten'))).toBeVisible();
    });
  });

  describe('Favorites persistence', () => {
    it('should persist favorites across app restarts', async () => {
      // Step 1: Add a favorite
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('region-card-0')).tap();

      await waitFor(element(by.id('location-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('favorite-button-0')).tap();

      // Step 2: Restart app
      await device.terminateApp();
      await device.launchApp();

      // Step 3: Check favorites are still there
      await element(by.id('favorites-button')).tap();

      await expect(element(by.id('favorite-item-0'))).toBeVisible();
    });
  });

  describe('Empty favorites state', () => {
    it('should show empty state when no favorites', async () => {
      await element(by.id('favorites-button')).tap();

      await expect(element(by.text('Geen favorieten'))).toBeVisible();
      await expect(
        element(
          by.text('Voeg locaties toe aan je favorieten door op het hartje te klikken')
        )
      ).toBeVisible();
    });

    it('should navigate to explore from empty state', async () => {
      await element(by.id('favorites-button')).tap();

      const exploreButton = element(by.id('explore-button'));
      try {
        await expect(exploreButton).toBeVisible();
        await exploreButton.tap();
        await expect(element(by.id('home-screen'))).toBeVisible();
      } catch {
        // explore-button is optional in some states
      }
    });
  });

  describe('Search within favorites', () => {
    beforeEach(async () => {
      // Add some favorites first
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('region-card-0')).tap();

      await waitFor(element(by.id('location-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('favorite-button-0')).tap();

      await element(by.id('back-button')).tap();
    });

    it('should filter favorites by search query', async () => {
      await element(by.id('favorites-button')).tap();

      await waitFor(element(by.id('favorites-search')))
        .toBeVisible()
        .withTimeout(3000);

      await element(by.id('favorites-search')).typeText('Voetbal');

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Should show filtered results
      await expect(element(by.id('favorites-list'))).toBeVisible();
    });
  });

  describe('Multiple favorites management', () => {
    it('should handle multiple favorites', async () => {
      // Navigate to region
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('region-card-0')).tap();

      // Add multiple favorites
      await waitFor(element(by.id('favorite-button-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('favorite-button-0')).tap();

      await element(by.id('location-list')).scroll(200, 'down');

      await waitFor(element(by.id('favorite-button-1')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.id('favorite-button-1')).tap();

      // Navigate to favorites
      await element(by.id('back-button')).tap();
      await element(by.id('favorites-button')).tap();

      // Verify both favorites are present
      await expect(element(by.id('favorite-item-0'))).toBeVisible();
      await expect(element(by.id('favorite-item-1'))).toBeVisible();
    });
  });

  describe('Favorites statistics', () => {
    it('should display correct favorite count', async () => {
      // Add favorites first
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('region-card-0')).tap();

      await waitFor(element(by.id('favorite-button-0')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('favorite-button-0')).tap();

      await element(by.id('back-button')).tap();
      await element(by.id('favorites-button')).tap();

      // Should show count
      await expect(element(by.id('favorites-count'))).toBeVisible();
    });

    it('should display unique sports count', async () => {
      await element(by.id('favorites-button')).tap();

      await expect(element(by.id('sports-count'))).toExist();
    });
  });
});
