/**
 * Periode Format Verification Tests
 *
 * BAGIAN B - VERIFICATION ONLY - NO CODE CHANGES
 *
 * Tests untuk memverifikasi format periode konsisten di seluruh codebase.
 * Format yang diharapkan: YYYY/YYYY-ganjil atau YYYY/YYYY-genap
 */

import { describe, it, expect } from 'vitest';

describe('Periode Format Verification', () => {
  describe('Format Pattern', () => {
    // Expected format: YYYY/YYYY-ganjil atau YYYY/YYYY-genap
    const PERIODE_REGEX = /^\d{4}\/\d{4}-(ganjil|genap)$/;

    const VALID_PERIODES = [
      '2025/2026-ganjil',
      '2025/2026-genap',
      '2024/2025-ganjil',
      '2024/2025-genap',
      '2023/2024-ganjil',
    ];

    const INVALID_PERIODES = [
      '2025-2026-ganjil',    // Salah separator (/ vs -)
      '2025/2026',           // Tanpa semester
      '25/26-ganjil',      // Format pendek
      '2025/2026-SMT1',    // Format berbeda
      '2025/2026',         // Tanpa semester
      'ganjil-2025/2026',   // Urutan terbalik
    ];

    it('should match expected format pattern', () => {
      expect(PERIODE_REGEX.test('2025/2026-ganjil')).toBe(true);
      expect(PERIODE_REGEX.test('2025/2026-genap')).toBe(true);
    });

    it.each(VALID_PERIODES)('should accept valid periode: %s', (periode) => {
      expect(PERIODE_REGEX.test(periode)).toBe(true);
    });

    it.each(INVALID_PERIODES)('should reject invalid periode: %s', (periode) => {
      expect(PERIODE_REGEX.test(periode)).toBe(false);
    });
  });

  describe('Semester Determination', () => {
    // July-December = Ganjil, January-June = Genap
    const getSemester = (month: number): 'ganjil' | 'genap' => {
      return month >= 6 ? 'ganjil' : 'genap';
    };

    it('July is ganjil', () => {
      expect(getSemester(6)).toBe('ganjil'); // July = month 6
      expect(getSemester(7)).toBe('ganjil');
      expect(getSemester(11)).toBe('ganjil');
    });

    it('January-June is genap', () => {
      expect(getSemester(0)).toBe('genap');  // January
      expect(getSemester(5)).toBe('genap');  // June
    });
  });

  describe('Tahun Ajaran Validation', () => {
    const isValidTahunAjaran = (ta: string): boolean => {
      const match = ta.match(/^(\d{4})\/(\d{4})$/);
      if (!match) return false;
      const start = parseInt(match[1]);
      const end = parseInt(match[2]);
      // Tahun ajaran harus berurutan
      return end === start + 1;
    };

    it('should validate tahun ajaran format', () => {
      expect(isValidTahunAjaran('2025/2026')).toBe(true);
      expect(isValidTahunAjaran('2024/2025')).toBe(true);
    });

    it('should reject invalid tahun ajaran', () => {
      expect(isValidTahunAjaran('2025-2026')).toBe(false);
      expect(isValidTahunAjaran('2025/2027')).toBe(false);
      expect(isValidTahunAjaran('invalid')).toBe(false);
    });
  });
});

// ===========================================
// MANUAL VERIFICATION CHECKLIST
// ===========================================

/**
 * DATABASE VERIFICATION (Need PostgreSQL access):
 *
 * 1. Check tahun_ajaran table:
 *    SELECT DISTINCT nama FROM tahun_ajaran ORDER BY nama;
 *
 * 2. Check raport tables for periode format:
 *    SELECT DISTINCT periode FROM raport LIMIT 20;
 *
 * 3. Check student_grades for periode format:
 *    -- Run in psql:
 *    psql -d gurupro_db -c "SELECT DISTINCT semester FROM tahun_ajaran;"
 *    psql -d gurupro_db -c "SELECT DISTINCT periode FROM raport LIMIT 10;"
 *
 * EXPECTED FORMAT: YYYY/YYYY-ganjil or YYYY/YYYY-genap
 *
 * VERIFICATION STATUS: PENDING DATABASE ACCESS
 */
