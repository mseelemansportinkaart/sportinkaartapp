--
-- PostgreSQL database dump
--

\restrict 2XxPsEo62jGo7rZQS509qX4tJfeB4G9hNXZEB7lSmbeXQhsw91RJYhBKyHCcbfz

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: add_capitalize_triggers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_capitalize_triggers() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  city_table TEXT;
  trigger_name TEXT;
BEGIN
  FOR city_table IN
    SELECT table_name FROM get_city_tables()
  LOOP
    trigger_name := 'trigger_capitalize_sports_' || city_table;

    -- Drop existing trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trigger_name, city_table);

    -- Create trigger for INSERT and UPDATE
    EXECUTE format('
      CREATE TRIGGER %I
      BEFORE INSERT OR UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION capitalize_sports()
    ', trigger_name, city_table);

    RAISE NOTICE 'Added capitalize trigger to table: %', city_table;
  END LOOP;
END;
$$;


--
-- Name: add_facilities_language_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_facilities_language_columns() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  city_table TEXT;
BEGIN
  FOR city_table IN
    SELECT table_name FROM get_city_tables()
  LOOP
    -- Add facilities_nl column if it doesn't exist
    EXECUTE format('
      ALTER TABLE %I
      ADD COLUMN IF NOT EXISTS facilities_nl TEXT[] DEFAULT ARRAY[]::TEXT[]
    ', city_table);

    -- Add facilities_en column if it doesn't exist
    EXECUTE format('
      ALTER TABLE %I
      ADD COLUMN IF NOT EXISTS facilities_en TEXT[] DEFAULT ARRAY[]::TEXT[]
    ', city_table);

    RAISE NOTICE 'Added facilities_nl and facilities_en columns to table: %', city_table;
  END LOOP;
END;
$$;


--
-- Name: add_sport_language_columns(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_sport_language_columns() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  city_table TEXT;
BEGIN
  FOR city_table IN
    SELECT table_name FROM get_city_tables()
  LOOP
    -- Add sport_nl column if it doesn't exist
    EXECUTE format('
      ALTER TABLE %I
      ADD COLUMN IF NOT EXISTS sport_nl TEXT[] DEFAULT ARRAY[]::TEXT[]
    ', city_table);

    -- Add sport_en column if it doesn't exist
    EXECUTE format('
      ALTER TABLE %I
      ADD COLUMN IF NOT EXISTS sport_en TEXT[] DEFAULT ARRAY[]::TEXT[]
    ', city_table);

    RAISE NOTICE 'Added sport_nl and sport_en columns to table: %', city_table;
  END LOOP;
END;
$$;


--
-- Name: capitalize_sports(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.capitalize_sports() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Capitalize each element in sport_nl array
  IF NEW.sport_nl IS NOT NULL THEN
    NEW.sport_nl := ARRAY(
      SELECT initcap(trim(unnest))
      FROM unnest(NEW.sport_nl)
      WHERE trim(unnest) != ''
    );
  END IF;

  -- Capitalize each element in sport_en array
  IF NEW.sport_en IS NOT NULL THEN
    NEW.sport_en := ARRAY(
      SELECT initcap(trim(unnest))
      FROM unnest(NEW.sport_en)
      WHERE trim(unnest) != ''
    );
  END IF;

  -- Capitalize each element in facilities_nl array
  IF NEW.facilities_nl IS NOT NULL THEN
    NEW.facilities_nl := ARRAY(
      SELECT initcap(trim(unnest))
      FROM unnest(NEW.facilities_nl)
      WHERE trim(unnest) != ''
    );
  END IF;

  -- Capitalize each element in facilities_en array
  IF NEW.facilities_en IS NOT NULL THEN
    NEW.facilities_en := ARRAY(
      SELECT initcap(trim(unnest))
      FROM unnest(NEW.facilities_en)
      WHERE trim(unnest) != ''
    );
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: get_city_tables(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_city_tables() RETURNS TABLE(table_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT t.table_name::TEXT
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name NOT IN ('admin_users', 'user_organizations', 'email_verifications')
    AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.table_name
        AND c.column_name = 'name'
    );
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Insert into admin_users table
  -- Extract name from email (before @) as default, or use 'New User' if extraction fails
  INSERT INTO public.admin_users (id, email, name, is_super_admin, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    FALSE,
    CASE
      WHEN NEW.email_confirmed_at IS NOT NULL THEN TRUE
      ELSE FALSE
    END
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate errors if user already exists

  RETURN NEW;
END;
$$;


--
-- Name: handle_organization_admin_added(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_organization_admin_added() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
BEGIN
  -- Set is_partner = TRUE for the organization that just got an admin assigned
  -- We use dynamic SQL because organizations are stored in city-specific tables
  EXECUTE format(
    'UPDATE %I SET is_partner = TRUE WHERE name = $1',
    NEW.city_table_name
  ) USING NEW.organization_name;

  RETURN NEW;
END;
$_$;


--
-- Name: handle_organization_admin_removed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_organization_admin_removed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  remaining_admins INTEGER;
BEGIN
  -- Count how many admins are still assigned to this organization
  SELECT COUNT(*) INTO remaining_admins
  FROM public.user_organizations
  WHERE city_table_name = OLD.city_table_name
    AND organization_name = OLD.organization_name;

  -- If no admins remain, set is_partner = FALSE
  IF remaining_admins = 0 THEN
    EXECUTE format(
      'UPDATE %I SET is_partner = FALSE WHERE name = $1',
      OLD.city_table_name
    ) USING OLD.organization_name;
  END IF;

  RETURN OLD;
END;
$_$;


--
-- Name: handle_user_email_confirmed(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_user_email_confirmed() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update email_verified when user confirms email in Supabase Auth
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.admin_users
    SET email_verified = TRUE
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_super_admin = TRUE
  );
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: sync_all_organization_partner_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_all_organization_partner_status() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $_$
DECLARE
  city_table RECORD;
  org_record RECORD;
  has_admin BOOLEAN;
BEGIN
  -- Loop through all city tables
  FOR city_table IN SELECT table_name FROM get_city_tables() LOOP
    -- For each organization in the city table, check if it has an admin
    FOR org_record IN EXECUTE format('SELECT name FROM %I WHERE name IS NOT NULL', city_table.table_name) LOOP
      -- Check if this organization has any admin assigned
      SELECT EXISTS (
        SELECT 1 FROM public.user_organizations
        WHERE city_table_name = city_table.table_name
          AND organization_name = org_record.name
      ) INTO has_admin;

      -- Update is_partner accordingly
      EXECUTE format(
        'UPDATE %I SET is_partner = $1 WHERE name = $2',
        city_table.table_name
      ) USING has_admin, org_record.name;
    END LOOP;
  END LOOP;
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: lelystad; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lelystad (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: TABLE lelystad; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.lelystad IS 'Locations in Lelystad';


--
-- Name: Lelystad_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lelystad ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Lelystad_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: almere; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.almere (
    id bigint NOT NULL,
    name text,
    address text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    description_en text,
    facilities_en text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    sport_en text[] DEFAULT '{Unknown}'::text[] NOT NULL,
    cost_structure text
);


--
-- Name: TABLE almere; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.almere IS 'Almere locations';


--
-- Name: Locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.almere ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Locations_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: regions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.regions (
    id bigint NOT NULL,
    region_name text,
    slug text,
    is_active boolean DEFAULT false,
    is_concept boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    latitude real,
    longitude real
);


--
-- Name: TABLE regions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.regions IS 'Different regions with databases';


--
-- Name: Regions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.regions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Regions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    is_super_admin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    email_verified boolean DEFAULT false,
    password_set boolean DEFAULT false,
    organization_ids bigint[]
);


--
-- Name: COLUMN admin_users.password_set; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.admin_users.password_set IS 'Tracks whether the user has set their password. Used to determine if invited users should be redirected to password setup.';


--
-- Name: bussum; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bussum (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: bussum_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.bussum ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.bussum_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: dronten; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dronten (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: dronten_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.dronten ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.dronten_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verifications (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    verification_code text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    verified boolean DEFAULT false
);


--
-- Name: email_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.email_verifications ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.email_verifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: emmeloord; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emmeloord (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: emmeloord_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.emmeloord ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.emmeloord_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: hilversum; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hilversum (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: hilversum_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.hilversum ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.hilversum_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: huizen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.huizen (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: huizen_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.huizen ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.huizen_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: user_organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_organizations (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    city_table_name text NOT NULL,
    organization_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.user_organizations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.user_organizations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: zeewolde; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zeewolde (
    id bigint NOT NULL,
    name text,
    sport_nl text[] DEFAULT '{"Niet bekend"}'::text[] NOT NULL,
    address text,
    target_groups text,
    website text,
    email text,
    phone text,
    cost_range text,
    description_nl text,
    membership_available boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    is_partner boolean DEFAULT false,
    is_active boolean DEFAULT true,
    main_image_url text,
    facilities_nl text[] DEFAULT '{"Niet bekend"}'::text[],
    sport_en text[] DEFAULT '{Unknown}'::text[],
    facilities_en text[] DEFAULT '{Unknown}'::text[],
    latitude double precision,
    longitude double precision,
    google_place_id text,
    source text DEFAULT 'manual'::text,
    rating numeric(2,1),
    description_en text,
    cost_structure text
);


--
-- Name: zeewolde_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.zeewolde ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.zeewolde_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: regions Regions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.regions
    ADD CONSTRAINT "Regions_pkey" PRIMARY KEY (id);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: almere almere_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.almere
    ADD CONSTRAINT almere_pkey PRIMARY KEY (id);


--
-- Name: bussum bussum_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bussum
    ADD CONSTRAINT bussum_google_place_id_key UNIQUE (google_place_id);


--
-- Name: bussum bussum_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bussum
    ADD CONSTRAINT bussum_pkey PRIMARY KEY (id);


--
-- Name: dronten dronten_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dronten
    ADD CONSTRAINT dronten_google_place_id_key UNIQUE (google_place_id);


--
-- Name: dronten dronten_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dronten
    ADD CONSTRAINT dronten_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);


--
-- Name: emmeloord emmeloord_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emmeloord
    ADD CONSTRAINT emmeloord_google_place_id_key UNIQUE (google_place_id);


--
-- Name: emmeloord emmeloord_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emmeloord
    ADD CONSTRAINT emmeloord_pkey PRIMARY KEY (id);


--
-- Name: hilversum hilversum_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hilversum
    ADD CONSTRAINT hilversum_google_place_id_key UNIQUE (google_place_id);


--
-- Name: hilversum hilversum_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hilversum
    ADD CONSTRAINT hilversum_pkey PRIMARY KEY (id);


--
-- Name: huizen huizen_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.huizen
    ADD CONSTRAINT huizen_google_place_id_key UNIQUE (google_place_id);


--
-- Name: huizen huizen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.huizen
    ADD CONSTRAINT huizen_pkey PRIMARY KEY (id);


--
-- Name: lelystad lelystad_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lelystad
    ADD CONSTRAINT lelystad_google_place_id_key UNIQUE (google_place_id);


--
-- Name: lelystad lelystad_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lelystad
    ADD CONSTRAINT lelystad_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_pkey PRIMARY KEY (id);


--
-- Name: user_organizations user_organizations_user_id_city_table_name_organization_nam_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_city_table_name_organization_nam_key UNIQUE (user_id, city_table_name, organization_name);


--
-- Name: zeewolde zeewolde_google_place_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zeewolde
    ADD CONSTRAINT zeewolde_google_place_id_key UNIQUE (google_place_id);


--
-- Name: zeewolde zeewolde_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zeewolde
    ADD CONSTRAINT zeewolde_pkey PRIMARY KEY (id);


--
-- Name: bussum_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bussum_google_place_id_idx ON public.bussum USING btree (google_place_id);


--
-- Name: dronten_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dronten_google_place_id_idx ON public.dronten USING btree (google_place_id);


--
-- Name: emmeloord_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX emmeloord_google_place_id_idx ON public.emmeloord USING btree (google_place_id);


--
-- Name: hilversum_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hilversum_google_place_id_idx ON public.hilversum USING btree (google_place_id);


--
-- Name: huizen_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX huizen_google_place_id_idx ON public.huizen USING btree (google_place_id);


--
-- Name: idx_almere_google_place_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_almere_google_place_id ON public.almere USING btree (google_place_id);


--
-- Name: idx_lelystad_google_place_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lelystad_google_place_id ON public.lelystad USING btree (google_place_id);


--
-- Name: zeewolde_google_place_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zeewolde_google_place_id_idx ON public.zeewolde USING btree (google_place_id);


--
-- Name: user_organizations on_organization_admin_added; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_organization_admin_added AFTER INSERT ON public.user_organizations FOR EACH ROW EXECUTE FUNCTION public.handle_organization_admin_added();


--
-- Name: user_organizations on_organization_admin_removed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_organization_admin_removed AFTER DELETE ON public.user_organizations FOR EACH ROW EXECUTE FUNCTION public.handle_organization_admin_removed();


--
-- Name: almere trigger_capitalize_sports_almere; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_almere BEFORE INSERT OR UPDATE ON public.almere FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: bussum trigger_capitalize_sports_bussum; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_bussum BEFORE INSERT OR UPDATE ON public.bussum FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: dronten trigger_capitalize_sports_dronten; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_dronten BEFORE INSERT OR UPDATE ON public.dronten FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: emmeloord trigger_capitalize_sports_emmeloord; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_emmeloord BEFORE INSERT OR UPDATE ON public.emmeloord FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: hilversum trigger_capitalize_sports_hilversum; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_hilversum BEFORE INSERT OR UPDATE ON public.hilversum FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: huizen trigger_capitalize_sports_huizen; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_huizen BEFORE INSERT OR UPDATE ON public.huizen FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: lelystad trigger_capitalize_sports_lelystad; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_lelystad BEFORE INSERT OR UPDATE ON public.lelystad FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: zeewolde trigger_capitalize_sports_zeewolde; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_capitalize_sports_zeewolde BEFORE INSERT OR UPDATE ON public.zeewolde FOR EACH ROW EXECUTE FUNCTION public.capitalize_sports();


--
-- Name: admin_users admin_users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: email_verifications email_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: user_organizations user_organizations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_organizations
    ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.admin_users(id) ON DELETE CASCADE;


--
-- Name: almere Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.almere FOR SELECT USING (true);


--
-- Name: bussum Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.bussum FOR SELECT USING (true);


--
-- Name: dronten Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.dronten FOR SELECT USING (true);


--
-- Name: emmeloord Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.emmeloord FOR SELECT USING (true);


--
-- Name: hilversum Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.hilversum FOR SELECT USING (true);


--
-- Name: huizen Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.huizen FOR SELECT USING (true);


--
-- Name: lelystad Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.lelystad FOR SELECT USING (true);


--
-- Name: regions Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.regions FOR SELECT USING (true);


--
-- Name: zeewolde Enable read access for all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Enable read access for all users" ON public.zeewolde FOR SELECT USING (true);


--
-- Name: dronten Org admin can change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admin can change" ON public.dronten FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'dronten'::text) AND (uo.organization_name = dronten.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'dronten'::text) AND (uo.organization_name = dronten.name) AND (uo.user_id = auth.uid())))));


--
-- Name: emmeloord Org admin can change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admin can change" ON public.emmeloord FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'emmeloord'::text) AND (uo.organization_name = emmeloord.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'emmeloord'::text) AND (uo.organization_name = emmeloord.name) AND (uo.user_id = auth.uid())))));


--
-- Name: almere Org admin can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admin can update" ON public.almere FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'almere'::text) AND (uo.organization_name = almere.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'almere'::text) AND (uo.organization_name = almere.name) AND (uo.user_id = auth.uid())))));


--
-- Name: bussum Org admin can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org admin can update" ON public.bussum FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'bussum'::text) AND (uo.organization_name = bussum.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'bussum'::text) AND (uo.organization_name = bussum.name) AND (uo.user_id = auth.uid())))));


--
-- Name: email_verifications Service role can manage all verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage all verifications" ON public.email_verifications USING (true);


--
-- Name: user_organizations Super admins can delete user organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can delete user organizations" ON public.user_organizations FOR DELETE USING (public.is_super_admin());


--
-- Name: admin_users Super admins can delete users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can delete users" ON public.admin_users FOR DELETE USING (public.is_super_admin());


--
-- Name: user_organizations Super admins can insert user organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can insert user organizations" ON public.user_organizations FOR INSERT WITH CHECK (public.is_super_admin());


--
-- Name: admin_users Super admins can insert users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can insert users" ON public.admin_users FOR INSERT WITH CHECK (public.is_super_admin());


--
-- Name: user_organizations Super admins can update user organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can update user organizations" ON public.user_organizations FOR UPDATE USING (public.is_super_admin());


--
-- Name: admin_users Super admins can update users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can update users" ON public.admin_users FOR UPDATE USING (public.is_super_admin());


--
-- Name: user_organizations Super admins can view all user organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all user organizations" ON public.user_organizations FOR SELECT USING (public.is_super_admin());


--
-- Name: admin_users Super admins can view all users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can view all users" ON public.admin_users FOR SELECT USING (public.is_super_admin());


--
-- Name: admin_users Users can update their own password_set flag; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own password_set flag" ON public.admin_users FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: user_organizations Users can view their own organizations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own organizations" ON public.user_organizations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_users Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.admin_users FOR SELECT USING ((auth.uid() = id));


--
-- Name: email_verifications Users can view their own verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own verifications" ON public.email_verifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

--
-- Name: almere; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.almere ENABLE ROW LEVEL SECURITY;

--
-- Name: bussum; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bussum ENABLE ROW LEVEL SECURITY;

--
-- Name: dronten; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.dronten ENABLE ROW LEVEL SECURITY;

--
-- Name: email_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: emmeloord; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.emmeloord ENABLE ROW LEVEL SECURITY;

--
-- Name: hilversum; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hilversum ENABLE ROW LEVEL SECURITY;

--
-- Name: huizen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.huizen ENABLE ROW LEVEL SECURITY;

--
-- Name: lelystad; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lelystad ENABLE ROW LEVEL SECURITY;

--
-- Name: hilversum org admin can change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org admin can change" ON public.hilversum FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'hilversum'::text) AND (uo.organization_name = hilversum.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'hilversum'::text) AND (uo.organization_name = hilversum.name) AND (uo.user_id = auth.uid())))));


--
-- Name: huizen org admin can change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org admin can change" ON public.huizen FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'huizen'::text) AND (uo.organization_name = huizen.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'huizen'::text) AND (uo.organization_name = huizen.name) AND (uo.user_id = auth.uid())))));


--
-- Name: lelystad org admin can change; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org admin can change" ON public.lelystad FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'lelystad'::text) AND (uo.organization_name = lelystad.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'lelystad'::text) AND (uo.organization_name = lelystad.name) AND (uo.user_id = auth.uid())))));


--
-- Name: zeewolde org admin can update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "org admin can update" ON public.zeewolde FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'zeewolde'::text) AND (uo.organization_name = zeewolde.name) AND (uo.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_organizations uo
  WHERE ((uo.city_table_name = 'zeewolde'::text) AND (uo.organization_name = zeewolde.name) AND (uo.user_id = auth.uid())))));


--
-- Name: regions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: zeewolde; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zeewolde ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 2XxPsEo62jGo7rZQS509qX4tJfeB4G9hNXZEB7lSmbeXQhsw91RJYhBKyHCcbfz
