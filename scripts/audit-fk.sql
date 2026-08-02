-- ============================================================
-- STEP 1: Audit FK Constraint & Orphan Records
-- ============================================================

-- 1. Cek apakah FK constraint ada dan konfigurasi delete-nya
SELECT conname, confdeltype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'teacher_library_progress'::regclass
AND contype = 'f';

-- 2. Hitung orphan records
SELECT count(*) AS orphan_count
FROM teacher_library_progress p
LEFT JOIN library_items i ON p.item_id = i.id
WHERE i.id IS NULL;

-- 3. Lihat pola orphan untuk investigasi root cause
SELECT p.teacher_id, p.item_id, p.updated_at
FROM teacher_library_progress p
LEFT JOIN library_items i ON p.item_id = i.id
WHERE i.id IS NULL
ORDER BY p.updated_at DESC
LIMIT 50;
