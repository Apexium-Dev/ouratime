-- Allow recipients to delete their own resolved (non-pending) notifications
-- Pending ones must be responded to first to avoid orphaned project_members rows
CREATE POLICY "delete resolved notifications"
  ON public.notifications FOR DELETE
  USING (recipient_id = auth.uid() AND status <> 'pending');
