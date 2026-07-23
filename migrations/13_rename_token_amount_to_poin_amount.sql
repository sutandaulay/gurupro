-- Migration: rename token_amount -> poin_amount on addon_token_packages
-- Nilai numerik tidak diubah, hanya nama field & label yang disesuaikan ke "Poin"

BEGIN;

-- 1. Rename kolom jika masih menggunakan nama lama
ALTER TABLE IF EXISTS addon_token_packages RENAME COLUMN IF EXISTS token_amount TO poin_amount;

-- 2. Pastikan data existing konsisten: angka tetap sama, hanya nama/deskripsi yang diubah
UPDATE addon_token_packages
SET
  name = CASE
    WHEN LOWER(name) LIKE 'paket 50 token' THEN 'Paket 50 Poin'
    WHEN LOWER(name) LIKE 'paket 100 token' THEN 'Paket 100 Poin'
    WHEN LOWER(name) LIKE 'paket 250 token' THEN 'Paket 250 Poin'
    ELSE name
  END,
  description = CASE
    WHEN description ILIKE '%Token eceran untuk kebutuhan sesekali%' THEN 'Poin eceran untuk kebutuhan sesekali'
    WHEN description ILIKE '%Token eceran dengan nilai lebih hemat%' THEN 'Poin eceran dengan nilai lebih hemat'
    WHEN description ILIKE '%Token eceran untuk kebutuhan intensif%' THEN 'Poin eceran untuk kebutuhan intensif'
    ELSE description
  END
WHERE
  name ILIKE '%Paket % Token%'
  OR description ILIKE '%Token%';

COMMIT;
