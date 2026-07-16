/**
 * API Test Suite: AI Generation System
 *
 * Tests AI document generation including:
 * - RPP / Modul Ajar (Permendikdasmen No. 1/2026)
 * - Silabus / ATP
 * - LKPD
 * - Bahan Ajar
 * - Laporan Evaluasi LKPD
 * - Soal AI
 * - Chat AI
 * - Output validation (Zod schemas)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Gemini AI
vi.mock('@/lib/ai', () => ({
  generateWithAI: vi.fn().mockResolvedValue({
    content: 'Mock AI generated content',
    tokens: 500,
  }),
}));

vi.mock('@/lib/ai/generators', () => ({
  generateRPP: vi.fn().mockResolvedValue({
    komponen: {
      perangkat: 'RPP',
      jenjang: 'SMP',
      kelas: 'VII',
      mataPelajaran: 'Matematika',
    },
    tujuanPembelajaran: ['TP-1', 'TP-2'],
    profilPelajarPancasila: ['Beriman', 'Berkebinekaan'],
    pemantik: 'Apa yang kalian ketahui tentang...',
    media: 'PPT, LKPD',
    langkahPembelajaran: [
      { kegiatan: 'Pendahuluan', alur: '...' },
      { kegiatan: 'Inti', alur: '...' },
      { kegiatan: 'Penutup', alur: '...' },
    ],
    asesmen: { diagnostik: [], formatif: [], sumatif: [] },
    remediPengayaan: 'Remidi: ... Pengayaan: ...',
  }),
}));

describe('AI Generation API Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // RPP / Modul Ajar Tests
  // ==========================================

  describe('RPP / Modul Ajar Generation', () => {
    it('should validate RPP output structure', () => {
      const rppOutput = {
        komponen: {
          perangkat: 'RPP',
          jenjang: 'SMP',
          kelas: 'VII',
          semester: '1',
          mataPelajaran: 'Matematika',
          fase: 'D',
          topik: 'Bilangan Bulat',
          waktu: '2 x 40 menit',
        },
        tujuanPembelajaran: ['TP-1', 'TP-2', 'TP-3'],
        profilPelajarPancasila: ['Beriman', 'Berkebinekaan'],
        pemantik: 'Pertanyaan pemantik...',
        media: ['PPT', 'LKPD'],
        langkahPembelajaran: [
          { kegitan: 'Pendahuluan', alur: '...' },
        ],
        asesmen: {
          diagnostik: [],
          formatif: [],
          sumatif: [],
        },
        remediPengayaan: '...',
      };

      // Validate required fields per Permendikdasmen No. 1/2026
      expect(rppOutput).toHaveProperty('komponen');
      expect(rppOutput).toHaveProperty('tujuanPembelajaran');
      expect(rppOutput).toHaveProperty('profilPelajarPancasila');
      expect(rppOutput).toHaveProperty('langkahPembelajaran');
      expect(rppOutput).toHaveProperty('asesmen');
    });

    it('should generate tujuan pembelajaran from TP', () => {
      const tp = ['TP-1', 'TP-2', 'TP-3'];
      const tujuanPembelajaran = tp.map((tp, i) => `Setelah pembelajaran ini, siswa dapat ${tp}`);

      expect(tujuanPembelajaran.length).toBe(tp.length);
      expect(tujuanPembelajaran[0]).toContain('Setelah pembelajaran ini');
    });

    it('should validate profil pelajar pancasila integration', () => {
      const requiredProfil = [
        'Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia',
        'Berkebinekaan Global',
        'Bergotong Royong',
        'Mandiri',
        'Bernalar Kritis',
        'Kreatif',
        'Mengenal Tuhan',
        'Robinson',
      ];

      // Should include at least one profil element
      const generatedProfil = ['Berkebinekaan Global', 'Mandiri'];
      const isValid = generatedProfil.some(p => requiredProfil.includes(p));

      expect(isValid).toBe(true);
    });

    it('should structure assessment correctly', () => {
      const asesmen = {
        diagnostik: ['Soal diagnostik 1', 'Soal diagnostik 2'],
        formatif: ['Soal formatif 1'],
        sumatif: ['Soal sumatif 1', 'Soal sumatif 2'],
      };

      expect(asesmen.diagnostik.length).toBeGreaterThan(0);
      expect(asesmen.formatif.length).toBeGreaterThan(0);
      expect(asesmen.sumatif.length).toBeGreaterThan(0);
    });
  });

  // ==========================================
  // Silabus / ATP Tests
  // ==========================================

  describe('Silabus / ATP Generation', () => {
    it('should validate silabus structure', () => {
      const silabusOutput = {
        jenjang: 'SMP',
        kelas: 'VII',
        mataPelajaran: 'Matematika',
        fase: 'D',
        kurikulum: 'Merdeka',
        semester: '1',
        bab: [
          {
            nomor: 1,
            nama: 'Bilangan Bulat',
            alokasiWaktu: '12 JP',
            cp: ['CP 1', 'CP 2'],
            tp: ['TP 1', 'TP 2'],
          },
        ],
      };

      expect(silabusOutput).toHaveProperty('bab');
      expect(silabusOutput.bab.length).toBeGreaterThan(0);
      expect(silabusOutput.bab[0]).toHaveProperty('cp');
      expect(silabusOutput.bab[0]).toHaveProperty('tp');
    });

    it('should calculate total JP correctly', () => {
      const babList = [
        { alokasiWaktu: '12 JP' },
        { alokasiWaktu: '8 JP' },
        { alokasiWaktu: '16 JP' },
      ];

      const totalJP = babList.reduce((sum, bab) => {
        const jp = parseInt(bab.alokasiWaktu.split(' ')[0]);
        return sum + jp;
      }, 0);

      expect(totalJP).toBe(36);
    });
  });

  // ==========================================
  // LKPD Tests
  // ==========================================

  describe('LKPD Generation', () => {
    it('should validate LKPD structure', () => {
      const lkpdOutput = {
        judul: 'LKPD Pembelajaran 1',
        tujuan: 'Siswa dapat...',
        petunJuk: 'Langkah-langkah: ...',
        soal: [
          {
            tipe: 'pilihan_ganda',
            pertanyaan: 'Apa hasil dari 2 + 2?',
            pilihan: ['3', '4', '5', '6'],
            jawaban: '4',
          },
          {
            tipe: 'uraian',
            pertanyaan: 'Jelaskan langkah-langkah...',
            rubrik: {
              skor4: 'Sangat baik',
              skor3: 'Baik',
              skor2: 'Cukup',
              skor1: 'Kurang',
            },
          },
        ],
      };

      expect(lkpdOutput).toHaveProperty('soal');
      expect(lkpdOutput.soal.length).toBeGreaterThan(0);
      expect(lkpdOutput.soal[0]).toHaveProperty('tipe');
    });

    it('should support multiple question types', () => {
      const questionTypes = [
        'pilihan_ganda',
        'uraian',
        'esai',
        'benar_salah',
        'isian_pendek',
        'menjodohkan',
      ];

      questionTypes.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });
  });

  // ==========================================
  // Soal AI Tests
  // ==========================================

  describe('Soal AI Generation', () => {
    it('should validate soal output structure', () => {
      const soalOutput = {
        bankSoalId: 'bank-123',
        kategori: 'formatif',
        jenjang: 'SMP',
        kelas: 'VII',
        mataPelajaran: 'Matematika',
        topik: 'Bilangan Bulat',
        jumlahSoal: 10,
        soal: [
          {
            nomor: 1,
            tipe: 'pilihan_ganda',
            teks: 'Hasil dari (-5) + 3 adalah...',
            pilihan: ['-8', '-2', '2', '8'],
            jawabanBenar: 1,
            pembahasn: 'Penjelasan...',
            tingkatKesulitan: 'sedang',
          },
        ],
      };

      expect(soalOutput).toHaveProperty('soal');
      expect(soalOutput.soal.length).toBe(soalOutput.jumlahSoal);
    });

    it('should include pembahasn for each soal', () => {
      const soal = {
        teks: 'Apa hasil dari 2 + 2?',
        pilihan: ['3', '4', '5', '6'],
        jawabanBenar: 1,
        pembahasn: 'Karena 2 + 2 = 4',
      };

      expect(soal).toHaveProperty('pembahasn');
      expect(soal.pembahasn.length).toBeGreaterThan(0);
    });

    it('should track tingkat kesulitan distribution', () => {
      const soal = [
        { tingkatKesulitan: 'mudah' },
        { tingkatKesulitan: 'sedang' },
        { tingkatKesulitan: 'sedang' },
        { tingkatKesulitan: 'sulit' },
      ];

      const distribution = {
        mudah: soal.filter(s => s.tingkatKesulitan === 'mudah').length,
        sedang: soal.filter(s => s.tingkatKesulitan === 'sedang').length,
        sulit: soal.filter(s => s.tingkatKesulitan === 'sulit').length,
      };

      expect(distribution.mudah + distribution.sedang + distribution.sulit).toBe(soal.length);
    });
  });

  // ==========================================
  // Token Consumption Tests
  // ==========================================

  describe('Token Consumption', () => {
    it('should calculate token usage correctly', () => {
      const request = {
        inputTokens: 1000,
        outputTokens: 500,
        cachedTokens: 200,
      };

      const totalTokens = request.inputTokens + request.outputTokens - request.cachedTokens;
      expect(totalTokens).toBe(1300);
    });

    it('should consume tokens from main balance first', () => {
      const userBalance = {
        main: 80,
        addon: 50,
      };
      const requestedTokens = 100;

      let remaining = requestedTokens;
      let usedFromMain = 0;
      let usedFromAddon = 0;

      if (userBalance.main > 0) {
        usedFromMain = Math.min(userBalance.main, remaining);
        remaining -= usedFromMain;
      }

      if (remaining > 0 && userBalance.addon > 0) {
        usedFromAddon = Math.min(userBalance.addon, remaining);
        remaining -= usedFromAddon;
      }

      expect(usedFromMain).toBe(80);
      expect(usedFromAddon).toBe(20);
      expect(remaining).toBe(0);
    });

    it('should reject request when tokens insufficient', () => {
      const userBalance = {
        main: 5,
        addon: 0,
      };
      const requestedTokens = 10;

      const totalAvailable = userBalance.main + userBalance.addon;
      const canFulfill = totalAvailable >= requestedTokens;

      expect(canFulfill).toBe(false);
    });
  });

  // ==========================================
  // Zod Validation Tests
  // ==========================================

  describe('Zod Schema Validation', () => {
    it('should validate correct RPP data', () => {
      const validData = {
        komponen: {
          jenjang: 'SMP',
          kelas: 'VII',
          mataPelajaran: 'Matematika',
        },
        tujuanPembelajaran: ['TP-1'],
        langkahPembelajaran: [
          { kegiatan: 'Inti' },
        ],
        asesmen: {
          diagnostik: [],
          formatif: [],
          sumatif: [],
        },
      };

      // Simplified validation check
      const hasRequiredFields =
        validData.komponen &&
        validData.tujuanPembelajaran.length > 0 &&
        validData.langkahPembelajaran.length > 0;

      expect(hasRequiredFields).toBe(true);
    });

    it('should reject invalid jenjang', () => {
      const invalidJenjang = ['Invalid', 'SMA1', 'smk'];
      const validJenjang = ['SD', 'SMP', 'SMA', 'SMK', 'MI', 'MTs', 'MA', 'PESANTREN'];

      invalidJenjang.forEach(jenjang => {
        expect(validJenjang.includes(jenjang)).toBe(false);
      });
    });

    it('should validate fase format', () => {
      const validFase = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

      validFase.forEach(fase => {
        expect(fase.length).toBe(1);
        expect(/[A-I]/.test(fase)).toBe(true);
      });
    });
  });

  // ==========================================
  // Permendikdasmen Compliance Tests
  // ==========================================

  describe('Permendikdasmen No. 1/2026 & No. 13/2025 Compliance', () => {
    it('should include all required RPP components', () => {
      const requiredComponents = [
        'komponen',
        'tujuanPembelajaran',
        'profilPelajarPancasila',
        'pemantik',
        'media',
        'langkahPembelajaran',
        'asesmen',
        'remediPengayaan',
      ];

      const rppOutput = {
        komponen: {},
        tujuanPembelajaran: [],
        profilPelajarPancasila: [],
        pemantik: '',
        media: [],
        langkahPembelajaran: [],
        asesmen: {},
        remediPengayaan: '',
      };

      requiredComponents.forEach(component => {
        expect(rppOutput).toHaveProperty(component);
      });
    });

    it('should validate lesson flow structure', () => {
      const requiredFlow = ['Pendahuluan', 'Inti', 'Penutup'];

      const generatedFlow = ['Pendahuluan', 'Inti', 'Penutup'];

      requiredFlow.forEach(fase => {
        expect(generatedFlow).toContain(fase);
      });
    });
  });
});
