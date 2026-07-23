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

// Cold start of a release build on a freshly installed simulator/emulator is
// slow — observed at ~57s on a CI iOS runner — so the first wait of each test
// has to be generous. Later waits are for transitions, not launches.
const LAUNCH_TIMEOUT = 120000;
const TRANSITION_TIMEOUT = 15000;

/**
 * Opens the suggestion form and waits for it to be interactive.
 *
 * Deliberately asserts on a button inside the form rather than on the container:
 * the form is a `presentationStyle="pageSheet"` Modal, which iOS hosts in a
 * separate window where Detox does not match the wrapper's testID — even though
 * everything inside it matches fine.
 */
async function openSuggestionForm() {
  await element(by.id('contact-button')).tap();
  await waitFor(element(by.id('form-type-add')))
    .toBeVisible()
    .withTimeout(TRANSITION_TIMEOUT);
}

/**
 * Dismisses the suggestion form.
 *
 * The cancel button sits below the fold of the form's ScrollView, and Detox
 * refuses to tap a view that is less than 75% visible, so it has to be scrolled
 * into view first.
 */
async function closeSuggestionForm() {
  await waitFor(element(by.id('form-cancel')))
    .toBeVisible()
    .whileElement(by.id('suggestion-form-scroll'))
    .scroll(200, 'down');
  await element(by.id('form-cancel')).tap();
}

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
        .withTimeout(LAUNCH_TIMEOUT);
    });

    it('shows the favorites, contact and language controls', async () => {
      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(LAUNCH_TIMEOUT);

      await expect(element(by.id('favorites-button'))).toBeVisible();
      await expect(element(by.id('contact-button'))).toBeVisible();
      await expect(element(by.id('language-switcher'))).toBeVisible();
    });
  });

  describe('Language switching', () => {
    it('switches to English and back to Dutch', async () => {
      await waitFor(element(by.id('language-switcher')))
        .toBeVisible()
        .withTimeout(LAUNCH_TIMEOUT);

      await element(by.id('language-switcher')).tap();
      await waitFor(element(by.id('language-modal')))
        .toBeVisible()
        .withTimeout(TRANSITION_TIMEOUT);
      await element(by.id('language-option-en')).tap();

      // The suggestion form is the nearest screen with stable, translated copy.
      await openSuggestionForm();
      await expect(element(by.text('How can we help?'))).toBeVisible();
      await closeSuggestionForm();

      await element(by.id('language-switcher')).tap();
      await waitFor(element(by.id('language-modal')))
        .toBeVisible()
        .withTimeout(TRANSITION_TIMEOUT);
      await element(by.id('language-option-nl')).tap();

      await openSuggestionForm();
      await expect(element(by.text('Hoe kunnen we helpen?'))).toBeVisible();
      await closeSuggestionForm();
    });
  });

  describe('Suggestion form', () => {
    it('opens from the contact button and offers the three form types', async () => {
      await waitFor(element(by.id('contact-button')))
        .toBeVisible()
        .withTimeout(LAUNCH_TIMEOUT);

      await openSuggestionForm();

      await expect(element(by.id('form-type-add'))).toBeVisible();
      await expect(element(by.id('form-type-change'))).toBeVisible();
      await expect(element(by.id('form-type-other'))).toBeVisible();
    });

    it('closes again when cancel is tapped', async () => {
      await waitFor(element(by.id('contact-button')))
        .toBeVisible()
        .withTimeout(LAUNCH_TIMEOUT);

      await openSuggestionForm();
      await closeSuggestionForm();

      await waitFor(element(by.id('form-type-add')))
        .not.toBeVisible()
        .withTimeout(TRANSITION_TIMEOUT);
      await expect(element(by.id('home-screen'))).toBeVisible();
    });
  });

  describe('Favorites', () => {
    it('opens the favorites screen and shows the empty state on a fresh install', async () => {
      await waitFor(element(by.id('favorites-button')))
        .toBeVisible()
        .withTimeout(LAUNCH_TIMEOUT);

      await element(by.id('favorites-button')).tap();

      await waitFor(element(by.id('favorites-empty')))
        .toBeVisible()
        .withTimeout(TRANSITION_TIMEOUT);
      await expect(element(by.id('explore-button'))).toBeVisible();
    });

    it('returns to the home screen from the empty state', async () => {
      await waitFor(element(by.id('favorites-button')))
        .toBeVisible()
        .withTimeout(LAUNCH_TIMEOUT);

      await element(by.id('favorites-button')).tap();
      await waitFor(element(by.id('explore-button')))
        .toBeVisible()
        .withTimeout(TRANSITION_TIMEOUT);

      await element(by.id('explore-button')).tap();

      await waitFor(element(by.id('home-screen')))
        .toBeVisible()
        .withTimeout(TRANSITION_TIMEOUT);
    });
  });
});
