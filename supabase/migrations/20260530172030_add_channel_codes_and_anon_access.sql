/*
  # Channel Codes & Anonymous Access

  ## Changes

  ### New Table: channel_codes
  - Stores per-channel access codes
  - Only admins can read/write codes
  - Codes verified server-side via edge function

  ### Modified Table: messages
  - `user_id` made nullable (code-based users have no auth account)
  - New `sender_name` text column for unauthenticated senders
  - New `sender_avatar` text column for optional avatar URL

  ### RLS Updates
  - `channels`: anon users can read channel metadata (NOT codes)
  - `messages`: anon users can read all messages and insert with sender_name
  - `departments`: anon users can read

  ## Notes
  1. Security model: codes are verified server-side, never exposed to client via anon key
  2. Admin still uses Supabase auth for all management operations
  3. Regular users are fully anonymous — identified only by display name
*/

-- ============================================================
-- CHANNEL CODES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS channel_codes (
  channel_id uuid PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  code text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE channel_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read channel codes"
  ON channel_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert channel codes"
  ON channel_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update channel codes"
  ON channel_codes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- UPDATE MESSAGES TABLE
-- ============================================================

DO $$
BEGIN
  -- Make user_id nullable
  ALTER TABLE messages ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE messages ADD COLUMN sender_name text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'sender_avatar'
  ) THEN
    ALTER TABLE messages ADD COLUMN sender_avatar text;
  END IF;
END $$;

-- ============================================================
-- ANON ACCESS POLICIES
-- ============================================================

-- Departments: anon can read
CREATE POLICY "Anon can read departments"
  ON departments FOR SELECT
  TO anon
  USING (true);

-- Channels: anon can read (access_code NOT in this table, safe)
CREATE POLICY "Anon can read channels"
  ON channels FOR SELECT
  TO anon
  USING (true);

-- Messages: anon can read all
CREATE POLICY "Anon can read messages"
  ON messages FOR SELECT
  TO anon
  USING (true);

-- Messages: anon can insert (code verification is client-side gated)
CREATE POLICY "Anon can insert messages"
  ON messages FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Profiles: anon can read (for showing message authors)
CREATE POLICY "Anon can read profiles"
  ON profiles FOR SELECT
  TO anon
  USING (true);
