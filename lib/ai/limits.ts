/**
 * GuruPRO AI Character Limit Enforcers
 * Runtime enforcement of output size limits on AI generation endpoints.
 * Prevents crashes from oversized responses in downstream renderers.
 *
 * Reference: docs/ai-generation-standard.md
 */

import { truncateText } from './validation-utils';

/**
 * Enforce character limit on markdown/document output.
 * Used for PROTA, PROSEM, Administrasi, Silabus generate endpoints.
 */
export function enforceMarkdownLimits(
  content: string | null | undefined,
  maxChars = 20000,
): string {
  if (!content) return '';
  return truncateText(content, maxChars, '[... output dipotong karena terlalu panjang]');
}

/**
 * Enforce character limit on free-form text output.
 * Used for AI chat, laporan kinerja, assessments, image prompts.
 */
export function enforceOutputLimits(
  content: string | null | undefined,
  maxChars = 10000,
): string {
  if (!content) return '';
  return truncateText(content, maxChars, '[... dipotong]');
}
