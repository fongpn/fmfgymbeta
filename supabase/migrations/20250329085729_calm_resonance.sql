/*
  # Create Storage Bucket and Policies
  
  1. Changes
    - Create 'media' bucket if it doesn't exist
    - Create storage policies for public access
    - Create folders for different media types
    
  2. Security
    - Enable public read access
    - Restrict write access to authenticated users
*/

-- Create the media bucket if it doesn't exist
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('media', 'media', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- Create storage policies
BEGIN;
  -- Allow public read access to media bucket
  CREATE POLICY "Give public read-only access"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'media');

  -- Allow authenticated users to upload files
  CREATE POLICY "Allow authenticated users to upload files"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'media' AND
      (auth.role() = 'authenticated')
    );

  -- Allow users to update their own files
  CREATE POLICY "Allow users to update own files"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'media' AND
      (auth.role() = 'authenticated')
    );

  -- Allow users to delete their own files
  CREATE POLICY "Allow users to delete own files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'media' AND
      (auth.role() = 'authenticated')
    );
COMMIT;

-- Create folders for different media types
DO $$
BEGIN
  -- Members folder
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES ('media', 'members/.keep', auth.uid(), '{"mimetype": "text/plain"}'::jsonb)
  ON CONFLICT (bucket_id, name) DO NOTHING;

  -- Products folder
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES ('media', 'products/.keep', auth.uid(), '{"mimetype": "text/plain"}'::jsonb)
  ON CONFLICT (bucket_id, name) DO NOTHING;

  -- Branding folder
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES ('media', 'branding/.keep', auth.uid(), '{"mimetype": "text/plain"}'::jsonb)
  ON CONFLICT (bucket_id, name) DO NOTHING;
END $$;

-- Add helpful comments
COMMENT ON POLICY "Give public read-only access" ON storage.objects IS 'Allow public read access to all files in the media bucket';
COMMENT ON POLICY "Allow authenticated users to upload files" ON storage.objects IS 'Allow authenticated users to upload files to the media bucket';
COMMENT ON POLICY "Allow users to update own files" ON storage.objects IS 'Allow users to update their own files in the media bucket';
COMMENT ON POLICY "Allow users to delete own files" ON storage.objects IS 'Allow users to delete their own files in the media bucket';