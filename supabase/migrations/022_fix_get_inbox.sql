-- Fix ambiguous column reference in get_inbox().
-- The RETURNS TABLE declares a column named "status" which PL/pgSQL treats as a
-- local variable, making `status = 'pending'` in the UPDATE ambiguous.
-- Fix: qualify with the table name so PostgreSQL resolves it unambiguously.

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
  -- Mark pending notifications as read.
  -- Use a table alias in WHERE to resolve ambiguity with the RETURNS TABLE
  -- column also named "status" (PL/pgSQL would otherwise treat it as a variable).
  UPDATE public.notifications AS notif
  SET    read = true
  WHERE  notif.recipient_id = auth.uid()
    AND  notif.status = 'pending'
    AND  notif.read   = false;

  RETURN QUERY
  SELECT n.id, n.type, n.status, n.read, n.role, n.member_row_id, n.created_at,
         p.id,  p.name,  p.color,
         n.sender_id, pr.full_name
  FROM   public.notifications n
  LEFT JOIN public.projects  p  ON p.id  = n.project_id
  LEFT JOIN public.profiles  pr ON pr.id = n.sender_id
  WHERE  n.recipient_id = auth.uid()
  ORDER  BY n.created_at DESC
  LIMIT  100;
END;
$$;
