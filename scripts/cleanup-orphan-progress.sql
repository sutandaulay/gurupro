-- ============================================================
-- STEP 2: Batch Cleanup Orphan Progress Records
-- ============================================================
-- IMPORTANT: Jalankan BERULANG (loop) sampai output "DELETE 0" muncul.
-- Jangan jalankan sekali sekaligus — batch 500 per iterasi
-- untuk menghindari lock table besar di production.

-- Cek dulu berapa orphan total sebelum cleanup
SELECT count(*) AS orphan_count
FROM teacher_library_progress p
LEFT JOIN library_items i ON p.item_id = i.id
WHERE i.id IS NULL;

-- Batch delete (500 per iterasi)
DELETE FROM teacher_library_progress
WHERE id IN (
  SELECT p.id
  FROM teacher_library_progress p
  LEFT JOIN library_items i ON p.item_id = i.id
  WHERE i.id IS NULL
  LIMIT 500
);

-- Verifikasi: harus return 0 orphan
SELECT count(*) AS orphan_count_after
FROM teacher_library_progress p
LEFT JOIN library_items i ON p.item_id = i.id
WHERE i.id IS NULL;
