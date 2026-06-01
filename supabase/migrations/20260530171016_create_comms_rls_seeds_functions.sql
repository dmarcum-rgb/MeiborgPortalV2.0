/*
  # Internal Communications App - RLS Policies, Seeds, and Functions (Part 2)

  ## Security Policies
  - departments: authenticated users can read; admins can write
  - profiles: users read own; admins read all; co-channel members read each other
  - channels: members read their channels; admins read all
  - channel_members: users read own; admins manage all
  - messages: channel members read/write; users delete own

  ## Seeded Data
  - 14 departments with distinct colors
  - One channel per department + General + Announcements

  ## Triggers & Functions
  - handle_new_user: creates a profile on auth signup; first user becomes admin
  - assign_user_channels: auto-adds user to General, Announcements, and department channel
  - Executive members get access to ALL channels
*/

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated avatar upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated avatar update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

-- ============================================================
-- DEPARTMENT RLS
-- ============================================================

CREATE POLICY "Authenticated users can read departments"
  ON departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert departments"
  ON departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update departments"
  ON departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- PROFILE RLS
-- ============================================================

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Channel co-members can read profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members cm1
      JOIN channel_members cm2 ON cm1.channel_id = cm2.channel_id
      WHERE cm1.user_id = auth.uid() AND cm2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "System can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- CHANNEL RLS
-- ============================================================

CREATE POLICY "Members can read their channels"
  ON channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all channels"
  ON channels FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert channels"
  ON channels FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- CHANNEL MEMBERS RLS
-- ============================================================

CREATE POLICY "Users can read own memberships"
  ON channel_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all memberships"
  ON channel_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert memberships"
  ON channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete memberships"
  ON channel_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- MESSAGES RLS
-- ============================================================

CREATE POLICY "Channel members can read messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Channel members can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- SEED DEPARTMENTS
-- ============================================================

INSERT INTO departments (name, color) VALUES
  ('AI', '#06b6d4'),
  ('Accounting', '#10b981'),
  ('Brokerage', '#f59e0b'),
  ('Sales', '#ef4444'),
  ('CSR', '#8b5cf6'),
  ('Logs', '#6b7280'),
  ('Dispatch', '#f97316'),
  ('Fleet', '#3b82f6'),
  ('MBI', '#ec4899'),
  ('Orbit Fuels', '#14b8a6'),
  ('3PL', '#84cc16'),
  ('Executive', '#eab308'),
  ('Enterprise', '#a855f7'),
  ('Warehouse', '#64748b')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED CHANNELS
-- ============================================================

INSERT INTO channels (name, description, department_id, channel_type)
SELECT
  d.name,
  d.name || ' department channel',
  d.id,
  'department'
FROM departments d
ON CONFLICT DO NOTHING;

INSERT INTO channels (name, description, department_id, channel_type)
VALUES
  ('General', 'Company-wide conversation and updates', null, 'general'),
  ('Announcements', 'Official company announcements', null, 'announcements')
ON CONFLICT DO NOTHING;

-- ============================================================
-- FUNCTION: Handle new auth user
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  admin_count int;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'admin';

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE WHEN admin_count = 0 THEN 'admin' ELSE 'user' END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FUNCTION: Auto-assign channels on department change
-- ============================================================

CREATE OR REPLACE FUNCTION assign_user_channels()
RETURNS TRIGGER AS $$
DECLARE
  exec_dept_id uuid;
BEGIN
  SELECT id INTO exec_dept_id FROM departments WHERE name = 'Executive';

  -- Always add to General + Announcements
  INSERT INTO channel_members (channel_id, user_id)
  SELECT id, NEW.id FROM channels WHERE channel_type IN ('general', 'announcements')
  ON CONFLICT DO NOTHING;

  -- Add to department channel
  IF NEW.department_id IS NOT NULL THEN
    INSERT INTO channel_members (channel_id, user_id)
    SELECT id, NEW.id FROM channels
    WHERE department_id = NEW.department_id AND channel_type = 'department'
    ON CONFLICT DO NOTHING;

    -- Executive dept → access all channels
    IF NEW.department_id = exec_dept_id THEN
      INSERT INTO channel_members (channel_id, user_id)
      SELECT id, NEW.id FROM channels
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Remove from old department channel when switching departments
  IF TG_OP = 'UPDATE' AND OLD.department_id IS NOT NULL
     AND (NEW.department_id IS NULL OR OLD.department_id != NEW.department_id) THEN
    DELETE FROM channel_members
    WHERE user_id = NEW.id
    AND channel_id IN (
      SELECT id FROM channels
      WHERE department_id = OLD.department_id AND channel_type = 'department'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_department_change ON profiles;
CREATE TRIGGER on_profile_department_change
  AFTER INSERT OR UPDATE OF department_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION assign_user_channels();
