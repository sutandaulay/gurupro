/**
 * Item Analysis Utilities
 * Provides psychometric analysis for test questions
 */

export interface DifficultyLevel {
  label: string;
  value: number;
  color: string;
  description: string;
}

export interface DiscriminationIndex {
  label: string;
  value: number;
  color: string;
  interpretation: string;
}

export interface DistractorAnalysis {
  option: string;
  letter: string;
  selectedCount: number;
  percentage: number;
  isCorrect: boolean;
  effectiveness: "good" | "weak" | "poor";
}

export interface ItemAnalysis {
  index: number;
  soalId: string;
  tipe: string;
  pertanyaan: string;
  difficulty: DifficultyLevel;
  discrimination: DiscriminationIndex;
  distractors: DistractorAnalysis[];
  recommendation: string;
  hasVisual: boolean;
}

// Difficulty calculation based on simulated student responses
export function calculateDifficultySimulated(
  skor: number,
  maxSkor: number = 5,
  totalStudents: number = 30
): DifficultyLevel {
  // Simulate difficulty based on skor and question properties
  const normalizedSkor = Math.min(Math.max(skor, 1), maxSkor);
  const difficultyValue = 1 - (normalizedSkor / maxSkor); // 0 = easy, 1 = hard

  if (difficultyValue < 0.3) {
    return {
      label: "Mudah",
      value: difficultyValue,
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      description: "Sebagian besar siswa dapat menjawab dengan benar"
    };
  } else if (difficultyValue < 0.6) {
    return {
      label: "Sedang",
      value: difficultyValue,
      color: "bg-amber-100 text-amber-700 border-amber-200",
      description: "Memerlukan usaha متوسط untuk dijawab"
    };
  } else {
    return {
      label: "Sulit",
      value: difficultyValue,
      color: "bg-rose-100 text-rose-700 border-rose-200",
      description: "Hanya sebagian kecil siswa dapat menjawab dengan benar"
    };
  }
}

// Discrimination index based on Bloom's level
export function calculateDiscriminationSimulated(kognitif: string): DiscriminationIndex {
  // Higher Bloom levels typically have lower discrimination
  const bloomLevel = parseInt(kognitif.replace("C", "")) || 1;

  // Simulate discrimination index
  let value: number;
  if (bloomLevel <= 2) {
    value = 0.4 + Math.random() * 0.3; // C1-C2: Good discrimination
  } else if (bloomLevel <= 4) {
    value = 0.2 + Math.random() * 0.3; // C3-C4: Moderate discrimination
  } else {
    value = 0.0 + Math.random() * 0.3; // C5-C6: Lower discrimination
  }

  if (value >= 0.4) {
    return {
      label: "Baik",
      value,
      color: "bg-emerald-100 text-emerald-700 border-emerald-200",
      interpretation: "Soal mampu membedakan siswa berkemampuan tinggi dan rendah"
    };
  } else if (value >= 0.2) {
    return {
      label: "Cukup",
      value,
      color: "bg-amber-100 text-amber-700 border-amber-200",
      interpretation: "Soal cukup mampu membedakan kemampuan siswa"
    };
  } else {
    return {
      label: "Lemah",
      value,
      color: "bg-rose-100 text-rose-700 border-rose-200",
      interpretation: "Soal kurang mampu membedakan kemampuan siswa"
    };
  }
}

// Distractor analysis for multiple choice questions
export function analyzeDistractorsSimulated(
  opsi: string[] | null,
  kunci: string | string[],
  totalStudents: number = 30
): DistractorAnalysis[] {
  if (!Array.isArray(opsi) || opsi.length < 2) {
    return [];
  }

  const correctKey = Array.isArray(kunci) ? kunci[0] : String(kunci);
  const correctLetter = correctKey.match(/[A-H]/i)?.[0]?.toUpperCase() || "A";

  return opsi.map((option, idx) => {
    const letter = String.fromCharCode(65 + idx); // A, B, C, D, E...

    // Simulate selection distribution
    let selectedCount: number;
    if (letter === correctLetter) {
      selectedCount = Math.floor(totalStudents * (0.4 + Math.random() * 0.4)); // 40-80%
    } else {
      selectedCount = Math.floor(totalStudents * Math.random() * 0.2); // 0-20%
    }

    const percentage = (selectedCount / totalStudents) * 100;
    const isCorrect = letter === correctLetter;

    let effectiveness: "good" | "weak" | "poor";
    if (isCorrect) {
      effectiveness = percentage >= 30 ? "good" : "weak";
    } else {
      effectiveness = percentage >= 5 && percentage <= 30 ? "good" : percentage > 30 ? "weak" : "poor";
    }

    return {
      option: option.substring(0, 50) + (option.length > 50 ? "..." : ""),
      letter,
      selectedCount,
      percentage,
      isCorrect,
      effectiveness,
    };
  });
}

// Generate recommendation for question improvement
export function generateRecommendation(
  difficulty: DifficultyLevel,
  discrimination: DiscriminationIndex,
  distractors: DistractorAnalysis[]
): string {
  const issues: string[] = [];

  // Check difficulty
  if (difficulty.label === "Sulit") {
    issues.push("Pertimbangkan untuk menurunkan tingkat kesulitan atau memberikan petunjuk tambahan");
  }

  // Check discrimination
  if (discrimination.label === "Lemah") {
    issues.push("Soal perlu diperbaiki agar lebih mampu membedakan kemampuan siswa");
  }

  // Check distractors
  const poorDistractors = distractors.filter(d => !d.isCorrect && d.effectiveness === "poor");
  if (poorDistractors.length > 0) {
    issues.push(`${poorDistractors.length} pengecoh tidak efektif (pemilihan < 5%)`);
  }

  const weakDistractors = distractors.filter(d => !d.isCorrect && d.effectiveness === "weak");
  if (weakDistractors.length > 1) {
    issues.push("Beberapa pengecoh kurang menarik perhatian siswa");
  }

  if (issues.length === 0) {
    return "Soal sudah baik. Pertimbangkan untuk digunakan kembali dengan variasi.";
  }

  return issues.join(". ") + ".";
}

// Full item analysis for a question
export function analyzeQuestion(
  soal: any,
  index: number
): ItemAnalysis {
  const difficulty = calculateDifficultySimulated(soal.skor || 1, 5);
  const discrimination = calculateDiscriminationSimulated(soal.kognitif || "C1");
  const distractors = soal.tipe === "pg"
    ? analyzeDistractorsSimulated(soal.opsi, soal.kunci)
    : [];

  return {
    index,
    soalId: soal.id || `soal-${index}`,
    tipe: soal.tipe,
    pertanyaan: soal.pertanyaan.substring(0, 100) + (soal.pertanyaan.length > 100 ? "..." : ""),
    difficulty,
    discrimination,
    distractors,
    recommendation: generateRecommendation(difficulty, discrimination, distractors),
    hasVisual: !!(soal.gambar || soal.gambarData),
  };
}

// Aggregate statistics
export interface AggregateStats {
  totalSoal: number;
  avgDifficulty: number;
  avgDiscrimination: number;
  bloomDistribution: Record<string, number>;
  difficultyDistribution: Record<string, number>;
  questionsNeedingReview: number;
}

export function calculateAggregateStats(soalList: any[]): AggregateStats {
  let totalDifficulty = 0;
  let totalDiscrimination = 0;
  const bloomDistribution: Record<string, number> = {};
  const difficultyDistribution: Record<string, number> = {};
  let questionsNeedingReview = 0;

  soalList.forEach(soal => {
    const analysis = analyzeQuestion(soal, 0);
    totalDifficulty += analysis.difficulty.value;
    totalDiscrimination += analysis.discrimination.value;

    // Bloom distribution
    const bloom = soal.kognitif || "C1";
    bloomDistribution[bloom] = (bloomDistribution[bloom] || 0) + 1;

    // Difficulty distribution
    const diff = analysis.difficulty.label;
    difficultyDistribution[diff] = (difficultyDistribution[diff] || 0) + 1;

    // Questions needing review (difficult + weak discrimination)
    if (analysis.difficulty.label === "Sulit" || analysis.discrimination.label === "Lemah") {
      questionsNeedingReview++;
    }
  });

  const count = soalList.length || 1;

  return {
    totalSoal: count,
    avgDifficulty: totalDifficulty / count,
    avgDiscrimination: totalDiscrimination / count,
    bloomDistribution,
    difficultyDistribution,
    questionsNeedingReview,
  };
}
