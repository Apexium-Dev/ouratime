-- ── Fix stale pending rows blocking re-invites ───────────────────────────────
--
-- Problems fixed:
-- 1. send_project_invite / request_project_join block on ANY project_members row
--    including orphaned `pending` rows left over from cancelled notifications.
-- 2. cancel_invite only matches sender_id = auth.uid(), so a project owner
--    who didn't send the original invite couldn't cancel it.

-- ── Patch send_project_invite ─────────────────────────────────────────────────
-- Drop first because return type changes VOID → TEXT
DROP FUNCTION IF EXISTS public.send_project_invite(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.send_project_invite(
  p_project_id UUID,
  p_email      TEXT,
  p_role       TEXT DEFAULT 'member'
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_target UUID; v_member UUID;
BEGIN
  -- Auth check: must be project owner or active admin
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND status = 'active'
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Find user by email
  SELECT u.id INTO v_target FROM auth.users u WHERE lower(u.email) = lower(p_email) LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Clean up any orphaned pending rows whose notification is no longer pending
  -- (cancelled / declined invites that left behind a dangling project_members row)
  DELETE FROM public.project_members pm
  WHERE pm.project_id = p_project_id
    AND pm.user_id    = v_target
    AND pm.status     = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.member_row_id = pm.id AND n.status = 'pending'
    );

  -- Block if already an active member
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = v_target AND status = 'active'
  ) THEN RETURN 'already_member'; END IF;

  -- Block if a live pending invite already exists
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = v_target AND status = 'pending'
  ) THEN RETURN 'already_pending'; END IF;

  -- Create pending membership + notification
  INSERT INTO public.project_members (project_id, user_id, role, invited_by, status)
  VALUES (p_project_id, v_target, p_role, auth.uid(), 'pending')
  RETURNING id INTO v_member;

  INSERT INTO public.notifications (recipient_id, sender_id, type, project_id, role, member_row_id)
  VALUES (v_target, auth.uid(), 'project_invite', p_project_id, p_role, v_member);

  RETURN 'invited';
END;
$$;

-- ── Patch cancel_invite ───────────────────────────────────────────────────────
-- Allow any project owner or active admin to cancel, not just the original sender.
CREATE OR REPLACE FUNCTION public.cancel_invite(p_notification_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_member UUID; v_project UUID;
BEGIN
  SELECT n.member_row_id, n.project_id INTO v_member, v_project
  FROM public.notifications n
  WHERE n.id     = p_notification_id
    AND n.type   = 'project_invite'
    AND n.status = 'pending'
    AND (
      n.sender_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.projects WHERE id = n.project_id AND user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = n.project_id AND user_id = auth.uid()
          AND role IN ('owner','admin') AND status = 'active'
      )
    );
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found or not authorized'; END IF;

  UPDATE public.notifications SET status = 'cancelled' WHERE id = p_notification_id;
  -- Only delete if still pending (guard against double-cancel)
  DELETE FROM public.project_members WHERE id = v_member AND status = 'pending';
END;
$$;

-- ── Patch request_project_join ────────────────────────────────────────────────
-- Same stale-row cleanup before the existence check.
CREATE OR REPLACE FUNCTION public.request_project_join(p_invite_token UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id UUID; v_owner UUID; v_member UUID;
BEGIN
  SELECT id, user_id INTO v_project_id, v_owner
  FROM public.projects WHERE invite_token = p_invite_token;
  IF v_project_id IS NULL THEN RAISE EXCEPTION 'Invalid invite link'; END IF;

  -- Clean up orphaned pending rows (cancelled/declined invites)
  DELETE FROM public.project_members pm
  WHERE pm.project_id = v_project_id
    AND pm.user_id    = auth.uid()
    AND pm.status     = 'pending'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.member_row_id = pm.id AND n.status = 'pending'
    );

  -- Block if active member
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = auth.uid() AND status = 'active'
  ) THEN RETURN 'already_member'; END IF;

  -- Block if already has a live pending request/invite
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = v_project_id AND user_id = auth.uid() AND status = 'pending'
  ) THEN RETURN 'already_pending'; END IF;

  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (v_project_id, auth.uid(), 'member', 'pending')
  RETURNING id INTO v_member;

  INSERT INTO public.notifications (recipient_id, sender_id, type, project_id, role, member_row_id)
  VALUES (v_owner, auth.uid(), 'join_request', v_project_id, 'member', v_member);

  RETURN 'requested';
END;
$$;
