-- Supabase Database Schema for Shortify URL Shortener
-- Follows Supabase Security & Postgres Best Practices

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.url_mappings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    short_code TEXT NOT NULL UNIQUE,
    long_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    click_count INT NOT NULL DEFAULT 0
);

-- 2. Create index on short_code for fast URL resolution
CREATE INDEX IF NOT EXISTS idx_url_mappings_short_code ON public.url_mappings(short_code);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.url_mappings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Drop older policy versions if recreating
DROP POLICY IF EXISTS "Allow public read access to active short links" ON public.url_mappings;
DROP POLICY IF EXISTS "Allow public insert of short links" ON public.url_mappings;
DROP POLICY IF EXISTS "Allow click count increment" ON public.url_mappings;
DROP POLICY IF EXISTS "Allow update of short links" ON public.url_mappings;
DROP POLICY IF EXISTS "Allow delete of short links" ON public.url_mappings;

-- Allow anyone (anon + authenticated) to select active, non-expired short links
CREATE POLICY "Allow public read access to active short links"
ON public.url_mappings
FOR SELECT
TO anon, authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Allow anyone (anon + authenticated) to create short links
CREATE POLICY "Allow public insert of short links"
ON public.url_mappings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Allow anyone (anon + authenticated) to update short links (click counts, deactivation)
CREATE POLICY "Allow update of short links"
ON public.url_mappings
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Allow anyone (anon + authenticated) to delete short links
CREATE POLICY "Allow delete of short links"
ON public.url_mappings
FOR DELETE
TO anon, authenticated
USING (true);
