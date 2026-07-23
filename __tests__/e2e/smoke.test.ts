import { by, device, element, expect, waitFor } from 'detox';

/**
 * End-to-end smoke suite.
 *
 * Deliberately narrow. It covers the chrome that is always on screen and the
 * flows that don't depend on backend data or on Mapbox having finished
 * rendering tiles — those are the parts that can be relied on to stay green in
 * CI. Navigating into a region means tapping a pin on the map, which depends on
 * Supabase data plus marker render timing; that isn't covered here.
 *
 * These require a native build (`ios/` and `android/` are generated, not
 * committed) — see the header of `.detoxrc.js`.
 */
describe('Smoke', () => {
  beforeAll(async () => {
    await device.launchApp({ delete: true });
  });

  // A full relaunch rather than `device.reloadReactNative()`: reloading only the
  // JS bundle is faster, but Detox documents it as unstable for anything beyond
  // a simple app, and this screen mounts a native Mapbox view and fires Supabase
  // queries on mount. A few extra seconds per test is worth not chasing ghosts.
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
  });

  describe('Home screen', () => {
    it('renders the home screen', async () => {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(30000);
    });

    it('shows the favorites, contact and language controls', async () => {
      await expect(element(by.id('favorites-button'))).toBeVisible();
      await expect(element(by.id('contact-button'))).toBeVisible();
      await expect(element(by.id('language-switcher'))).toBeVisible();
    });
  });

  describe('Language switching', () => {
    it('switches to English and back to Dutch', async () => {
      await element(by.id('language-switcher')).tap();
      await waitFor(element(by.id('language-modal')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('language-option-en')).tap();

      // The suggestion form is the nearest screen with stable, translated copy.
      await element(by.id('contact-button')).tap();
      await waitFor(element(by.text('How can we help?')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('form-cancel')).tap();

      await element(by.id('language-switcher')).tap();
      await element(by.id('language-option-nl')).tap();

      await element(by.id('contact-button')).tap();
      await waitFor(element(by.text('Hoe kunnen we helpen?')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('form-cancel')).tap();
    });
  });

  describe('Suggestion form', () => {
    it('opens from the contact button and offers the three form types', async () => {
      await element(by.id('contact-button')).tap();

      await waitFor(element(by.id('suggestion-form-modal')))
        .toBeVisible()
        .withTimeout(5000);

      await expect(element(by.id('form-type-add'))).toBeVisible();
      await expect(element(by.id('form-type-change'))).toBeVisible();
      await expect(element(by.id('form-type-other'))).toBeVisible();
    });

    it('closes again when cancel is tapped', async () => {
      await element(by.id('contact-button')).tap();
      await waitFor(element(by.id('suggestion-form-modal')))
        .toBeVisible()
        .withTimeout(5000);

      await element(by.id('form-cancel')).tap();

      await waitFor(element(by.id('suggestion-form-modal')))
        .not.toBeVisible()
        .withTimeout(5000);
      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('Favorites', () => {
    it('opens the favorites screen and shows the empty state on a fresh install', async () => {
      await element(by.id('favorites-button')).tap();

      await waitFor(element(by.id('favorites-screen')))
        .toBeVisible()
        .withTimeout(10000);
      await waitFor(element(by.id('favorites-empty')))
        .toBeVisible()
        .withTimeout(10000);
      await expect(element(by.id('explore-button'))).toBeVisible();
    });

    it('returns to the home screen from the empty state', async () => {
      await element(by.id('favorites-button')).tap();
      await waitFor(element(by.id('explore-button')))
        .toBeVisible()
        .withTimeout(10000);

      await element(by.id('explore-button')).tap();

      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });
});
