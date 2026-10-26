/**
 * GuruPRO AI Module -- Single Entry Point
 *
 * This index re-exports ALL AI-related exports from their original locations
 * so consumers can import from one place: `@/lib/ai`.
 *
 * Import pattern:
 *   import { generateAIContent, generateJournal, ... } from '@/lib/ai';
 *
 * Backward compatibility:
 *   - Existing imports from '@/lib/ai' (→ lib/ai.ts root) continue to work.
 *   - Existing imports from '@/lib/ai/generators' continue to work.
 *   - Existing imports from '@/lib/ai/prompts' continue to work.
 *   - etc.
 */

// ============================================================
// AI CORE (root lib/ai.ts)
// Universal multi-vendor client (mock, gemini, openAI, deepseek, claude)
// ============================================================
export {
  generateAIContent,
  generateAIContentWithUsage,
} from '../ai';
// Alias: root lib/ai.ts has generateAIContent (string-return, multi-vendor).
// generators.ts also has generateAIContent (typed, GenerationResult-return, Gemini-only).
// Both are aliased so they coexist in the same index scope.

// ============================================================
// GENERATORS (lib/ai/generators.ts)
// Typed generation helpers + domain-specific generators
// ============================================================
export {
  generateJournal,
  generateReflection,
  generateRaportDescription,
  generateAbsentAlertMessage,
  generateClassAnalytics,
  generateChatResponse,
  estimateCost,
  getGeminiClient,
  type GenerationResult,
} from './generators';
// Alias: generateAIContent from generators.ts has a different signature (typed, GenerationResult-return)
// than the root lib/ai.ts version (string-return, multi-vendor). Alias it here so both are accessible.
export { generateAIContent as generateAIGenericContent } from './generators';
// ============================================================
// BAHAN AJAR (lib/ai/generateBahanAjar.ts)
// Slides, LKPD, Handout generation with token quota management
// ============================================================
export {
  generateBahanAjar,
  regenerateBahanAjarPartial,
  generateBahanAjarV2,
  parseJsonResponse,
  isCompliancePassed,
  validateSlideOutputV2,
  estimateTotalTokenCost,
  estimatePartialTokenCost,
  TOKEN_ESTIMATES,
  type GenerationResult as BahanAjarGenResult,
  type ModulAjarContext,
  type JenisOutput,
  type BahanAjarGenerationResult,
  type ComplianceCheckResult,
  type SlideItem,
  type SlideOutputV2,
  type HandoutSoal,
  type HandoutOutputV2,
  type BahanAjarGenerationResultV2,
  type GenerateBahanAjarV2Options,
} from './generateBahanAjar';

// ============================================================
// PROMPTS (lib/ai/prompts.ts)
// Prompt template functions for all AI features
// ============================================================
export {
  generateJournalPrompt,
  generateReflectionPrompt,
  generateFollowUpPrompt,
  generateRaportPrompt,
  generateChatSystemPrompt,
  generateAbsentAlertPrompt,
  generateLessonRecommendationPrompt,
  generateAnalyticsPrompt,
  parseAISafeResponse,
  estimateTokens,
  type JournalGenerateInput,
  type ReflectionGenerateInput,
  type FollowUpGenerateInput,
  type RaportGenerateInput,
  type ChatContext,
  type AbsentAlertInput,
  type ClassAnalyticsInput,
} from './prompts';

// ============================================================
// SILABUS (lib/ai/silabusPrompts.ts + silabus-markdown.ts)
// ============================================================
export {
  SILABUS_SYSTEM_PROMPT,
  buildSilabusPrompt,
  enforceSilabusLimits,
  validateSilabusOutput,
  parseSilabusFromAIResponse,
  type SilabusPromptInput,
} from './silabusPrompts';

export { silabusToMarkdown } from './silabus-markdown';

// ============================================================
// MONITORING (lib/ai/monitoring.ts)
// AI output tracking and truncation analytics
// ============================================================
export {
  trackAIOutput,
  trackAIMultiple,
  getAISummary,
  getRecentTruncations,
  getFrequentTruncations,
  clearEvents,
  exportEvents,
  FEATURE_LIMITS,
  type AIOutputEvent,
} from './monitoring';

// ============================================================
// LIMITS (lib/ai/limits.ts)
// Runtime character limit enforcement
// ============================================================
export {
  enforceMarkdownLimits,
  enforceOutputLimits,
} from './limits';

// ============================================================
// PARSE KEUANGAN (lib/ai/parseKeuanganPrompts.ts)
// ============================================================
export { getParseKeuanganPrompt } from './parseKeuanganPrompts';

// ============================================================
// NOTE: The following file exists as an import target in
// generateBahanAjar.ts but is NOT present in the directory:
//   import { buildSlidePrompt, ... } from './bahanAjarPrompts';
// This is a pre-existing broken import. Do NOT create it unless
// the bahan-ajar generation pipeline requires it.
// ============================================================
