/*
  # Create portal_resources table

  ## Summary
  Creates a table for Company Portal documents and resources that employees can access.
  Admins upload items (handbooks, dental cards, forms, etc.) and employees can view/download them.

  ## New Tables
  - `portal_resources`
    - `id` (uuid, primary key)
    - `title` (text) — display name of the resource
    - `description` (text) — optional subtitle/description
    - `category` (text) — e.g. "HR", "Benefits", "Policies", "Forms"
    - `file_url` (text) — public URL of the uploaded file
    - `file_name` (text) — original filename shown to users
    - `file_type` (text) — mime type hint, e.g. "application/pdf"
    - `sort_order` (int) — controls display ordering within a category
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Anyone (anon) can SELECT (read) resources — employees don't log in
  - No public insert/update/delete — managed via admin edge function
*/

CREATE TABLE IF NOT EXISTS portal_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General',
  file_url text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE portal_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view portal resources"
  ON portal_resources FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS portal_resources_category_idx ON portal_resources (category, sort_order);
