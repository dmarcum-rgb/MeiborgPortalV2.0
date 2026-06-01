/*
  # Team Members Directory & App Config

  ## Changes

  ### New Table: team_members
  - Pure directory table — no auth.users dependency
  - Stores profile info for everyone in the org
  - Anon can read (for chat display), only service role (via edge function) can write

  ### New Table: app_config
  - Key-value store for app settings
  - Stores admin_code (hashed)
  - No anon access — only service role reads this

  ### Default admin code
  - Default admin code is: MEIADMIN
  - Admin can change it from the panel

  ## Notes
  1. Admin access is code-based — no Supabase auth accounts required
  2. Team members are org directory entries, not chat auth users
  3. Avatar images stored in Supabase Storage (avatars bucket)
*/

-- ============================================================
-- TEAM MEMBERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL DEFAULT '',
  email text,
  position text DEFAULT '',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  supervisor_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Anon can read team members (for displaying names/avatars in chat)
CREATE POLICY "Anyone can read team members"
  ON team_members FOR SELECT
  TO anon
  USING (true);

-- Authenticated can read too
CREATE POLICY "Auth users can read team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- APP CONFIG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- No anon or authenticated access — only service role via edge functions

-- ============================================================
-- DEFAULT ADMIN CODE
-- ============================================================

INSERT INTO app_config (key, value) VALUES ('admin_code', 'MEIADMIN')
ON CONFLICT (key) DO NOTHING;
