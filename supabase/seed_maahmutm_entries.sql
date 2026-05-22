-- Seed historical time entries for maahmutm@gmail.com
-- Run this in Supabase Dashboard → SQL Editor
-- Times are stored as UTC; adjust the offset if your local timezone differs

DO $$
DECLARE
  v_user_id      uuid;
  v_workspace_id uuid;
  v_project_id   uuid;
  v_tag_id       uuid;
  v_entry_id     uuid;
BEGIN

  -- 1. Resolve user
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'maahmutm@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User maahmutm@gmail.com not found. Make sure the account exists.';
  END IF;

  -- 2. Use their first workspace (or create one)
  SELECT w.id INTO v_workspace_id
  FROM workspaces w
  JOIN workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = v_user_id
  ORDER BY w.created_at
  LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, owner_id)
    VALUES ('My Workspace', v_user_id)
    RETURNING id INTO v_workspace_id;

    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'owner');
  END IF;

  -- 3. Get or create project "Лука Месец Април"
  SELECT id INTO v_project_id
  FROM projects
  WHERE user_id = v_user_id AND name = 'Лука Месец Април';

  IF v_project_id IS NULL THEN
    INSERT INTO projects (user_id, name, color)
    VALUES (v_user_id, 'Лука Месец Април', '#008080')
    RETURNING id INTO v_project_id;
  END IF;

  -- 4. Get or create tag "Лука"
  SELECT id INTO v_tag_id
  FROM tags
  WHERE user_id = v_user_id AND name = 'Лука';

  IF v_tag_id IS NULL THEN
    INSERT INTO tags (user_id, name, color)
    VALUES (v_user_id, 'Лука', '#0ea5e9')
    RETURNING id INTO v_tag_id;
  END IF;

  -- ── Insert entries ────────────────────────────────────────────────────────

  -- Entry 1: Yesterday (May 21, 2026) · 02:26:34 · Unpaid
  INSERT INTO time_entries (user_id, project_id, description, started_at, stopped_at, duration, billable)
  VALUES (v_user_id, v_project_id, '', '2026-05-21 15:15:00+00', '2026-05-21 17:41:34+00', 8794, false)
  RETURNING id INTO v_entry_id;
  INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (v_entry_id, v_tag_id);

  -- Entry 2: Wed May 20, 2026 · 01:40:00 · Unpaid
  INSERT INTO time_entries (user_id, project_id, description, started_at, stopped_at, duration, billable)
  VALUES (v_user_id, v_project_id, '', '2026-05-20 18:08:00+00', '2026-05-20 19:48:00+00', 6000, false)
  RETURNING id INTO v_entry_id;
  INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (v_entry_id, v_tag_id);

  -- Entry 3: Wed May 13, 2026 · 03:10:44 · Unpaid
  INSERT INTO time_entries (user_id, project_id, description, started_at, stopped_at, duration, billable)
  VALUES (v_user_id, v_project_id, '', '2026-05-13 01:37:00+00', '2026-05-13 04:47:44+00', 11444, false)
  RETURNING id INTO v_entry_id;
  INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (v_entry_id, v_tag_id);

  -- Entry 4: Sat Apr 11, 2026 · 02:47:56 · Paid/Billable
  INSERT INTO time_entries (user_id, project_id, description, started_at, stopped_at, duration, billable)
  VALUES (v_user_id, v_project_id, '', '2026-04-11 16:51:00+00', '2026-04-11 19:38:56+00', 10076, true)
  RETURNING id INTO v_entry_id;
  INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (v_entry_id, v_tag_id);

  RAISE NOTICE 'Done! Inserted 4 entries for workspace %, project %, tag %',
    v_workspace_id, v_project_id, v_tag_id;

END $$;
