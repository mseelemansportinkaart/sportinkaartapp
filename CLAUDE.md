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

## Known follow-ups / TODO

- **E2E CI not wired up.** The `e2e-ios` / `e2e-android` Detox jobs in
  `.github/workflows/test.yml` are marked `continue-on-error` (non-blocking)
  because they can't pass as written: this is a managed Expo project with no
  committed `ios/`/`android/` directories, and the jobs run `pod install` /
  `detox build` without first generating the native projects. To make them
  real: add `npx expo prebuild --platform <ios|android>` before the build step
  in each job, provide a Mapbox download token for the `@rnmapbox/maps` pods
  (e.g. `RNMapboxMapsDownloadToken` / `.netrc`), and confirm the simulator/
  emulator boot. Remove `continue-on-error` once they pass. The Detox tests
  themselves live in `__tests__/e2e/` and can be run locally.

- **Suggestion-form email (RESEND_API_KEY).** `app/api/send-suggestion+api.ts`
  needs `RESEND_API_KEY` set in the environment where the Expo Router API route
  is hosted (the route runs server-side, not in the app bundle). Without it the
  form returns an error but the app doesn't crash.
