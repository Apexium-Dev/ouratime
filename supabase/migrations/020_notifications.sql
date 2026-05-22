-- ── Invite token on projects ──────────────────────────────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS invite_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- Backfill any nulls (existing rows pre-migration)
UPDATE public.projects SET invite_token = gen_random_uuid() WHERE invite_token IS NULL;

-- ── Notifications (inbox) table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL CHECK (type IN ('project_invite', 'join_request')),
  project_id    UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  member_row_id UUID,
  role          TEXT DEFAULT 'member',
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','accepted','declined','cancelled')),
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipients see their own notifications
CREATE POLICY "own notifications"
  ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

-- Recipients can update their own (mark read, accept/decline via app column — but we use RPCs)
CREATE POLICY "update own notifications"
  ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid() OR sender_id = auth.uid());

-- Senders can delete (cancel) their own sent notifications
CREATE POLICY "cancel own notifications"
  ON public.notifications FOR DELETE
  USING (sender_id = auth.uid());

-- ── Unread count (fast, for sidebar badge) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_unread_count()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE v BIGINT;
BEGIN
  SELECT COUNT(*) INTO v FROM public.notifications
  WHERE recipient_id = auth.uid() AND status = 'pending' AND read = false;
  RETURN v;
END;
$$;

-- ── Inbox (enriched) ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_inbox()
RETURNS TABLE(
  id            UUID,
  type          TEXT,
  status        TEXT,
  "read"        BOOLEAN,
  role          TEXT,
  member_row_id UUID,
  created_at    TIMESTAMPTZ,
  project_id    UUID,
  project_name  TEXT,
  project_color TEXT,
  sender_id     UUID,
  sender_name   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Mark pending as read
  UPDATE public.notifications
  SET read = true
  WHERE recipient_id = auth.uid() AND status = 'pending' AND read = false;

  RETURN QUERY
  SELECT n.id, n.type, n.status, n.read, n.role, n.member_row_id, n.created_at,
         p.id,   p.name,  p.color,
         n.sender_id, pr.full_name
  FROM   public.notifications n
  LEFT JOIN public.projects  p  ON p.id  = n.project_id
  LEFT JOIN public.profiles  pr ON pr.id = n.sender_id
  WHERE  n.recipient_id = auth.uid()
  ORDER  BY n.created_at DESC
  LIMIT  100;
END;
$$;

-- ── Pending invites for a project (admin view) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_pending_invites(p_project_id UUID)
RETURNS TABLE(
  notification_id UUID,
  recipient_id    UUID,
  recipient_name  TEXT,
  role            TEXT,
  created_at      TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND status = 'active'
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT n.id, n.recipient_id, pr.full_name, n.role, n.created_at
  FROM   public.notifications n
  LEFT JOIN public.profiles pr ON pr.id = n.recipient_id
  WHERE  n.project_id = p_project_id
    AND  n.type = 'project_invite'
    AND  n.status = 'pending'
  ORDER  BY n.created_at DESC;
END;
$$;

-- ── Send a project invite (email-based) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_project_invite(
  p_project_id UUID,
  p_email      TEXT,
  p_role       TEXT DEFAULT 'member'
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_target UUID; v_member UUID;
BEGIN
  -- Auth check
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = p_project_id AND user_id = auth.uid())
  AND NOT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
      AND role IN ('owner','admin') AND status = 'active'
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Find user by email
  SELECT u.id INTO v_target FROM auth.users u WHERE lower(u.email) = lower(p_email) LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  -- Check not already a member or pending
  IF EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = p_project_id AND user_id = v_target
  ) THEN RAISE EXCEPTION 'Already a member or pending'; END IF;

  -- Create pending membership + notification
  INSERT INTO public.project_members (project_id, user_id, role, invited_by, status)
  VALUES (p_project_id, v_target, p_role, auth.uid(), 'pending')
  RETURNING id INTO v_member;

  INSERT INTO public.notifications (recipient_id, sender_id, type, project_id, role, member_row_id)
  VALUES (v_target, auth.uid(), 'project_invite', p_project_id, p_role, v_member);
END;
$$;

-- ── Cancel a sent invite ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_invite(p_notification_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_member UUID;
BEGIN
  SELECT member_row_id INTO v_member FROM public.notifications
  WHERE id = p_notification_id AND sender_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;

  UPDATE public.notifications SET status = 'cancelled' WHERE id = p_notification_id;
  DELETE FROM public.project_members WHERE id = v_member;
END;
$$;

-- ── Respond to an invite (accept / decline) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_to_invite(
  p_notification_id UUID,
  p_accept          BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_member UUID;
BEGIN
  SELECT member_row_id INTO v_member FROM public.notifications
  WHERE id = p_notification_id AND recipient_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found'; END IF;

  IF p_accept THEN
    UPDATE public.notifications SET status = 'accepted' WHERE id = p_notification_id;
    UPDATE public.project_members SET status = 'active' WHERE id = v_member;
  ELSE
    UPDATE public.notifications SET status = 'declined' WHERE id = p_notification_id;
    DELETE FROM public.project_members WHERE id = v_member;
  END IF;
END;
$$;

-- ── Request to join via invite link ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_project_join(p_invite_token UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_project_id UUID; v_owner UUID; v_member UUID;
BEGIN
  SELECT id, user_id INTO v_project_id, v_owner
  FROM public.projects WHERE invite_token = p_invite_token;
  IF v_project_id IS NULL THEN RAISE EXCEPTION 'Invalid invite link'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = v_project_id AND user_id = auth.uid()
  ) THEN RETURN 'already_member'; END IF;

  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (v_project_id, auth.uid(), 'member', 'pending')
  RETURNING id INTO v_member;

  -- Notify the project owner
  INSERT INTO public.notifications (recipient_id, sender_id, type, project_id, role, member_row_id)
  VALUES (v_owner, auth.uid(), 'join_request', v_project_id, 'member', v_member);

  RETURN 'requested';
END;
$$;

-- ── Respond to a join request (approve / deny) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.respond_to_join_request(
  p_notification_id UUID,
  p_approve         BOOLEAN
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_member UUID;
BEGIN
  SELECT member_row_id INTO v_member FROM public.notifications
  WHERE id = p_notification_id AND recipient_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;

  IF p_approve THEN
    UPDATE public.notifications SET status = 'accepted' WHERE id = p_notification_id;
    UPDATE public.project_members SET status = 'active'  WHERE id = v_member;
  ELSE
    UPDATE public.notifications SET status = 'declined' WHERE id = p_notification_id;
    DELETE FROM public.project_members WHERE id = v_member;
  END IF;
END;
$$;

-- ── Look up a project by invite token (callable by anon for invite page) ──────
CREATE OR REPLACE FUNCTION public.get_project_by_invite_token(p_token UUID)
RETURNS TABLE(id UUID, name TEXT, color TEXT, member_count BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.color,
    (SELECT COUNT(*) FROM public.project_members pm
     WHERE pm.project_id = p.id AND pm.status = 'active')::BIGINT
  FROM public.projects p WHERE p.invite_token = p_token;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_by_invite_token(UUID) TO anon;
