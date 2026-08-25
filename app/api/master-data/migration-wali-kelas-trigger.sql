-- Trigger: auto-set nonaktif orphan wali_kelas_assignments on member delete
-- institution_members(id) = INTEGER PK
-- wali_kelas_assignments(wali_kelas_member_id) = UUID column
-- No FK possible across types — use trigger instead.

CREATE OR REPLACE FUNCTION cleanup_wali_kelas_on_member_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.wali_kelas_assignments
    SET status = 'nonaktif', updated_at = now()
    WHERE CAST(wali_kelas_member_id AS TEXT) =
          ('00000000-0000-0000-0000-' || LPAD(OLD.id::TEXT, 12, '0'))
      AND status = 'aktif';
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cleanup_wali_kelas_on_member_delete ON public.institution_members;
CREATE TRIGGER trg_cleanup_wali_kelas_on_member_delete
    BEFORE DELETE ON public.institution_members
    FOR EACH ROW
    EXECUTE FUNCTION cleanup_wali_kelas_on_member_delete();

-- Backfill existing orphan rows
UPDATE public.wali_kelas_assignments
SET status = 'nonaktif', updated_at = now()
WHERE status = 'aktif'
  AND CAST(wali_kelas_member_id AS TEXT) IN (
    '00000000-0000-0000-0000-000000000075',
    '00000000-0000-0000-0000-000000000076',
    '00000000-0000-0000-0000-000000000078',
    '00000000-0000-0000-0000-000000000079'
  );

SELECT id, status FROM public.wali_kelas_assignments;
