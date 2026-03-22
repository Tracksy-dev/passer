-- Add notifications table for in-app engagement events
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- recipient
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reel_liked', 'followed_you')),
  reel_id uuid NULL REFERENCES reel_jobs(id) ON DELETE CASCADE,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Keep data coherent by preventing self-notifications
  CONSTRAINT notifications_no_self_action CHECK (user_id <> actor_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_actor_id
  ON notifications(actor_id);

CREATE INDEX IF NOT EXISTS idx_notifications_reel_id
  ON notifications(reel_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Recipients can read their own notifications.
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Actors can create notifications they trigger.
CREATE POLICY "Users can insert actor notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() = actor_id);

-- Recipients can mark their own notifications as read.
CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
