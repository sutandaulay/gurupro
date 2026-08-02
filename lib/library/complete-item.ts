/**
 * Library completion logic — trigger on item completion
 * - Credit poin ledger reward
 * - Upsert teacher_library_score (agregat bulanan)
 * Anti-abuse: daily cap + minimum active seconds
 */

import { query, pool } from "@/lib/db";

const DAILY_REWARD_CAP = 3;
const POIN_REWARD_PDF = 10;
const POIN_REWARD_AUDIOBOOK = 5;
const MIN_ACTIVE_RATIO = 0.7; // minimal 70% durasi aktif

export async function handleProgressUpdate(
  teacherId: string,
  itemId: string,
  progressPercent: number
) {
  // Get item details
  const itemResult = await query(
    `SELECT type, duration_seconds, page_count FROM library_items WHERE id = $1`,
    [itemId]
  );
  if (itemResult.rows.length === 0) return;
  const item = itemResult.rows[0];

  // Get teacher's progress to check active reading time
  const progressResult = await query(
    `SELECT active_reading_seconds FROM teacher_library_progress WHERE teacher_id = $1 AND item_id = $2`,
    [teacherId, itemId]
  );
  const activeSeconds = progressResult.rows[0]?.active_reading_seconds ?? 0;

  // Anti-abuse: minimum active time check
  const minRequiredSeconds = item.type === 'audiobook'
    ? (item.duration_seconds ?? 0) * MIN_ACTIVE_RATIO
    : (item.page_count ?? 1) * 20; // 20 detik per halaman minimum

  if (activeSeconds < minRequiredSeconds) {
    console.log(`[Library] Skipping reward for teacher ${teacherId} — insufficient active time (${activeSeconds}s < ${minRequiredSeconds}s required)`);
    return;
  }

  // Anti-abuse: daily reward cap
  const todayResult = await query(
    `SELECT COUNT(*) FROM poin_ledger
     WHERE teacher_id = $1 AND source_type = 'library_reward'
       AND DATE(created_at) = CURRENT_DATE`,
    [teacherId]
  );
  const todayRewards = parseInt(todayResult.rows[0].count);
  if (todayRewards >= DAILY_REWARD_CAP) {
    console.log(`[Library] Skipping reward for teacher ${teacherId} — daily cap reached (${todayRewards}/${DAILY_REWARD_CAP})`);
    return;
  }

  const rewardAmount = item.type === 'audiobook' ? POIN_REWARD_AUDIOBOOK : POIN_REWARD_PDF;
  const periodMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // Credit poin ledger
  await query(
    `INSERT INTO poin_ledger (teacher_id, amount, source_type, reference_id)
     VALUES ($1, $2, 'library_reward', $3)`,
    [teacherId, rewardAmount, itemId]
  );

  // Upsert monthly score
  const minutesEngaged = Math.ceil(activeSeconds / 60);
  await query(
    `INSERT INTO teacher_library_score (teacher_id, period_month, total_items_completed, total_minutes_engaged)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (teacher_id, period_month)
     DO UPDATE SET
       total_items_completed = teacher_library_score.total_items_completed + 1,
       total_minutes_engaged = teacher_library_score.total_minutes_engaged + $3`,
    [teacherId, periodMonth, minutesEngaged]
  );

  console.log(`[Library] Reward credited: teacher=${teacherId}, item=${itemId}, amount=${rewardAmount}`);
}
