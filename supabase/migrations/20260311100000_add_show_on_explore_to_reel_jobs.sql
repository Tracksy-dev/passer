-- Add show_on_explore column to reel_jobs table
-- Controls whether a public reel also appears on the Explore feed.
-- Only relevant when is_public = true.
ALTER TABLE reel_jobs ADD COLUMN IF NOT EXISTS show_on_explore boolean DEFAULT false;

-- RLS: allow anyone to read reels that are public AND shown on explore
-- (needed for the explore page to fetch reels from all users)
CREATE POLICY "Anyone can view explore reels"
ON reel_jobs
FOR SELECT
USING (is_public = true AND show_on_explore = true);
