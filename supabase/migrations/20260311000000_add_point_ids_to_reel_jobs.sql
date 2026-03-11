-- Add point_ids column to reel_jobs table
-- Stores an array of match_point IDs that the user selected for this reel.
-- When NULL, all match_points for the match are included (legacy behaviour).
ALTER TABLE reel_jobs ADD COLUMN IF NOT EXISTS point_ids uuid[] DEFAULT NULL;
