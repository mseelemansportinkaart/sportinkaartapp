import { by, device, element, expect } from 'detox';

describe('Home Screen E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Initial load', () => {
    it('should display the app tagline', async () => {
      await expect(element(by.text('Vind jouw perfecte sportclub in de regio'))).toBeVisible();
    });

    it('should display the favorites button', async () => {
      await expect(element(by.id('favorites-button'))).toBeVisible();
    });

    it('should display the language switcher', async () => {
      await expect(element(by.id('language-switcher'))).toBeVisible();
    });

    it('should display the contact button', async () => {
      await expect(element(by.id('contact-button'))).toBeVisible();
    });
  });

  describe('Region list', () => {
    it('should display regions after loading', async () => {
      // Wait for regions to load
      await waitFor(element(by.id('region-list')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('region-list'))).toBeVisible();
    });

    it('should display active regions', async () => {
      // Assuming there's at least one active region
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
    });

    it('should show "Coming Soon" badge for concept regions', async () => {
      // Scroll to find concept regions if needed
      await element(by.id('region-list')).scroll(200, 'down');

      // Look for concept region indicator
      await expect(element(by.text('Binnenkort'))).toExist();
    });
  });

  describe('Navigation', () => {
    it('should navigate to region screen when active region is tapped', async () => {
      // Tap on first active region
      await element(by.id('region-card-0')).tap();

      // Verify navigation to region screen
      await waitFor(element(by.id('region-screen')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('back-button'))).toBeVisible();
    });

    it('should navigate to favorites screen', async () => {
      await element(by.id('favorites-button')).tap();

      await waitFor(element(by.id('favorites-screen')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Language switching', () => {
    it('should switch language to English', async () => {
      await element(by.id('language-switcher')).tap();

      // Select English
      await element(by.text('English')).tap();

      // Verify language changed
      await expect(
        element(by.text('Find your perfect sports club in the region'))
      ).toBeVisible();
    });

    it('should switch language back to Dutch', async () => {
      await element(by.id('language-switcher')).tap();

      // Select Dutch
      await element(by.text('Nederlands')).tap();

      // Verify language changed
      await expect(
        element(by.text('Vind jouw perfecte sportclub in de regio'))
      ).toBeVisible();
    });
  });

  describe('Suggestion form', () => {
    it('should open suggestion form when contact button is tapped', async () => {
      await element(by.id('contact-button')).tap();

      await waitFor(element(by.id('suggestion-form-modal')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should show form type options', async () => {
      await element(by.id('contact-button')).tap();

      await expect(element(by.text('Nieuwe locatie toevoegen'))).toBeVisible();
      await expect(element(by.text('Informatie wijzigen'))).toBeVisible();
      await expect(element(by.text('Andere vraag'))).toBeVisible();
    });

    it('should close form when cancel is tapped', async () => {
      await element(by.id('contact-button')).tap();
      await element(by.text('Annuleren')).tap();

      await expect(element(by.id('suggestion-form-modal'))).not.toBeVisible();
    });
  });

  describe('Pull to refresh', () => {
    it('should refresh regions on pull down', async () => {
      // Pull to refresh
      await element(by.id('region-list')).scroll(100, 'up', NaN, 0.9);

      // Wait for refresh to complete
      await waitFor(element(by.id('region-card-0')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });

  describe('Error handling', () => {
    it('should show retry button on error', async () => {
      // This would need to mock network failure
      // await device.setLocation(0, 0); // Trigger offline mode

      // Verify retry button appears
      // await expect(element(by.text('Opnieuw proberen'))).toBeVisible();
    });
  });
});
