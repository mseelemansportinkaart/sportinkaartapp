# Supabase

The app talks to a Supabase Postgres database. Region metadata lives in
`public.regions`; each active/concept region has its own locations table named
after the city (`almere`, `lelystad`, `bussum`, `dronten`, `emmeloord`,
`hilversum`, `huizen`, `zeewolde`). The app reads with the anonymous
publishable key, which works because every one of those tables has an
`"Enable read access for all users"` SELECT policy.

The connection URL and publishable key are set in `lib/supabase.js`.

## `schema.sql`

`schema.sql` is a `pg_dump --schema-only` of the `public` schema (tables,
sequences, functions, triggers, indexes, constraints, RLS policies). It is the
authoritative record of the database structure — keep it in version control so
the schema can always be rebuilt, even if the hosted project is lost.

Regenerate after any schema change:

```bash
PGPASSWORD='<db-password>' pg_dump \
  --schema-only --schema=public --no-owner --no-privileges \
  "postgresql://postgres.<project-ref>@<pooler-host>:5432/postgres" \
  > supabase/schema.sql
```

## Recreating the database in a new project

1. Create a new Supabase project (Pro plan avoids the free-tier auto-pause that
   causes data loss).
2. Restore structure: `psql -d "<session-pooler-connection-string>" -f supabase/schema.sql`
   (a flood of "already exists" notices is normal on a fresh Supabase project).
3. Load data from a `pg_dump`/dashboard backup if you have one.
4. Update `supabaseUrl` and `supabaseAnonKey` in `lib/supabase.js`.

## Avoiding another outage

Free projects pause after ~7 days idle and become **unrecoverable after 90 days
paused**. Keep the project on a paid plan, or download a fresh dashboard backup
periodically.
