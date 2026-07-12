/**
 * History Schema for Soal Versioning
 */

export type HistoryAction =
  | "generate"
  | "regenerate"
  | "edit"
  | "delete"
  | "import"
  | "reorder"
  | "duplicate"
  | "shuffle";

export interface HistoryEntry {
  id: string;
  timestamp: string;
  action: HistoryAction;
  soalIndex: number;
  soalId?: string;
  previousSoal?: any;
  newSoal?: any;
  soalSnapshot?: any[]; // Full list snapshot for major actions
  description: string;
  userId?: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
  currentIndex: number; // For undo/redo tracking
}

export const actionLabels: Record<HistoryAction, string> = {
  generate: "Generate Soal Baru",
  regenerate: "Regenerate Soal",
  edit: "Edit Soal",
  delete: "Hapus Soal",
  import: "Import Soal",
  reorder: "Urutkan Ulang",
  duplicate: "Duplikat Soal",
  shuffle: "Acak Soal",
};

export const actionIcons: Record<HistoryAction, string> = {
  generate: "✨",
  regenerate: "🔄",
  edit: "✏️",
  delete: "🗑️",
  import: "📥",
  reorder: "📋",
  duplicate: "📋",
  shuffle: "🔀",
};

export const actionColors: Record<HistoryAction, string> = {
  generate: "bg-emerald-100 text-emerald-700 border-emerald-200",
  regenerate: "bg-blue-100 text-blue-700 border-blue-200",
  edit: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delete: "bg-rose-100 text-rose-700 border-rose-200",
  import: "bg-teal-100 text-teal-700 border-teal-200",
  reorder: "bg-amber-100 text-amber-700 border-amber-200",
  duplicate: "bg-purple-100 text-purple-700 border-purple-200",
  shuffle: "bg-orange-100 text-orange-700 border-orange-200",
};

// Helper to create a history entry
export function createHistoryEntry(
  action: HistoryAction,
  soalIndex: number,
  previousSoal?: any,
  newSoal?: any,
  soalSnapshot?: any[],
  description?: string
): HistoryEntry {
  return {
    id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    action,
    soalIndex,
    previousSoal,
    newSoal,
    soalSnapshot,
    description: description || generateDescription(action, soalIndex, previousSoal, newSoal),
  };
}

function generateDescription(
  action: HistoryAction,
  soalIndex: number,
  previousSoal?: any,
  newSoal?: any
): string {
  switch (action) {
    case "generate":
      return `Generate ${newSoal?.length || 0} soal baru`;
    case "regenerate":
      return `Regenerate soal nomor ${soalIndex + 1}`;
    case "edit":
      return `Edit soal nomor ${soalIndex + 1}: "${truncate(previousSoal?.pertanyaan, 30)}"`;
    case "delete":
      return `Hapus soal nomor ${soalIndex + 1}: "${truncate(previousSoal?.pertanyaan, 30)}"`;
    case "import":
      return `Import ${newSoal?.length || 0} soal dari file`;
    case "reorder":
      return `Urutkan ulang soal nomor ${soalIndex + 1}`;
    case "duplicate":
      return `Duplikat soal nomor ${soalIndex + 1}`;
    case "shuffle":
      return "Acak urutan semua soal";
    default:
      return `Aksi: ${action}`;
  }
}

function truncate(str: string | undefined, length: number): string {
  if (!str) return "";
  return str.length > length ? str.substring(0, length) + "..." : str;
}

// LocalStorage helpers
const HISTORY_KEY = "soal_history";

export function saveHistoryToStorage(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save history to localStorage:", error);
  }
}

export function loadHistoryFromStorage(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error("Failed to load history from localStorage:", error);
    return [];
  }
}

export function clearHistoryStorage(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error("Failed to clear history from localStorage:", error);
  }
}

// Format timestamp for display
export function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days < 7) return `${days} hari lalu`;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
