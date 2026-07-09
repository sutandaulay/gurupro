-- Add photo_url column to users table for profile photo uploads
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Update existing Google OAuth users with their Google profile photo (if accounts table exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'accounts') THEN
        UPDATE users u
        SET photo_url = sub.picture
        FROM (
            SELECT DISTINCT ON (a.user_id) a.user_id, a.picture
            FROM accounts a
            WHERE a.provider = 'google'
              AND a.picture IS NOT NULL
            ORDER BY a.user_id, a."createdAt" DESC NULLS LAST
        ) sub
        WHERE u.id = sub.user_id::uuid
          AND u.photo_url IS NULL;
    END IF;
END $$;
