# Project notes for Claude

## Workflow

- **No pull requests.** This is a solo project (single developer). Do not open
  PRs. When work on a branch is complete and approved, merge it directly into
  `main` and push.

## Backend

- Supabase Postgres. Config (URL + publishable key) is in `lib/supabase.js`.
- The database schema is version-controlled in `supabase/schema.sql`; see
  `supabase/README.md` for regenerating it and for disaster recovery.
- The app reads with the anonymous publishable key, relying on the
  `"Enable read access for all users"` RLS policies on `regions` and the
  per-city location tables.

## Checks

- `npm run validate` runs lint + typecheck + tests. Run it before merging.

## E2E (Detox)

- The suite is `__tests__/e2e/smoke.test.ts` and it is deliberately narrow: the
  always-on-screen chrome, language switching, the suggestion form, and the
  favorites empty state. It avoids anything that depends on Supabase data or on
  Mapbox finishing a tile/marker render, so it can stay green in CI.
- `ios/` and `android/` are **not** committed (managed Expo project), so a
  native project has to be generated before any Detox build:

      DETOX_BUILD=1 npx expo prebuild --platform ios
      DETOX_BUILD=1 npx expo prebuild --platform android

  `DETOX_BUILD=1` makes `app.config.js` apply `plugins/withDetox.js`, which adds
  the native Detox wiring prebuild doesn't generate (instrumentation runner,
  `DetoxTest.java`, the Detox maven repo, cleartext traffic to the emulator
  host, proguard rules). It is gated on the env var so none of that lands in a
  build that ships to users.
- `plugins/withDetox.js` is a vendored equivalent of `@config-plugins/detox`,
  which can't be depended on directly: it declares `peer expo@^53` and this
  project is on Expo 54, so `npm ci` fails with ERESOLVE.
- CI runs against the newest simulator the runner's Xcode ships (picked at
  runtime into `DETOX_IOS_DEVICE`) and, on Android, against whatever emulator
  `reactivecircus/android-emulator-runner` has booted — hence the
  `android.att.release` (attached device) configuration rather than
  `android.emu.*`, which would need the AVD's name.
- A Mapbox download token is **not** needed: `@rnmapbox/maps` v10.2.x reads
  `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` from the environment only when set, and Mapbox
  has dropped the download-token requirement. The `RNMapboxMapsDownloadToken`
  plugin prop is deprecated and bakes the secret into the Podfile — don't use it.
- `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time, so they
  must be present during `detox build`, not `detox test`.
