/*
  # Add org_level column to team_members

  Computes each member's hierarchy depth (1-based) from the org tree:
    - CEO (no supervisor) = level 1
    - Direct reports to CEO = level 2
    - Their reports = level 3, etc.

  MeiGuy access will be restricted to level 3 and above (levels 1, 2, 3).
*/

ALTER TABLE team_members ADD COLUMN IF NOT EXISTS org_level integer;

-- Populate org_level using a recursive CTE
WITH RECURSIVE org_tree AS (
  -- Root nodes (no supervisor)
  SELECT id, 1 AS lvl
  FROM team_members
  WHERE supervisor_id IS NULL

  UNION ALL

  SELECT tm.id, ot.lvl + 1
  FROM team_members tm
  JOIN org_tree ot ON tm.supervisor_id = ot.id
)
UPDATE team_members
SET org_level = ot.lvl
FROM org_tree ot
WHERE team_members.id = ot.id;
