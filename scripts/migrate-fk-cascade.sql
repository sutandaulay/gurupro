-- ============================================================
-- STEP 3: Pastikan FK Constraint dengan ON DELETE CASCADE aktif
-- ============================================================
-- Cek constraint yang ada sekarang
SELECT conname, pg_get_constraintdef(oid) AS def, convalidated
FROM pg_constraint
WHERE conrelid = 'teacher_library_progress'::regclass
AND contype = 'f';

-- Jika constraint ada tapi tanpa CASCADE, drop dan recreate:
-- ALTER TABLE teacher_library_progress DROP CONSTRAINT IF EXISTS teacher_library_progress_item_id_fkey;
-- ALTER TABLE teacher_library_progress ADD CONSTRAINT teacher_library_progress_item_id_fkey
--   FOREIGN KEY (item_id) REFERENCES library_items(id) ON DELETE CASCADE;

-- Jika constraint belum ada sama sekali:
-- ALTER TABLE teacher_library_progress ADD CONSTRAINT teacher_library_progress_item_id_fkey
--   FOREIGN KEY (item_id) REFERENCES library_items(id) ON DELETE CASCADE;
