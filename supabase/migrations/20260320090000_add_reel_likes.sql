-- Add reel_likes table for social engagement on highlight reels
CREATE TABLE IF NOT EXISTS reel_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reel_id uuid NOT NULL REFERENCES reel_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent duplicate likes from the same user on the same reel
  CONSTRAINT reel_likes_unique_user_reel UNIQUE (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reel_likes_reel_id ON reel_likes(reel_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user_id ON reel_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_reel_likes_created_at ON reel_likes(created_at DESC);

ALTER TABLE reel_likes ENABLE ROW LEVEL SECURITY;

-- Anyone can read likes for visible counts on public surfaces.
CREATE POLICY "Anyone can view reel likes"
ON reel_likes FOR SELECT
USING (true);

-- Users can only like as themselves.
CREATE POLICY "Users can insert own reel likes"
ON reel_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only remove their own likes.
CREATE POLICY "Users can delete own reel likes"
ON reel_likes FOR DELETE
USING (auth.uid() = user_id);
