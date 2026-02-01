-- Enable Row Level Security on matches table
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own matches
CREATE POLICY "Users can view own matches"
ON matches
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only insert their own matches
CREATE POLICY "Users can insert own matches"
ON matches
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only update their own matches
CREATE POLICY "Users can update own matches"
ON matches
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can only delete their own matches
CREATE POLICY "Users can delete own matches"
ON matches
FOR DELETE
USING (auth.uid() = user_id);

-- Enable RLS on storage bucket for match-videos
-- Note: Storage policies are managed separately in Supabase dashboard
-- or via storage.objects policies

-- Create storage policies for match-videos bucket
-- Users can only access their own video files (files are stored with user_id prefix)

-- Policy: Users can view their own video files
CREATE POLICY "Users can view own videos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'match-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can upload their own video files
CREATE POLICY "Users can upload own videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'match-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own video files
CREATE POLICY "Users can delete own videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'match-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
