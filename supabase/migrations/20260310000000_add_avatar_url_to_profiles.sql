-- Add avatar_url column to profiles for public profile pages
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
