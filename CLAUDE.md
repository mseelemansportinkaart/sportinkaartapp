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
