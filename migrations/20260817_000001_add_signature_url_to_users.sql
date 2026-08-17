-- Migration: Add signature_url field to users table
-- Supports upload of scanned signature images for document generation

ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- Comment for documentation
COMMENT ON COLUMN users.signature_url IS 'URL to uploaded signature image (PNG/JPG) for document generation';
