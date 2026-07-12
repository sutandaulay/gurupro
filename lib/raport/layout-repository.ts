import { query } from '@/lib/db';
import {
  CreateLayoutRaportInputSchema,
  CreateLayoutRaportInput,
} from './schemas';

export async function createLayout(input: CreateLayoutRaportInput): Promise<{
  success: boolean;
  id?: string;
  error?: string;
}> {
  const parsed = CreateLayoutRaportInputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.message };
  }

  const { templateRaportId, sekolahId, namaLayout, sections, createdByWaliKelasMemberId } = parsed.data;

  try {
    const res = await query(
      `INSERT INTO layout_raport
         (template_raport_id, sekolah_id, nama_layout, sections, created_by_wali_kelas_member_id)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id`,
      [templateRaportId, sekolahId, namaLayout, JSON.stringify(sections), createdByWaliKelasMemberId]
    );

    return { success: true, id: res.rows[0].id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateLayout(
  layoutId: string,
  input: {
    namaLayout?: string;
    sections?: any[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (input.namaLayout !== undefined) {
      updates.push(`nama_layout = $${idx++}`);
      values.push(input.namaLayout);
    }
    if (input.sections !== undefined) {
      updates.push(`sections = $${idx++}::jsonb`);
      values.push(JSON.stringify(input.sections));
    }

    if (updates.length === 0) {
      return { success: true };
    }

    values.push(layoutId);

    await query(
      `UPDATE layout_raport SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getLayoutById(layoutId: string): Promise<any | null> {
  const res = await query(
    `SELECT * FROM layout_raport WHERE id = $1`,
    [layoutId]
  );
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  return {
    id: row.id,
    templateRaportId: row.template_raport_id,
    sekolahId: row.sekolah_id,
    namaLayout: row.nama_layout,
    sections: row.sections,
    createdByWaliKelasMemberId: row.created_by_wali_kelas_member_id,
    lastEditedAt: row.last_edited_at,
  };
}

export async function getLayoutsByTemplate(
  templateRaportId: string
): Promise<any[]> {
  const res = await query(
    `SELECT * FROM layout_raport
     WHERE template_raport_id = $1
     ORDER BY last_edited_at DESC`,
    [templateRaportId]
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    templateRaportId: row.template_raport_id,
    sekolahId: row.sekolah_id,
    namaLayout: row.nama_layout,
    sections: row.sections,
    createdByWaliKelasMemberId: row.created_by_wali_kelas_member_id,
    lastEditedAt: row.last_edited_at,
  }));
}

export async function getLayoutsBySekolah(sekolahId: string): Promise<any[]> {
  const res = await query(
    `SELECT lr.*, tr.nama_template
     FROM layout_raport lr
     JOIN template_raport tr ON tr.id = lr.template_raport_id
     WHERE lr.sekolah_id = $1
     ORDER BY lr.last_edited_at DESC`,
    [sekolahId]
  );

  return res.rows.map((row: any) => ({
    id: row.id,
    templateRaportId: row.template_raport_id,
    sekolahId: row.sekolah_id,
    namaLayout: row.nama_layout,
    namaTemplate: row.nama_template,
    sections: row.sections,
    createdByWaliKelasMemberId: row.created_by_wali_kelas_member_id,
    lastEditedAt: row.last_edited_at,
  }));
}

export async function deleteLayout(layoutId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await query(`DELETE FROM layout_raport WHERE id = $1`, [layoutId]);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
