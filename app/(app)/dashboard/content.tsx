"use client";
import { apiFetch } from "@/lib/api-client";
import React, { useState, useEffect, Suspense, useRef } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Sidebar from "@/app/components/Sidebar";
import FloatingActionButton from "@/components/ai/FloatingActionButton";
import RaportWriter from "@/components/rapor/RaportWriter";
import { SelesaiMengajarModal } from "@/components/selesai-mengajar";
import KisikisiExportModal from "@/components/soal/KisikisiExportModal";
import ImportSoalModal from "@/components/soal/ImportSoalModal";
import HistoryPanel from "@/components/soal/HistoryPanel";
import ItemAnalysisPanel from "@/components/soal/ItemAnalysisPanel";
import { IconClock } from '@tabler/icons-react';
import { useTeacherStore, useProfileStore } from "@/lib/stores";
import PoinHabisModal from "@/app/components/ui/PoinHabisModal";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import StreakIndicator from "@/components/streaks/StreakIndicator";
import MorningBriefingCard from "@/components/morning-briefing/MorningBriefingCard";
import VoiceTextInput from "@/components/voice/VoiceTextInput";
import RichMarkdown from "@/components/ai/RichMarkdown";
import MobileHomeMenu from "@/app/components/mobile/MobileHomeMenu";
import MobileBottomNav from "@/app/components/mobile/MobileBottomNav";
import AppIcon from "@/app/components/ui/AppIcon";
import { Calendar, School, BookOpen, Users, Clock } from "lucide-react";
import { getLucideIcon, resolveCategory, moduleFeatureKey, DASHBOARD_MODULES } from "@/lib/menuConfig";
import { useMenuVisibility } from "@/hooks/useMenuVisibility";
import { Pagination, usePagedItems } from "@/components/ui/pagination";
import ApprovalStatusBadge, { SubmitApprovalButton } from "@/components/approval/ApprovalStatusBadge";
import { buildKopSekolahHTML } from "@/lib/export/document-shared";

// Safe JSON fetch - always returns an object or array, never throws
async function safeJson(url: string): Promise<any> {
  const res = await apiFetch(url);
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Safe JSON parse of an existing Response (for chained fetches)
async function safeParse(res: Response): Promise<any> {
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// Dynamic CDN Loader for html2pdf.js
const loadHtml2Pdf = () => {
  return new Promise<any>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error("Cannot run PDF export on server-side."));
      return;
    }
    if ((window as any).html2pdf) {
      resolve((window as any).html2pdf);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      resolve((window as any).html2pdf);
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

function splitIntoBatches(formData: any) {
  const BATCH_SIZE = 40;
  const typeKeys = [
    { key: 'pg', tipe: 'pg' },
    { key: 'isian', tipe: 'isian' },
    { key: 'essay', tipe: 'essay' },
    { key: 'pgKompleks', tipe: 'pg-kompleks' },
    { key: 'bs', tipe: 'bs' },
    { key: 'jodoh', tipe: 'jodoh' },
    { key: 'urutan', tipe: 'urutan' },
    { key: 'tabel', tipe: 'tabel' },
    { key: 'sebabAkibat', tipe: 'sebab-akibat' }
  ];

  let remaining: any[] = [];
  for (const tk of typeKeys) {
    const qty = formData.qty[tk.key] || 0;
    if (qty > 0) remaining.push({ key: tk.key, tipe: tk.tipe, count: qty });
  }

  const visRemaining = {
    ilustrasi: formData.qty.ilustrasi || 0,
    diagram: formData.qty.diagram || 0,
    mindmap: formData.qty.mindmap || 0
  };

  const batches: any[] = [];
  while (remaining.length > 0) {
    let batchCount = 0;
    const batchData = JSON.parse(JSON.stringify(formData));
    batchData.qty = {};
    for (const tk of typeKeys) batchData.qty[tk.key] = 0;

    const stillRemaining: any[] = [];
    for (const item of remaining) {
      const canTake = Math.min(item.count, BATCH_SIZE - batchCount);
      if (canTake > 0) {
        batchData.qty[item.key] = canTake;
        batchCount += canTake;
        const leftover = item.count - canTake;
        if (leftover > 0) {
          stillRemaining.push({ ...item, count: leftover });
        }
      } else {
        stillRemaining.push(item);
      }
      if (batchCount >= BATCH_SIZE) break;
    }
    for (const item of remaining) {
      if (!batchData.qty[item.key] && item.count > 0 && !stillRemaining.find(s => s.key === item.key)) {
        stillRemaining.push(item);
      }
    }

    batchData.totalSoal = batchCount;

    const totalRemainingSoal = remaining.reduce((s, r) => s + r.count, 0);
    const batchVis = { ilustrasi: 0, diagram: 0, mindmap: 0 };
    for (const vk of ['ilustrasi', 'diagram', 'mindmap'] as const) {
      if (visRemaining[vk] > 0) {
        const targets = formData.visualMapping?.[vk] || [];
        const hasTargetTypeInBatch = targets.length === 0 || targets.some((t: string) => (batchData.qty[t] || 0) > 0);
        if (hasTargetTypeInBatch) {
          const share = Math.min(visRemaining[vk], Math.ceil(visRemaining[vk] * batchCount / totalRemainingSoal));
          batchVis[vk] = share;
          visRemaining[vk] -= share;
        }
      }
    }
    Object.assign(batchData.qty, batchVis);

    batches.push(batchData);
    remaining = stillRemaining;
  }

  return batches;
}
const getLocalDateString = () => {
  const d = new Date();
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  } catch (e) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2);

function getGreeting(hour: number) {
  if (hour < 12) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

function DashboardContent() {
  const router = useRouter();
  const { hiddenSet } = useMenuVisibility();
  const [currentDateTime, setCurrentDateTime] = useState<Date | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [greeting, setGreeting] = useState("Selamat pagi");

  useEffect(() => {
    setGreeting(getGreeting(new Date().getHours()));

    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 768;
      let initialOpen = true;
      if (isMobile) {
        initialOpen = false;
      } else {
        const saved = localStorage.getItem("gurupro_sidebar_open");
        if (saved !== null) {
          initialOpen = saved === "true";
        }
      }
      setIsSidebarOpen(initialOpen);

      const handleSidebarToggle = (e: any) => {
        setIsSidebarOpen(e.detail);
      };

      const handleResize = () => {
        if (window.innerWidth < 768) {
          setIsSidebarOpen(false);
        } else {
          const saved = localStorage.getItem("gurupro_sidebar_open");
          setIsSidebarOpen(saved === null ? true : saved === "true");
        }
      };

      window.addEventListener("gurupro_sidebar_toggled", handleSidebarToggle);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("gurupro_sidebar_toggled", handleSidebarToggle);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentDateTime(new Date());
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const getSubscriptionCountdown = () => {
    const isPro = currentUser?.status_langganan && currentUser.status_langganan !== 'free';
    if (!currentUser || !isPro || !currentUser.subscription_end) {
      return "Tidak Berlangganan";
    }
    if (!currentDateTime) return "Memuat...";

    const end = new Date(currentUser.subscription_end).getTime();
    const now = currentDateTime.getTime();
    const diff = end - now;

    if (diff <= 0) {
      return "Habis";
    }

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return `Tersisa ${days} hari`;
  };

  const isSubscriptionExpiringSoon = () => {
    const isPro = currentUser?.status_langganan && currentUser.status_langganan !== 'free';
    if (!currentUser || !isPro || !currentUser.subscription_end) return false;
    const diff = new Date(currentUser.subscription_end).getTime() - new Date().getTime();
    if (diff <= 0) return false;
    const daysLeft = diff / (1000 * 60 * 60 * 24);
    return daysLeft <= 7;
  };

  const isSubscriptionExpired = () => {
    const isPro = currentUser?.status_langganan && currentUser.status_langganan !== 'free';
    if (!currentUser || !isPro) return false;
    if (!currentUser.subscription_end) return true;
    const diff = new Date(currentUser.subscription_end).getTime() - new Date().getTime();
    return diff <= 0;
  };

  const isSubscriptionExpiredOver30Days = () => {
    const isPro = currentUser?.status_langganan && currentUser.status_langganan !== 'free';
    if (!currentUser || !isPro) return false;
    if (!currentUser.subscription_end) return false;
    const diff = new Date().getTime() - new Date(currentUser.subscription_end).getTime();
    return diff > 30 * 24 * 60 * 60 * 1000;
  };

  const formatIndonesianDateTime = (d: Date | null) => {
    if (!d) return "";
    const dateStr = d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    const timeStr = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const offset = d.getTimezoneOffset();
    let tz = "";
    if (offset === -420) tz = " WIB";
    else if (offset === -480) tz = " WITA";
    else if (offset === -540) tz = " WIT";
    
    return `${dateStr} | ${timeStr}${tz}`;
  };

  const [soalList, setSoalList] = useState<any[]>([]);
  const [mobileTab, setMobileTab] = useState<"config" | "preview">("config");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("soal");
  const [showKunciAll, setShowKunciAll] = useState(false);
  const [revealedKunci, setRevealedKunci] = useState<{ [key: number]: boolean }>({});
  const [reviewedQuestions, setReviewedQuestions] = useState<{ [key: string]: boolean }>({});
  const [pendingExportAction, setPendingExportAction] = useState<(() => void) | null>(null);
  
  // Kuis Simulator States
  const [quizScore, setQuizScore] = useState<number>(0);
  const [quizCheckedAnswers, setQuizCheckedAnswers] = useState<{ [key: number]: string }>({});
  
  // Metadata guru/sekolah untuk kop ujian
  const [metaInfo, setMetaInfo] = useState<any>({
    namaGuru: "",
    namaSekolah: "",
    mapel: "",
    kelas: "",
    jenjang: "",
    topik: "",
    tujuan: "",
    kurikulum: ""
  });
  const [currentFormData, setCurrentFormData] = useState<any>(null);

  // Reordering & Type Precedence States
  const [showTypeSorter, setShowTypeSorter] = useState(false);
  const [typeOrder, setTypeOrder] = useState<string[]>([
    "pg", "pg-kompleks", "bs", "jodoh", "urutan", "tabel", "sebab-akibat", "isian", "essay"
  ]);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSoal, setEditingSoal] = useState<any | null>(null);

  // Single Regenerating Loading State
  const [regeneratingIndexes, setRegeneratingIndexes] = useState<{ [key: number]: boolean }>({});

  // Single Imagen Loading State
  const [generatingImageIndexes, setGeneratingImageIndexes] = useState<{ [key: number]: boolean }>({});

  // Auto-Link Image Mode (for edit modal context)
  const [isGeneratingForEditModal, setIsGeneratingForEditModal] = useState(false);

  // Kisi-kisi Export Modal State
  const [isKisikisiExportModalOpen, setIsKisikisiExportModalOpen] = useState(false);

  // Import Soal Modal State
  const [isImportSoalModalOpen, setIsImportSoalModalOpen] = useState(false);

  // History/Versioning State
  const [soalHistory, setSoalHistory] = useState<any[]>([]);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

  // SaaS & Navigation States
  const [currentModule, setCurrentModule] = useState<
    "soal" | "administrasi" | "jurnal" | "keuangan" | "profil" | "sekolah" | "nilai" | "kalender" | "supervisi_analitik" | "tugas_harian" | "storage_saya" | "scheduler"
  >("tugas_harian");

  // Jangan tampilkan modul yang disembunyikan oleh konfigurasi peran institusi.
  useEffect(() => {
    if (hiddenSet.has(moduleFeatureKey(currentModule))) {
      const fallback =
        DASHBOARD_MODULES.find((m) => !hiddenSet.has(moduleFeatureKey(m.key)))?.key ??
        "tugas_harian";
      setCurrentModule(fallback as any);
    }
  }, [hiddenSet, currentModule]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [schoolsLoaded, setSchoolsLoaded] = useState(false);
  

  // Administrasi Module States
  const [savedDocs, setSavedDocs] = useState<any[]>([]);
  
  // Storage Saya & Explorer States
  const [allExplorerDocs, setAllExplorerDocs] = useState<any[]>([]);
  const [allExplorerJournals, setAllExplorerJournals] = useState<any[]>([]);
  const [allExplorerAssessments, setAllExplorerAssessments] = useState<any[]>([]);
  const [allExplorerDokumenBukti, setAllExplorerDokumenBukti] = useState<any[]>([]);
  const [openExplorerFolder, setOpenExplorerFolder] = useState<string>("root");
  const [selectedExplorerFile, setSelectedExplorerFile] = useState<any>(null);
  const [isLoadingExplorer, setIsLoadingExplorer] = useState<boolean>(false);
  const [explorerGrades, setExplorerGrades] = useState<any[]>([]);
  const [isLoadingGrades, setIsLoadingGrades] = useState<boolean>(false);
  const [explorerSearch, setExplorerSearch] = useState<string>("");
  const [adminDocType, setAdminDocType] = useState<string>("rpp");
  const [adminMapel, setAdminMapel] = useState<string>("");
  const [adminKelas, setAdminKelas] = useState<string>("");
  const [adminKurikulum, setAdminKurikulum] = useState<string>("merdeka");
  const [adminTopik, setAdminTopik] = useState<string>("");
  const [adminTujuan, setAdminTujuan] = useState<string>("");
  const [generatedDoc, setGeneratedDoc] = useState<any | null>(null);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState<boolean>(false);
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);

  const [rppSelesaiModal, setRppSelesaiModal] = useState<{ isOpen: boolean; rpp: any; schedule: any }>({
    isOpen: false,
    rpp: null,
    schedule: null,
  });

  // Jurnal & Ceklis States
  const [jurnalList, setJurnalList] = useState<any[]>([]);
  const [jurnalMapel, setJurnalMapel] = useState<string>("");
  const [jurnalKelas, setJurnalKelas] = useState<string>("");
  const [jurnalBahasan, setJurnalBahasan] = useState<string>("");
  const [jurnalCatatan, setJurnalCatatan] = useState<string>("");
  const [ceklisTasks, setCeklisTasks] = useState<any[]>([]);
  const [newCeklisTask, setNewCeklisTask] = useState<string>("");
  const [jurnalDate, setJurnalDate] = useState<string>(getLocalDateString());
  const [jurnalTab, setJurnalTab] = useState<"jurnal" | "ceklis">("jurnal");

  // Dynamic Teacher Journal States
  const [journalSubTab, setJournalSubTab] = useState<"tulis" | "supervisi" | "format">("tulis");
  const [journalSchemas, setJournalSchemas] = useState<any[]>([]);
  const [activeSchema, setActiveSchema] = useState<any | null>(null);
  const [journalMateri, setJournalMateri] = useState<string>("");
  const [journalTujuan, setJournalTujuan] = useState<string>("");
  const [journalAktivitas, setJournalAktivitas] = useState<string>("");
  const [journalMedia, setJournalMedia] = useState<string>("");
  const [journalAsesmen, setJournalAsesmen] = useState<string>("");
  const [journalKurikulum, setJournalKurikulum] = useState<string>("merdeka");
  const [journalRefleksi, setJournalRefleksi] = useState<string>("");
  const [journalTindakLanjut, setJournalTindakLanjut] = useState<string>("");
  const [journalEvidensi, setJournalEvidensi] = useState<string[]>([]); // array of base64
  const [journalCustomValues, setJournalCustomValues] = useState<{ [key: string]: any }>({});
  const [journalSupervisorId, setJournalSupervisorId] = useState<string>("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [supervisionList, setSupervisionList] = useState<any[]>([]);
  const [isAiGeneratingJournal, setIsAiGeneratingJournal] = useState<boolean>(false);
  const [isWritingJournal, setIsWritingJournal] = useState<boolean>(false);
  const [activeJournal, setActiveJournal] = useState<any | null>(null);
  const [supervisionComment, setSupervisionComment] = useState<string>("");
  const [supervisionRecom, setSupervisionRecom] = useState<string>("");
  
  // Format Schema Builder States
  const [schemaNama, setSchemaNama] = useState<string>("");
  const [schemaFields, setSchemaFields] = useState<any[]>([]);
  const [fieldLabel, setFieldLabel] = useState<string>("");
  const [fieldType, setFieldType] = useState<string>("text");
  const [fieldOpts, setFieldOpts] = useState<string>("");
  const [fieldReq, setFieldReq] = useState<boolean>(false);

  // TAMS (Teacher Administration Management System) States
  
  const [academicEvents, setAcademicEvents] = useState<any[]>([]);
  const [calEventName, setCalEventName] = useState<string>("");
  const [calStart, setCalStart] = useState<string>("");
  const [calEnd, setCalEnd] = useState<string>("");
  const [calKeterangan, setCalKeterangan] = useState<string>("");
  const [calActiveId, setCalActiveId] = useState<string>("");

  const [assessments, setAssessments] = useState<any[]>([]);
  const [activeAssessId, setActiveAssessId] = useState<string>("");
  const [assessName, setAssessName] = useState<string>("");
  const [assessType, setAssessType] = useState<string>("Formatif");
  const [assessKkm, setAssessKkm] = useState<number>(75);
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [supervisionDocsList, setSupervisionDocsList] = useState<any[]>([]);
  const [activeSupervisionDoc, setActiveSupervisionDoc] = useState<any | null>(null);
  const [docReviewComment, setDocReviewComment] = useState<string>("");
  const [isGeneratingAssessRubric, setIsGeneratingAssessRubric] = useState<boolean>(false);
  const [assessAILearningGoal, setAssessAILearningGoal] = useState<string>("");
  const [assessAIKurikulum, setAssessAIKurikulum] = useState<string>("merdeka");
  const [assessAIResult, setAssessAIResult] = useState<{
    rubrik?: string;
    soal?: { pertanyaan: string; pilihan: string[]; kunci_jawaban: string }[];
    saran_pedagogis?: string;
    raw?: string;
  } | null>(null);
  const [activeSupervisionTab, setActiveSupervisionTab] = useState<"nilai" | "jurnal_doc" | "rpp_doc" | "audit">("nilai");
  const [showSchoolSelectorModal, setShowSchoolSelectorModal] = useState<boolean>(false);

  // Token Modal State
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);
  const [tokenShortfall, setTokenShortfall] = useState<number>(0);

  // Raport Writer State
  const [selectedRaporStudent, setSelectedRaporStudent] = useState<any | null>(null);
  const [showRaportWriter, setShowRaportWriter] = useState<boolean>(false);

  // History/Versioning Management
  const addToHistory = (action: string, soalIndex: number, previousSoal?: any, newSoal?: any, soalSnapshot?: any[]) => {
    const entry = {
      id: `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      action,
      soalIndex,
      previousSoal,
      newSoal,
      soalSnapshot,
      description: generateHistoryDescription(action, soalIndex, previousSoal, newSoal),
    };
    setSoalHistory(prev => {
      const updated = [...prev, entry];
      // Keep max 100 entries
      if (updated.length > 100) {
        return updated.slice(-100);
      }
      return updated;
    });
  };

  const generateHistoryDescription = (action: string, soalIndex: number, previousSoal?: any, newSoal?: any): string => {
    const truncate = (str: string | undefined, len: number) => str ? (str.length > len ? str.substring(0, len) + "..." : str) : "";
    switch (action) {
      case "generate": return `Menghasilkan ${newSoal?.length || 0} soal baru`;
      case "regenerate": return `Menghasilkan ulang soal nomor ${soalIndex + 1}`;
      case "edit": return `Ubah soal nomor ${soalIndex + 1}: "${truncate(previousSoal?.pertanyaan, 30)}"`;
      case "delete": return `Hapus soal nomor ${soalIndex + 1}: "${truncate(previousSoal?.pertanyaan, 30)}"`;
      case "import": return `Import ${newSoal?.length || 0} soal dari file`;
      case "shuffle": return "Acak urutan semua soal";
      case "duplicate": return `Duplikat soal nomor ${soalIndex + 1}`;
      default: return `Aksi: ${action}`;
    }
  };

  const handleRestoreFromHistory = (entry: any) => {
    if (entry.soalSnapshot) {
      setSoalList(entry.soalSnapshot);
      addToHistory("restore", -1, null, null, entry.soalSnapshot);
      showSuccess("Soal berhasil di-restore!");
    }
  };

  const clearHistory = () => {
    if (confirm("Yakin ingin menghapus semua riwayat?")) {
      setSoalHistory([]);
      showSuccess("Riwayat berhasil dihapus!");
    }
  };

  // Save history to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && soalHistory.length > 0) {
      try {
        localStorage.setItem("soal_history", JSON.stringify(soalHistory.slice(-50)));
      } catch (e) {
        console.error("Failed to save history:", e);
      }
    }
  }, [soalHistory]);

  // Load history from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("soal_history");
        if (saved) {
          setSoalHistory(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    }
  }, []);

  // Keuangan States
  const [financeLedger, setFinanceLedger] = useState<any[]>([]);
  const [finKet, setFinKet] = useState<string>("");
  const [finJumlah, setFinJumlah] = useState<string>("");
  const [finTipe, setFinTipe] = useState<"pemasukan" | "pengeluaran">("pemasukan");
  const [finKat, setFinKat] = useState<string>("Gaji");
  const [finTgl, setFinTgl] = useState<string>(getLocalDateString());
  const [financeSavings, setFinanceSavings] = useState<any[]>([]);
  const [savGoal, setSavGoal] = useState<string>("");
  const [savTarget, setSavTarget] = useState<string>("");
  const [savSaved, setSavSaved] = useState<string>("");
  const [savDate, setSavDate] = useState<string>("");
  const [financeInvestments, setFinanceInvestments] = useState<any[]>([]);
  const [invNama, setInvNama] = useState<string>("");
  const [invKategori, setInvKategori] = useState<string>("Reksadana");
  const [invBeli, setInvBeli] = useState<string>("");
  const [invSekarang, setInvSekarang] = useState<string>("");
  const [financeDocId, setFinanceDocId] = useState<string>("");
  const [activeFinanceTab, setActiveFinanceTab] = useState<"arus_kas" | "tabungan" | "investasi" | "analisis" | "chat">("arus_kas");

  // Finance Chat States
  const [financeChatMessages, setFinanceChatMessages] = useState<Array<{
    id: string;
    role: 'user' | 'ai';
    type?: 'confirm' | 'saved';
    data?: any;
    text?: string;
    totalToday?: number;
    timestamp: number;
  }>>([]);
  const [financeChatInput, setFinanceChatInput] = useState<string>("");
  const [financeChatLoading, setFinanceChatLoading] = useState<boolean>(false);
  const [financeChatEditId, setFinanceChatEditId] = useState<string | null>(null);
  const [financeChatEditDraft, setFinanceChatEditDraft] = useState<{
    jumlah: string;
    tipe: string;
    kategori: string;
    tanggal: string;
    keterangan: string;
  } | null>(null);
  const financeChatEndRef = useRef<HTMLDivElement>(null);

  // Signatory States
  const [sigKepalaNama, setSigKepalaNama] = useState<string>("");
  const [sigKepalaNip, setSigKepalaNip] = useState<string>("");
  const [sigGuruNama, setSigGuruNama] = useState<string>("");
  const [sigGuruNip, setSigGuruNip] = useState<string>("");
  const [sigPengawasNama, setSigPengawasNama] = useState<string>("");
  const [sigPengawasNip, setSigPengawasNip] = useState<string>("");
  const [sigWaliNama, setSigWaliNama] = useState<string>("");
  const [sigWaliNip, setSigWaliNip] = useState<string>("");
  const [sigDocId, setSigDocId] = useState<string>("");

  const [brandingConfig, setBrandingConfig] = useState<{
    app_name: string;
    app_logo: string;
    accent_color: string;
    contact_email: string;
    contact_whatsapp: string;
  }>({
    app_name: "GuruPRO",
    app_logo: "",
    accent_color: "#4f46e5",
    contact_email: "support@gurupro.id",
    contact_whatsapp: ""
  });

  // Web Notification & In-App Notification Center States
  const [notifications, setNotifications] = useState<any[]>([]);


  // Scheduler States
  const [schedulers, setSchedulers] = useState<any[]>([]);
  const [schedTitle, setSchedTitle] = useState<string>("");
  const [schedDateTime, setSchedDateTime] = useState<string>("");

  // Profil States
  
  const [isCheckingOut, setIsCheckingOut] = useState<boolean>(false);

  // Sekolah & Akademik States
  const [schools, setSchools] = useState<any[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("");
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [schedules, setSchedules] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState<string>(getLocalDateString());
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [completedSessionIds, setCompletedSessionIds] = useState<Set<string>>(new Set());

  // Client-side pagination for data tables
  const studentsPager = usePagedItems(
    [...students].sort((a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999)),
    25
  );
  const studentGradesPager = usePagedItems(studentGrades, 25);
  const jurnalListPager = usePagedItems(jurnalList, 25);
  const auditLogsPager = usePagedItems(auditLogs, 25);
  const notificationsPager = usePagedItems(notifications, 25);

  useEffect(() => {
    const handleSessionDone = (e: Event) => {
      const { scheduleId } = ((e as CustomEvent).detail || {}) as { scheduleId?: string };
      if (!scheduleId) return;
      setCompletedSessionIds(prev => new Set([...prev, scheduleId]));
      // Remove localStorage active flag
      if (typeof window !== 'undefined' && scheduleId) {
        localStorage.removeItem(`teaching_session_${scheduleId}`);
      }
    };
    window.addEventListener('selesaiMengajarDone', handleSessionDone);
    return () => window.removeEventListener('selesaiMengajarDone', handleSessionDone);
  }, []);
  const [isSeedingData, setIsSeedingData] = useState<boolean>(false);
  
  // Form Inputs Sekolah
  const [schId, setSchId] = useState<string>("");
  const [schNama, setSchNama] = useState<string>("");
  const [schNpsn, setSchNpsn] = useState<string>("");
  const [schAlamat, setSchAlamat] = useState<string>("");
  const [schKepala, setSchKepala] = useState<string>("");
  const [schLogo, setSchLogo] = useState<string>(""); // base64 string
  const [schPengawas, setSchPengawas] = useState<string>("");
  const [schNipKepala, setSchNipKepala] = useState<string>("");
  const [schNipPengawas, setSchNipPengawas] = useState<string>("");
  const [schShowTtdKepala, setSchShowTtdKepala] = useState<boolean>(true);
  const [schShowTtdPengawas, setSchShowTtdPengawas] = useState<boolean>(true);
  const [schShowTtdWali, setSchShowTtdWali] = useState<boolean>(true);
  const [foundInstitution, setFoundInstitution] = useState<any | null>(null);
  const [connectingInstitution, setConnectingInstitution] = useState(false);
  
  // Form Inputs Tambah Kelas/Mapel/Siswa/Jadwal
  const [newClassName, setNewClassName] = useState<string>("");
  const [newClassWali, setNewClassWali] = useState<string>("");
  const [newClassWaliNip, setNewClassWaliNip] = useState<string>("");
  const [newClassWaliUser, setNewClassWaliUser] = useState<boolean>(false);
  const [editingClassId, setEditingClassId] = useState<string>("");
  const [newSubjectName, setNewSubjectName] = useState<string>("");
  const [editingSubjectId, setEditingSubjectId] = useState<string>("");
  const [editingSubjectName, setEditingSubjectName] = useState<string>("");
  const [editingStudentId, setEditingStudentId] = useState<string>("");
  const [newStudentName, setNewStudentName] = useState<string>("");
  const [newStudentNisn, setNewStudentNisn] = useState<string>("");
  const [newStudentAbsen, setNewStudentAbsen] = useState<string>("");
  const [editingEkskulId, setEditingEkskulId] = useState<string>("");
  const [newEkskulName, setNewEkskulName] = useState<string>("");
  const [newEkskulClassId, setNewEkskulClassId] = useState<string>("");
  const [newEkskulPembinaUser, setNewEkskulPembinaUser] = useState<boolean>(false);
  const [ekskulList, setEkskulList] = useState<any[]>([]);
  
  const [schDay, setSchDay] = useState<string>("Senin");
  const [schStart, setSchStart] = useState<string>("07:30");
  const [schEnd, setSchEnd] = useState<string>("09:00");
  const [editingScheduleId, setEditingScheduleId] = useState<string>("");

  // Presensi States
  const [teacherStatus, setTeacherStatus] = useState<string>("Hadir");
  const [teacherNotes, setTeacherNotes] = useState<string>("");
  const [studentAttRecords, setStudentAttRecords] = useState<{ [key: string]: { status: string; catatan: string } }>({});
  const [tabSekolah, setTabSekolah] = useState<"tahun-ajaran" | "profil" | "kelas-mapel" | "ekskul" | "siswa" | "jadwal" | "presensi">("tahun-ajaran");

  // Tahun Ajaran States
  const [tahunAjaranList, setTahunAjaranList] = useState<any[]>([]);
  const [showTahunAjaranModal, setShowTahunAjaranModal] = useState(false);
  const [tahunAjaranForm, setTahunAjaranForm] = useState({ nama: '', tanggalMulai: '', tanggalSelesai: '' });
  const [deleteModalTa, setDeleteModalTa] = useState<any>(null); // { id, nama }
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingTa, setDeletingTa] = useState(false);
  const [deleteTaError, setDeleteTaError] = useState('');

  // Delete Tahun Ajaran with password confirmation
  const handleDeleteTahunAjaran = async () => {
    if (!deleteModalTa || !deletePassword) return;
    setDeletingTa(true);
    setDeleteTaError('');

    try {
      const res = await apiFetch('/api/tahun-ajaran/' + deleteModalTa.id, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setDeleteModalTa(null);
        setDeletePassword('');
        fetchTahunAjaran();
      } else {
        setDeleteTaError(data.error || 'Gagal hapus');
      }
    } catch {
      setDeleteTaError('Terjadi kesalahan koneksi');
    } finally {
      setDeletingTa(false);
    }
  };

  // Fetch tahun ajaran list
  const fetchTahunAjaran = async (overrideSchoolId?: string) => {
    try {
      const schoolId = overrideSchoolId ?? selectedSchoolId
      const params = schoolId ? `?school_id=${schoolId}` : ''
      const res = await apiFetch(`/api/tahun-ajaran${params}`);
      if (res.ok) {
        const data = await res.json();
        setTahunAjaranList(data);
      }
    } catch (err) {
      console.error('Failed to fetch tahun ajaran:', err);
    }
  };

  // Activate tahun ajaran with semester
  const activateTahunAjaran = async (id: string, semester: string = 'ganjil') => {
    try {
      // Update localStorage first
      localStorage.setItem('tahunAjaranId', id);
      localStorage.setItem('semester', semester);
      const ta = tahunAjaranList.find((t: any) => t.id === id);
      if (ta) {
        localStorage.setItem('tahunAjaranNama', ta.nama);
        const label = semester === 'full' ? 'Full Year' : semester === 'ganjil' ? 'Semester 1' : 'Semester 2';
        localStorage.setItem('semesterLabel', ta.nama + ' - ' + label);
      }

      // Call API
      const res = await apiFetch('/api/tahun-ajaran/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', semester: semester }),
      });

      if (res.ok) {
        fetchTahunAjaran();
      }
    } catch (err) {
      console.error('Failed to activate:', err);
    }
  };

  // Create tahun ajaran
  const createTahunAjaran = async () => {
    if (!tahunAjaranForm.nama) {
      alert('Nama tahun ajaran wajib diisi');
      return;
    }
    if (!selectedSchoolId) {
      alert('Pilih sekolah terlebih dahulu sebelum membuat Tahun Ajaran');
      return;
    }
    try {
      console.log('Creating TA:', tahunAjaranForm);
      const res = await apiFetch('/api/tahun-ajaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: tahunAjaranForm.nama,
          tanggalMulai: tahunAjaranForm.tanggalMulai,
          tanggalSelesai: tahunAjaranForm.tanggalSelesai,
          sekolahId: selectedSchoolId,
        }),
      });

      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Response data:', data);

      if (res.ok) {
        setShowTahunAjaranModal(false);
        setTahunAjaranForm({ nama: '', tanggalMulai: '', tanggalSelesai: '' });
        fetchTahunAjaran();
        if (data.id) {
          activateTahunAjaran(data.id, 'ganjil');
        }
      } else {
        alert(data.error || 'Gagal menyimpan');
      }
    } catch (err) {
      console.error('Create TA error:', err);
      alert('Terjadi kesalahan saat menyimpan');
    }
  };

  // Listen to school changes from global TopBar
  useEffect(() => {
    const handleGlobalSchoolChange = () => {
      const savedSchoolId = typeof window !== "undefined" ? sessionStorage.getItem("gurupro_school_selected") : null;
      if (savedSchoolId) {
        setSelectedSchoolId(savedSchoolId);
        fetchTahunAjaran(savedSchoolId);
      }
    };
    window.addEventListener("gurupro_school_changed", handleGlobalSchoolChange);
    return () => window.removeEventListener("gurupro_school_changed", handleGlobalSchoolChange);
  }, []);

  // Load user profile and schools on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fetchProfile();
    // eslint-disable-next-line react-hooks/immutability
    fetchSignatures();
    // eslint-disable-next-line react-hooks/immutability
    fetchSchools();
    // eslint-disable-next-line react-hooks/immutability
    fetchSchedulers();

    const fetchBranding = async () => {
      try {
        const res = await apiFetch("/api/branding");
        if (res.ok) {
          const data = await res.json();
          setBrandingConfig(data);
        }
      } catch (e) {
        console.error("Gagal memuat branding:", e);
      }
    };
    fetchBranding();

    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }


  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll token/profile every 60s for real-time balance update
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === 'visible') {
        fetchProfile();
      }
    };
    const interval = setInterval(poll, 60000);
    return () => clearInterval(interval);
  }, []);

  const [notifiedScheduleIds, setNotifiedScheduleIds] = useState<{ [key: string]: string }>({});

  // Background Checker for Scheduler Reminders and Teaching Schedules
  useEffect(() => {
    const getIndonesianDayName = (date: Date) => {
      const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      return days[date.getDay()];
    };

    const checkReminders = () => {
      const now = new Date();
      let hasUpdates = false;

      // 1. Check custom scheduled reminders
      const updatedSchedulers = schedulers.map((item) => {
        if (!item.notified) {
          const itemTime = new Date(item.dateTime);
          if (now >= itemTime) {
            // eslint-disable-next-line react-hooks/immutability
            triggerWebNotification("Pengingat Aktivitas GuruPRO ⏰", item.title);
            item.notified = true;
            hasUpdates = true;
          }
        }
        return item;
      });

      if (hasUpdates) {
        setSchedulers(updatedSchedulers);
        // eslint-disable-next-line react-hooks/immutability
        saveSchedulers(updatedSchedulers);
      }

      // 2. Check automatic teaching schedules
      const today = getIndonesianDayName(now);
      const hour = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const timeStr = `${hour}:${min}`;

      schedules.forEach((sch) => {
        if (sch.hari && sch.hari.toLowerCase() === today.toLowerCase() && sch.jam_mulai === timeStr) {
          const key = `${sch.id}-${getLocalDateString()}`;
          if (!notifiedScheduleIds[key]) {
            triggerWebNotification(
              "Jadwal Mengajar Dimulai! 🏫",
              `Saatnya mengajar Kelas ${sch.nama_kelas} - ${sch.nama_mapel} (${sch.jam_mulai} - ${sch.jam_selesai})`
            );
            setNotifiedScheduleIds((prev) => ({ ...prev, [key]: getLocalDateString() }));
          }
        }
      });
    };

    const interval = setInterval(checkReminders, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedulers, schedules, notifiedScheduleIds]);

  // Listen for module switch events (always active)
  useEffect(() => {
    const handleSwitchModule = (e: Event) => {
      const customEvent = e as CustomEvent;
      const module = customEvent.detail?.module;
      console.log("[page.tsx] handleSwitchModule custom event received:", module);
      if (module && !hiddenSet.has(moduleFeatureKey(module))) {
        setCurrentModule(module as any);
      }
    };
    const handleSwitchFinanceTab = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tab = customEvent.detail?.tab;
      console.log("[page.tsx] handleSwitchFinanceTab custom event received:", tab);
      if (tab) {
        setActiveFinanceTab(tab as any);
      }
    };
    window.addEventListener('switchModule', handleSwitchModule);
    window.addEventListener('switchFinanceTab', handleSwitchFinanceTab);
    return () => {
      window.removeEventListener('switchModule', handleSwitchModule);
      window.removeEventListener('switchFinanceTab', handleSwitchFinanceTab);
    };
  }, []);

  const searchParams = useSearchParams();

  // Handle module param from URL (works even when navigating on same page)
  useEffect(() => {
    const moduleParam = searchParams.get("module");
    console.log("[page.tsx] searchParams useEffect triggered, moduleParam:", moduleParam);
    const validModules = [
      "soal",
      "administrasi",
      "jurnal",
      "keuangan",
      "profil",
      "sekolah",
      "nilai",
      "kalender",
      "supervisi_analitik",
      "tugas_harian",
      "storage_saya",
      "scheduler"
    ];
    if (moduleParam && validModules.includes(moduleParam)) {
      if (!hiddenSet.has(moduleFeatureKey(moduleParam))) {
        setCurrentModule(moduleParam as any);
      }
      
      // Handle active sub-tab for keuangan if specified
      const tabParam = searchParams.get("tab");
      if (moduleParam === "keuangan" && tabParam) {
        const validFinanceTabs = ["arus_kas", "tabungan", "investasi", "analisis", "chat"];
        if (validFinanceTabs.includes(tabParam)) {
          setActiveFinanceTab(tabParam as any);
        }
      }

      const url = new URL(window.location.href);
      url.searchParams.delete("module");
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams, hiddenSet]);

  // Verifikasi pembayaran setelah redirect dari payment gateway (fallback webhook)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get("payment");
    const txId = params.get("tx");
    if (paymentStatus === "success" && txId) {
      apiFetch("/api/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: txId }),
      })
        .then((r) => safeParse(r))
        .then((data) => {
          if (data.verified || data.alreadyActivated) {
            window.location.reload();
          }
        })
        .catch((e) => console.error("[page.tsx] verify payment failed:", e))
        .finally(() => {
          const url = new URL(window.location.href);
          url.searchParams.delete("payment");
          url.searchParams.delete("tx");
          window.history.replaceState({}, "", url.pathname + url.search);
        });
    }
  }, []);

  // Fetch related data when user is loaded
  useEffect(() => {
    if (currentUser) {
      // eslint-disable-next-line react-hooks/immutability
      fetchSavedDocs();
      // eslint-disable-next-line react-hooks/immutability
      fetchJournals();
      // eslint-disable-next-line react-hooks/immutability
      fetchChecklist();
      // eslint-disable-next-line react-hooks/immutability
      fetchNotifications();
      // eslint-disable-next-line react-hooks/immutability
      fetchKeuangan();
      fetchSignatures();
      fetchSchools();
      fetchSchedulers();

      // Check if checkout plan is requested in URL query
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const checkoutPlan = params.get("checkout");
        if (checkoutPlan && (
          checkoutPlan === "three_month" ||
          checkoutPlan === "six_month" ||
          checkoutPlan === "one_year" ||
          checkoutPlan === "free" ||
          checkoutPlan === "pro_monthly" ||
          checkoutPlan === "pro_yearly"
        )) {
          // Trigger checkout
          // eslint-disable-next-line react-hooks/immutability
          handlePlanCheckout(checkoutPlan);

          // Clear query param from URL to prevent re-triggering on reload
          const url = new URL(window.location.href);
          url.searchParams.delete("checkout");
          window.history.replaceState({}, "", url.pathname + url.search);
        }

        // Listen for Selesai Mengajar event from RPP detail
        const handleSelesaiMengajar = (e: Event) => {
          const customEvent = e as CustomEvent;
          setRppSelesaiModal({ isOpen: true, rpp: customEvent.detail.rpp, schedule: customEvent.detail.schedule });
        };
        window.addEventListener('openSelesaiMengajar', handleSelesaiMengajar);

        return () => {
          window.removeEventListener('openSelesaiMengajar', handleSelesaiMengajar);
        };
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Detect new user and show onboarding wizard
  useEffect(() => {
    if (currentUser && schools.length === 0 && schoolsLoaded && !localStorage.getItem("gurupro_onboarding_done")) {
      const timer = setTimeout(() => setShowOnboarding(true), 500);
      return () => clearTimeout(timer);
    }
  }, [currentUser?.id, schools.length, schoolsLoaded]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem("gurupro_onboarding_done", "true");
    fetchSchools();
  };

  const handleOnboardingSkip = () => {
    setShowOnboarding(false);
    localStorage.setItem("gurupro_onboarding_done", "true");
  };

  // Lookup institution by NPSN for connect feature
  useEffect(() => {
    if (!schNpsn || schNpsn.trim().length < 4) {
      setFoundInstitution(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/institutions/lookup?npsn=${encodeURIComponent(schNpsn.trim())}`);
        const data = await res.json();
        if (data.found) {
          setFoundInstitution(data.institution);
        } else {
          setFoundInstitution(null);
        }
      } catch {
        setFoundInstitution(null);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [schNpsn]);

  const handleConnectInstitution = async () => {
    if (!foundInstitution) return;
    setConnectingInstitution(true);
    try {
      const res = await apiFetch("/api/institutions/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npsn: schNpsn.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        setFoundInstitution(null);
        fetchSchools();
      } else {
        alert(data.error || "Gagal terhubung");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setConnectingInstitution(false);
    }
  };

  // Fetchers
  const fetchSchools = async () => {
    // 1. Try loading from cache first
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("gurupro_cached_schools");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setSchools(parsed);
            
            const savedSchoolId = sessionStorage.getItem("gurupro_school_selected");
            if (savedSchoolId && parsed.some(s => s.id === savedSchoolId)) {
              setSelectedSchoolId(savedSchoolId);
            } else if (parsed.length > 0 && !selectedSchoolId) {
              setSelectedSchoolId(parsed[0].id);
              if (parsed.length > 1) {
                setShowSchoolSelectorModal(true);
              }
            }
          }
        } catch (_) {}
      }
    }

    try {
      const res = await safeJson("/api/schools");
      if (Array.isArray(res)) {
        setSchools(res);
        
        const savedSchoolId = typeof window !== "undefined" ? sessionStorage.getItem("gurupro_school_selected") : null;
        if (savedSchoolId && res.some(s => s.id === savedSchoolId)) {
          setSelectedSchoolId(savedSchoolId);
        } else if (res.length > 0) {
          // Hanya set default ke sekolah pertama jika selectedSchoolId belum ada
          if (!selectedSchoolId) {
            setSelectedSchoolId(res[0].id);
          }
          // Jika sekolah lebih dari 1 dan belum ada sekolah yang dipilih di sesi ini, tampilkan selector modal
          if (res.length > 1 && !savedSchoolId) {
            setShowSchoolSelectorModal(true);
          }
        }
        
        // 2. Update background cache
        if (typeof window !== "undefined") {
          localStorage.setItem("gurupro_cached_schools", JSON.stringify(res));
        }
      }
      
      setSchoolsLoaded(true);
    } catch (e) {
      console.error(e);
      setSchoolsLoaded(true); // tetap set true agar onboarding tidak stuck
    }
  };

  const handleSelectSchoolFromModal = (schoolId: string) => {
    setSelectedSchoolId(schoolId);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gurupro_school_selected", schoolId);
      window.dispatchEvent(new Event("gurupro_school_changed"));
    }
    setShowSchoolSelectorModal(false);
  };

  const fetchClasses = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/classes?school_id=${schoolId}`);
      if (Array.isArray(res)) {
        setClasses(res);
        if (res.length > 0) setSelectedClassId(res[0].id);
        else setSelectedClassId("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSubjects = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/subjects?school_id=${schoolId}`);
      if (Array.isArray(res)) {
        setSubjects(res);
        if (res.length > 0) setSelectedSubjectId(res[0].id);
        else setSelectedSubjectId("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSchedules = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const [res, sesiRes] = await Promise.all([
        safeJson(`/api/schedules?school_id=${schoolId}`),
        apiFetch('/api/selesai-mengajar').catch(() => null),
      ]);

      // Try primary source: /api/schedules?school_id=X
      let schedulesData: any[] = [];
      if (Array.isArray(res) && res.length > 0) {
        schedulesData = res;
      }

      // Try fallback source: /api/selesai-mengajar (shows schedules from ALL schools)
      if (sesiRes?.ok) {
        const sesiData = await sesiRes.json();

        // Use allSchedules as fallback if primary returned nothing
        if (schedulesData.length === 0 && sesiData.allSchedules?.length > 0) {
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const hariIni = dayNames[new Date().getDay()];
          const fallback = sesiData.allSchedules
            .filter((s: any) => !schoolId || s.school_id === schoolId)
            .map((s: any) => ({
              id: s.id,
              school_id: s.school_id,
              class_id: s.class_id,
              subject_id: s.subject_id,
              hari: hariIni,
              jam_mulai: s.jam_mulai,
              jam_selesai: s.jam_selesai,
              nama_kelas: s.class_name,
              nama_mapel: s.subject_name,
            }));
          if (fallback.length > 0) schedulesData = fallback;
        }

        // Track completed sessions
        const completed = new Set<string>();
        sesiData.allSchedules?.forEach((s: any) => {
          if (s.isCompleted) completed.add(s.id);
        });
        setCompletedSessionIds(completed);
      }

      setSchedules(schedulesData);
    } catch (e) {
      console.error(e);
    }
  };

  const seedTestSchedules = async () => {
    setIsSeedingData(true);
    try {
      // Use seed-all endpoint that creates school, classes, subjects, and schedules
      const res = await apiFetch('/api/selesai-mengajar/seed-all', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        showSuccess(`Data berhasil dibuat: ${data.message}`);
        // Refresh schools and schedules
        fetchSchools();
        // Reload page data after a short delay to allow DB update
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        showError(data.error || 'Gagal membuat data test');
      }
    } catch (e) {
      showError('Gagal membuat data test');
    } finally {
      setIsSeedingData(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    if (!classId) {
      setStudents([]);
      return;
    }
    try {
      const res = await safeJson(`/api/students?class_id=${classId}&limit=100`);
      if (res?.data) setStudents(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Sync loaders
  useEffect(() => {
    if (selectedSchoolId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchClasses(selectedSchoolId);
      fetchSubjects(selectedSchoolId);
      fetchSchedules(selectedSchoolId);
      // eslint-disable-next-line react-hooks/immutability
      fetchJournalSchemas(selectedSchoolId);
      // eslint-disable-next-line react-hooks/immutability
      fetchTeacherJournals(selectedSchoolId);
      // eslint-disable-next-line react-hooks/immutability
      fetchTahunAjaran(selectedSchoolId);
      fetchEkskul();
    } else {
      setClasses([]);
      setSubjects([]);
      setSchedules([]);
      setJournalSchemas([]);
      setJurnalList([]);
      setTahunAjaranList([]);
      setEkskulList([]);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    if (selectedClassId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudents(selectedClassId);
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const fetchTeacherAttendance = async () => {
    try {
      const res = await safeJson(`/api/attendance?type=teacher&school_id=${selectedSchoolId}&limit=100`);
      const list = res?.data ?? [];
      const todayLog = list.find((l: any) => l.tanggal.split("T")[0] === attendanceDate);
      if (todayLog) {
        setTeacherStatus(todayLog.status);
        setTeacherNotes(todayLog.catatan || "");
      } else {
        setTeacherStatus("Hadir");
        setTeacherNotes("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudentAttendance = async () => {
    try {
      const res = await safeJson(`/api/attendance?type=student&schedule_id=${selectedScheduleId}&tanggal=${attendanceDate}&limit=100`);
      const records: any = {};
      const list = res?.data ?? [];
      list.forEach((log: any) => {
        records[log.student_id] = { status: log.status, catatan: log.catatan || "" };
      });
      setStudentAttRecords(records);
    } catch (e) {
      console.error(e);
    }
  };

  // Load attendance data when schedule or date changes
  useEffect(() => {
    if (selectedScheduleId && attendanceDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudentAttendance();
    } else {
      setStudentAttRecords({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScheduleId, attendanceDate]);

  useEffect(() => {
    if (selectedSchoolId && attendanceDate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTeacherAttendance();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSchoolId, attendanceDate]);

  // Operations
  const handleAddSchool = async () => {
    if (!schNama) {
      showError("Nama sekolah wajib diisi");
      return;
    }
    try {
      const res = await apiFetch("/api/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schId || null,
          nama_sekolah: schNama,
          logo: schLogo || null,
          alamat: schAlamat,
          npsn: schNpsn,
          nama_kepala_sekolah: schKepala,
          nama_pengawas: schPengawas,
          nip_kepala_sekolah: schNipKepala,
          nip_pengawas: schNipPengawas,
          show_ttd_kepala: schShowTtdKepala,
          show_ttd_pengawas: schShowTtdPengawas,
          show_ttd_wali: schShowTtdWali
        }),
      });
      if (res.ok) {
        showSuccess(schId ? "Sekolah berhasil diperbarui!" : "Sekolah berhasil ditambahkan!");
        setSchId("");
        setSchNama("");
        setSchNpsn("");
        setSchAlamat("");
        setSchKepala("");
        setSchLogo("");
        setSchPengawas("");
        setSchNipKepala("");
        setSchNipPengawas("");
        setSchShowTtdKepala(true);
        setSchShowTtdPengawas(true);
        setSchShowTtdWali(true);
        fetchSchools();
      } else {
        const err = await res.json();
        showError(err.error || "Gagal menyimpan sekolah");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus sekolah ini beserta seluruh kelas, murid, jadwal, dan absensi di dalamnya?")) return;
    try {
      const res = await apiFetch(`/api/schools?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showSuccess("Sekolah berhasil dihapus");
        if (selectedSchoolId === id) setSelectedSchoolId("");
        fetchSchools();
      } else {
        showError("Gagal menghapus sekolah");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleAddClass = async () => {
    if (!newClassName || !selectedSchoolId) return;
    if (!newClassWali) { showError("Wali kelas wajib diisi"); return; }
    if (isSubscriptionExpired()) {
      if (classes.length >= 2 && !editingClassId) {
        showError("Masa aktif langganan habis. Anda hanya dapat membuat maksimal 2 kelas. Perbarui paket untuk akses tanpa batas.");
        return;
      }
    }
    try {
      const res = await apiFetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingClassId || null,
          school_id: selectedSchoolId,
          nama_kelas: newClassName,
          wali_kelas: newClassWali,
          wali_kelas_nip: newClassWaliNip,
          wali_kelas_user_id: newClassWaliUser ? currentUser?.id : null,
        }),
      });
      if (res.ok) {
        setNewClassName("");
        setNewClassWali("");
        setNewClassWaliNip("");
        setNewClassWaliUser(false);
        setEditingClassId("");
        fetchClasses(selectedSchoolId);
        showSuccess(editingClassId ? "Kelas berhasil diperbarui!" : "Kelas berhasil ditambahkan!");
      } else {
        showError(editingClassId ? "Gagal memperbarui kelas" : "Gagal menambahkan kelas");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleDeleteClass = async (id: string) => {
    if (!confirm("Hapus kelas ini beserta data siswa di dalamnya?")) return;
    try {
      const res = await apiFetch(`/api/classes?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchClasses(selectedSchoolId);
        fetchEkskul();
        showSuccess("Kelas berhasil dihapus");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleAddSubject = async () => {
    if (!newSubjectName || !selectedSchoolId) return;
    try {
      const isEdit = !!editingSubjectId;
      const res = await apiFetch("/api/subjects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { id: editingSubjectId, nama_mapel: newSubjectName }
            : { school_id: selectedSchoolId, nama_mapel: newSubjectName }
        ),
      });
      if (res.ok) {
        setNewSubjectName("");
        setEditingSubjectId("");
        fetchSubjects(selectedSchoolId);
        showSuccess(isEdit ? "Mata pelajaran berhasil diperbarui!" : "Mata pelajaran berhasil ditambahkan");
      } else {
        showError(isEdit ? "Gagal memperbarui mata pelajaran" : "Gagal menambahkan mata pelajaran");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!confirm("Hapus mata pelajaran ini?")) return;
    try {
      const res = await apiFetch(`/api/subjects?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSubjects(selectedSchoolId);
        showSuccess("Mata pelajaran berhasil dihapus");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const fetchEkskul = async () => {
    if (!selectedSchoolId) {
      setEkskulList([]);
      return;
    }
    try {
      const res = await apiFetch(`/api/ekstrakurikuler?schoolId=${selectedSchoolId}`);
      if (res.ok) {
        const data = await res.json();
        setEkskulList(data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch ekskul", e);
    }
  };

  const handleAddEkskul = async () => {
    if (!newEkskulName || !newEkskulClassId) return;
    try {
      const body: any = {
        namaEkskul: newEkskulName,
        kelasId: newEkskulClassId,
        pembinaUserId: newEkskulPembinaUser ? currentUser?.id : null,
      };
      const res = await apiFetch("/api/ekstrakurikuler", {
        method: editingEkskulId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingEkskulId ? { id: editingEkskulId } : {}),
          ...body,
        }),
      });
      if (res.ok) {
        setNewEkskulName("");
        setNewEkskulClassId("");
        setNewEkskulPembinaUser(false);
        setEditingEkskulId("");
        fetchEkskul();
        showSuccess(editingEkskulId ? "Ekstrakurikuler berhasil diperbarui!" : "Ekstrakurikuler berhasil ditambahkan!");
      } else {
        showError(editingEkskulId ? "Gagal memperbarui ekstrakurikuler" : "Gagal menambahkan ekstrakurikuler");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleDeleteEkskul = async (id: string) => {
    if (!confirm("Hapus ekstrakurikuler ini?")) return;
    try {
      const res = await apiFetch(`/api/ekstrakurikuler?id=${id}&school_id=${selectedSchoolId}`, { method: "DELETE" });
      if (res.ok) {
        fetchEkskul();
        showSuccess("Ekstrakurikuler berhasil dihapus");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleAddStudent = async () => {
    if (!newStudentName || !selectedClassId) return;
    if (!editingStudentId && isSubscriptionExpired()) {
      if (students.length >= 5) {
        showError("Masa aktif langganan habis. Anda hanya dapat menambahkan maksimal 5 siswa per kelas. Perbarui paket untuk akses tanpa batas.");
        return;
      }
    }
    try {
      const isEdit = !!editingStudentId;
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEdit ? { id: editingStudentId } : {}),
          class_id: selectedClassId,
          nama_siswa: newStudentName,
          nisn: newStudentNisn,
          nomor_absen: newStudentAbsen ? parseInt(newStudentAbsen) : null,
        }),
      });
      if (res.ok) {
        setNewStudentName("");
        setNewStudentNisn("");
        setNewStudentAbsen("");
        setEditingStudentId("");
        fetchStudents(selectedClassId);
        showSuccess(isEdit ? "Siswa berhasil diperbarui!" : "Siswa berhasil ditambahkan");
      } else {
        showError(isEdit ? "Gagal memperbarui siswa" : "Gagal menambahkan siswa");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Hapus siswa ini?")) return;
    try {
      const res = await apiFetch(`/api/students?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchStudents(selectedClassId);
        showSuccess("Siswa berhasil dihapus");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedSchoolId || !selectedClassId || !selectedSubjectId) {
      showError("Pilih sekolah, kelas, dan mapel terlebih dahulu");
      return;
    }
    try {
      const isEdit = !!editingScheduleId;
      const res = await apiFetch("/api/schedules", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { id: editingScheduleId, class_id: selectedClassId, subject_id: selectedSubjectId, hari: schDay, jam_mulai: schStart, jam_selesai: schEnd }
            : { school_id: selectedSchoolId, class_id: selectedClassId, subject_id: selectedSubjectId, hari: schDay, jam_mulai: schStart, jam_selesai: schEnd }
        ),
      });
      if (res.ok) {
        setEditingScheduleId("");
        fetchSchedules(selectedSchoolId);
        showSuccess(isEdit ? "Jadwal berhasil diperbarui!" : "Jadwal berhasil ditambahkan");
      } else {
        showError(isEdit ? "Gagal memperbarui jadwal" : "Gagal menambahkan jadwal");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm("Hapus jadwal ini?")) return;
    try {
      const res = await apiFetch(`/api/schedules?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSchedules(selectedSchoolId);
        showSuccess("Jadwal berhasil dihapus");
      }
    } catch (e) {
      showError("Koneksi bermasalah");
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedSchoolId || !attendanceDate) return;
    try {
      // 1. Simpan absensi mengajar guru
      await apiFetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "teacher",
          school_id: selectedSchoolId,
          tanggal: attendanceDate,
          status: teacherStatus,
          catatan: teacherNotes,
        }),
      });

      // 2. Simpan absensi siswa jika ada jadwal terpilih
      if (selectedScheduleId) {
        const records = students.map(s => ({
          student_id: s.id,
          status: studentAttRecords[s.id]?.status || "Hadir",
          catatan: studentAttRecords[s.id]?.catatan || "",
        }));

        await apiFetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "student",
            schedule_id: selectedScheduleId,
            tanggal: attendanceDate,
            records,
          }),
        });
      }

      showSuccess("Presensi berhasil disimpan ke database cloud!");
    } catch (e) {
      showError("Gagal menyimpan presensi.");
    }
  };

  const downloadStudentTemplate = () => {
    const csvContent = 
      "sep=,\n" +
      "=== GURUPRO PREMIUM ===\n" +
      "Tipe Dokumen: Template Impor Data Siswa\n" +
      "Petunjuk Pengisian:\n" +
      "1. Isi Nama Siswa, NISN (opsional, 10 digit), dan Nomor Absen.\n" +
      "2. Jangan mengubah susunan kolom tabel di bawah ini.\n" +
      "3. Mulai mengisi data baru tepat di bawah baris judul kolom.\n" +
      "=======================\n\n" +
      "Nama Siswa,NISN,Nomor Absen\n" +
      "Ahmad Fauzi,1234567890,1\n" +
      "Siti Aminah,0987654321,2\n" +
      "Budi Santoso,1122334455,3\n" +
      "Dewi Lestari,5544332211,4";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_siswa_gurupro.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClassId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const res = await apiFetch("/api/students/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ class_id: selectedClassId, csvContent: text }),
        });
        const data = await res.json();
        if (res.ok) {
          showSuccess(data.message || "Siswa berhasil diimpor!");
          fetchStudents(selectedClassId);
        } else {
          showError(data.error || "Gagal mengimpor siswa.");
        }
      } catch (err) {
        showError("Masalah jaringan saat mengimpor data.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const downloadScheduleTemplate = () => {
    const csvContent = 
      "sep=,\n" +
      "=== GURUPRO PREMIUM ===\n" +
      "Tipe Dokumen: Template Impor Jadwal Pelajaran\n" +
      "Petunjuk Pengisian:\n" +
      "1. Hari harus ditulis lengkap (Senin, Selasa, Rabu, Kamis, Jumat, Sabtu, Minggu).\n" +
      "2. Format jam menggunakan format 24 jam HH:MM (contoh: 07:30 atau 14:15).\n" +
      "3. Nama Kelas dan Nama Mapel akan dibuat otomatis jika belum terdaftar.\n" +
      "=======================\n\n" +
      "Hari,Jam Mulai,Jam Selesai,Nama Kelas,Nama Mapel\n" +
      "Senin,07:30,09:00,X MIPA 1,Matematika Wajib\n" +
      "Senin,09:15,10:45,X MIPA 1,Bahasa Indonesia\n" +
      "Selasa,07:30,09:00,XI IPS 2,Sejarah Indonesia\n" +
      "Rabu,10:00,11:30,XII MIPA 3,Fisika";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_jadwal_gurupro.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScheduleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSchoolId) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      try {
        const res = await apiFetch("/api/schedules/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ school_id: selectedSchoolId, csvContent: text }),
        });
        const data = await res.json();
        if (res.ok) {
          showSuccess(data.message || "Jadwal berhasil diimpor!");
          fetchSchedules(selectedSchoolId);
          fetchClasses(selectedSchoolId);
          fetchSubjects(selectedSchoolId);
        } else {
          showError(data.error || "Gagal mengimpor jadwal.");
        }
      } catch (err) {
        showError("Masalah jaringan saat mengimpor data.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      showError("Ukuran file logo tidak boleh melebihi 500KB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSchLogo(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fetchJournalSchemas = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/journals/schemas?school_id=${schoolId}`);
      if (Array.isArray(res)) {
        setJournalSchemas(res);
        if (res.length > 0) setActiveSchema(res[0]);
        else setActiveSchema(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeacherJournals = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/journals?school_id=${schoolId}&limit=100`);
      if (res?.data) setJurnalList(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSupervisions = async () => {
    try {
      const res = await safeJson("/api/journals/supervision");
      if (Array.isArray(res)) setSupervisionList(res);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await safeJson(`/api/users?school_id=${selectedSchoolId}`);
      setAllUsers(res?.data ?? (Array.isArray(res) ? res : []));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSchema = async () => {
    if (!selectedSchoolId || !schemaNama) return;
    try {
      const res = await apiFetch("/api/journals/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: selectedSchoolId,
          nama_skema: schemaNama,
          fields: schemaFields,
        }),
      });
      if (res.ok) {
        showSuccess("Format jurnal berhasil disimpan!");
        setSchemaNama("");
        setSchemaFields([]);
        fetchJournalSchemas(selectedSchoolId);
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menyimpan format jurnal");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleDeleteSchema = async (id: string) => {
    if (!confirm("Hapus format jurnal ini?")) return;
    try {
      const res = await apiFetch(`/api/journals/schemas?id=${id}&school_id=${selectedSchoolId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showSuccess("Format jurnal berhasil dihapus!");
        fetchJournalSchemas(selectedSchoolId);
      } else {
        showError("Gagal menghapus format jurnal.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleSaveJournal = async (status: "Draft" | "Submitted") => {
    if (!selectedSchoolId || !selectedClassId || !selectedSubjectId || !jurnalDate || !journalMateri || !journalTujuan || !journalAktivitas) {
      showError("Mohon lengkapi kolom-kolom utama yang wajib diisi!");
      return;
    }
    if (isSubscriptionExpired()) {
      if (jurnalList.length >= 3 && !activeJournal?.id) {
        showError("Masa aktif langganan habis. Anda hanya dapat membuat maksimal 3 jurnal. Perbarui paket untuk akses tanpa batas.");
        return;
      }
    }
    try {
      const payload = {
        id: activeJournal?.id || null,
        school_id: selectedSchoolId,
        schedule_id: selectedScheduleId || null,
        class_id: selectedClassId,
        subject_id: selectedSubjectId,
        tanggal: jurnalDate,
        materi_pembelajaran: journalMateri,
        tujuan_pembelajaran: journalTujuan,
        aktivitas_pembelajaran: journalAktivitas,
        media_pembelajaran: journalMedia,
        asesmen_pembelajaran: journalAsesmen,
        refleksi_guru: journalRefleksi,
        tindak_lanjut: journalTindakLanjut,
        evidensi: journalEvidensi,
        custom_values: journalCustomValues,
        status: status,
        supervisor_id: journalSupervisorId || null,
      };

      const res = await apiFetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showSuccess(status === "Draft" ? "Jurnal disimpan sebagai Draft!" : "Jurnal berhasil dikirim ke Supervisor!");
        setIsWritingJournal(false);
        setActiveJournal(null);
        setJournalMateri("");
        setJournalTujuan("");
        setJournalAktivitas("");
        setJournalMedia("");
        setJournalAsesmen("");
        setJournalRefleksi("");
        setJournalTindakLanjut("");
        setJournalEvidensi([]);
        setJournalCustomValues({});
        setJournalSupervisorId("");
        fetchTeacherJournals(selectedSchoolId);
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menyimpan jurnal");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleDeleteJournal = async (id: string) => {
    if (!confirm("Hapus jurnal ini secara permanen?")) return;
    try {
      const res = await apiFetch(`/api/journals?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showSuccess("Jurnal berhasil dihapus");
        fetchTeacherJournals(selectedSchoolId);
      } else {
        showError("Gagal menghapus jurnal");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handlePrintJournal = (j: any) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk mencetak jurnal.");
      return;
    }
    const school = schools.find(s => s.id === selectedSchoolId);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const formattedDate = new Date(j.tanggal).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const isApproved = j.status === "Approved";
    const supervisorName = j.nama_supervisor || "Supervisor";
    const stampHtml = isApproved ? `
      <div style="border: 2px dashed #059669; text-align: center; border-radius: 10px; padding: 6px; color: #059669; font-weight: 900; font-size: 8px; font-family: sans-serif; display: inline-block; transform: rotate(-3deg); margin: 5px 0;">
        GURUPRO OFFICIAL STAMP<br/>
        <span style="font-size: 11px;">⭐ APPROVED ⭐</span><br/>
        BY ${supervisorName}<br/>
        TGL: ${j.ulasan?.created_at ? new Date(j.ulasan.created_at).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID')}
      </div>
    ` : '<div style="height: 60px;"></div>';

    const clsObj = classes.find(c => c.id === j.class_id || c.nama_kelas === j.nama_kelas);
    const waliName = clsObj?.wali_kelas || "___________________________";

    let signaturesHtml = "";
    if (school) {
      if (school.show_ttd_kepala !== false) {
        signaturesHtml += `
          <div class="sig-box">
            <p>Mengetahui,</p>
            <p style="font-weight: bold;">Kepala Sekolah</p>
            ${stampHtml}
            <p style="text-decoration: underline; font-weight: bold;">( ${school.nama_kepala_sekolah || "___________________________"} )</p>
            <p style="font-size: 10px; color: #555;">NIP: ${school.nip_kepala_sekolah || "..........................................."}</p>
          </div>
        `;
      }
      
      // Guru (Always show)
      signaturesHtml += `
        <div class="sig-box">
          <p>&nbsp;</p>
          <p style="font-weight: bold;">Guru Mata Pelajaran</p>
          <div style="height: 60px;"></div>
          <p style="text-decoration: underline; font-weight: bold;">( ${j.nama_guru || currentUser?.nama_lengkap || "___________________________"} )</p>
          <p style="font-size: 10px; color: #555;">NIP: ${currentUser?.nip || "..........................................."}</p>
        </div>
      `;

      if (school.show_ttd_pengawas !== false) {
        signaturesHtml += `
          <div class="sig-box" style="margin-top: 20px;">
            <p>Menyetujui,</p>
            <p style="font-weight: bold;">Pengawas Sekolah Pembina</p>
            <div style="height: 60px;"></div>
            <p style="text-decoration: underline; font-weight: bold;">( ${school.nama_pengawas || "___________________________"} )</p>
            <p style="font-size: 10px; color: #555;">NIP: ${school.nip_pengawas || "..........................................."}</p>
          </div>
        `;
      }

      if (school.show_ttd_wali !== false) {
        signaturesHtml += `
          <div class="sig-box" style="margin-top: 20px;">
            <p>&nbsp;</p>
            <p style="font-weight: bold;">Wali Kelas</p>
            <div style="height: 60px;"></div>
            <p style="text-decoration: underline; font-weight: bold;">( ${waliName || school.nama_wali_kelas} )</p>
            <p style="font-size: 10px; color: #555;">NIP: ${clsObj?.wali_kelas_nip || school.nip_wali_kelas || "..........................................."}</p>
          </div>
        `;
      }
    } else {
      signaturesHtml += `
        <div class="sig-box">
          <p>&nbsp;</p>
          <p style="font-weight: bold;">Guru Mata Pelajaran</p>
          <div style="height: 60px;"></div>
          <p style="text-decoration: underline; font-weight: bold;">( ${j.nama_guru || currentUser?.nama_lengkap || "___________________________"} )</p>
        </div>
      `;
    }

    let kopHtml = "";
    if (school) {
      kopHtml = `
        <div style="display: flex; align-items: center; border-bottom: 3px double black; padding-bottom: 12px; margin-bottom: 20px;">
          ${school.logo ? `<img src="${school.logo}" style="width: 80px; height: auto; margin-right: 20px;" />` : ""}
          <div style="flex: 1; text-align: center;">
            <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">${school.nama_sekolah}</h2>
            ${school.npsn ? `<p style="margin: 2px 0; font-size: 11px;">NPSN: ${school.npsn}</p>` : ""}
            ${school.alamat ? `<p style="margin: 2px 0; font-size: 11px;">${school.alamat}</p>` : ""}
          </div>
        </div>
      `;
    } else {
      kopHtml = `
        <div style="text-align: center; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 20px;">
          <h2 style="margin: 0; text-transform: uppercase;">JURNAL HARIAN MENGAJAR</h2>
          <p style="margin: 2px 0;">Sistem Administrasi GuruPro</p>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>Cetak Jurnal - ${j.materi_pembelajaran}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: black; padding: 20px; }
          .title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 8px; vertical-align: top; text-align: left; }
          th { background-color: #f2f2f2; width: 30%; font-weight: bold; }
          .sig-container { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 40px; page-break-inside: avoid; }
          .sig-box { text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
          .sig-box p { margin: 2px 0; }
        </style>
      </head>
      <body>
        ${kopHtml}
        
        <div class="title">Jurnal Pelaksanaan Pembelajaran</div>
        
        <table>
          <tr>
            <th>Hari / Tanggal</th>
            <td>${formattedDate}</td>
          </tr>
          <tr>
            <th>Kelas / Mata Pelajaran</th>
            <td>Kelas ${j.nama_kelas} - ${j.nama_mapel}</td>
          </tr>
          <tr>
            <th>Bahasan / Materi Utama</th>
            <td><strong>${j.materi_pembelajaran}</strong></td>
          </tr>
          <tr>
            <th>Tujuan Pembelajaran</th>
            <td>${j.tujuan_pembelajaran}</td>
          </tr>
          <tr>
            <th>Aktivitas Pembelajaran</th>
            <td>${j.aktivitas_pembelajaran ? j.aktivitas_pembelajaran.replace(/\n/g, '<br/>') : ""}</td>
          </tr>
          <tr>
            <th>Media Pembelajaran</th>
            <td>${j.media_pembelajaran || "-"}</td>
          </tr>
          <tr>
            <th>Asesmen Pembelajaran</th>
            <td>${j.asesmen_pembelajaran || "-"}</td>
          </tr>
          <tr>
            <th>Refleksi Guru</th>
            <td>${j.refleksi_guru || "-"}</td>
          </tr>
          <tr>
            <th>Rencana Tindak Lanjut</th>
            <td>${j.tindak_lanjut || "-"}</td>
          </tr>
          ${j.ulasan?.catatan ? `
          <tr>
            <th>Catatan Ulasan Supervisor</th>
            <td>
              <strong>[${j.status}]</strong> ${j.ulasan.catatan}
              ${j.ulasan.rekomendasi ? `<br/><span style="font-style: italic;">Rekomendasi: ${j.ulasan.rekomendasi}</span>` : ""}
            </td>
          </tr>
          ` : ""}
        </table>

        <div class="sig-container">
          ${signaturesHtml}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintJournalTable = () => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk mencetak jurnal.");
      return;
    }
    if (jurnalList.length === 0) {
      showError("Tidak ada data jurnal untuk dicetak.");
      return;
    }
    const school = schools.find(s => s.id === selectedSchoolId);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Get unique subjects and classes represented in the list
    const representedClasses = Array.from(new Set(jurnalList.map(j => j.nama_kelas))).join(", ");
    const representedSubjects = Array.from(new Set(jurnalList.map(j => j.nama_mapel))).join(", ");

    const uniqueWaliKelasList = Array.from(
      new Set(
        jurnalList
          .map(j => {
            const cls = classes.find(c => c.id === j.class_id || c.nama_kelas === j.nama_kelas);
            return cls?.wali_kelas;
          })
          .filter((w): w is string => !!w)
      )
    );
    const uniqueWaliKelas = uniqueWaliKelasList.length > 0 ? uniqueWaliKelasList.join(", ") : "___________________________";

    const rowsHtml = jurnalList.map((j, idx) => {
      const dateStr = new Date(j.tanggal).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });

      const sCount = Number(j.sakit_count || 0);
      const iCount = Number(j.izin_count || 0);
      const aCount = Number(j.alfa_count || 0);
      const hCount = Number(j.hadir_count || 0);
      
      const totalAtt = sCount + iCount + aCount + hCount;
      const presenceRate = totalAtt > 0 ? Math.round((hCount / totalAtt) * 100) : 100;

      return `
        <tr>
          <td style="text-align: center; border: 1px solid black; padding: 6px;">${idx + 1}</td>
          <td style="border: 1px solid black; padding: 6px; white-space: nowrap;">${dateStr}</td>
          <td style="text-align: center; border: 1px solid black; padding: 6px;">${j.nama_kelas}</td>
          <td style="text-align: center; border: 1px solid black; padding: 6px;">Pertemuan ${idx + 1}</td>
          <td style="border: 1px solid black; padding: 6px;">${j.tujuan_pembelajaran}</td>
          <td style="border: 1px solid black; padding: 6px;">${j.aktivitas_pembelajaran}</td>
          <td style="text-align: center; border: 1px solid black; padding: 6px; width: 25px;">${sCount || "-"}</td>
          <td style="text-align: center; border: 1px solid black; padding: 6px; width: 25px;">${iCount || "-"}</td>
          <td style="text-align: center; border: 1px solid black; padding: 6px; width: 25px;">${aCount || "-"}</td>
          <td style="text-align: center; border: 1px solid black; padding: 6px;">${presenceRate}%</td>
          <td style="border: 1px solid black; padding: 6px;">
            ${j.refleksi_guru || "-"}
            ${j.tindak_lanjut ? `<br/><span style="font-size: 10px; color: #555;">Tindak Lanjut: ${j.tindak_lanjut}</span>` : ""}
          </td>
        </tr>
      `;
    }).join("");

    let signaturesHtml = "";
    if (school) {
      if (school.show_ttd_kepala !== false) {
        signaturesHtml += `
          <div class="sig-box">
            <p>Mengetahui,</p>
            <p style="font-weight: bold; margin-top: 0;">Kepala Sekolah</p>
            <div style="height: 60px;"></div>
            <p style="text-decoration: underline; font-weight: bold;">( ${school.nama_kepala_sekolah || "___________________________"} )</p>
            <p style="margin: 0; font-size: 8pt; color: #555;">NIP: ${school.nip_kepala_sekolah || "......................................."}</p>
          </div>
        `;
      }
      if (school.show_ttd_pengawas !== false) {
        signaturesHtml += `
          <div class="sig-box">
            <p>&nbsp;</p>
            <p style="font-weight: bold; margin-top: 0;">Pengawas Pembina</p>
            <div style="height: 60px;"></div>
            <p style="text-decoration: underline; font-weight: bold;">( ${school.nama_pengawas || "___________________________"} )</p>
            <p style="margin: 0; font-size: 8pt; color: #555;">NIP: ${school.nip_pengawas || "......................................."}</p>
          </div>
        `;
      }
      if (school.show_ttd_wali !== false) {
        signaturesHtml += `
          <div class="sig-box">
            <p>&nbsp;</p>
            <p style="font-weight: bold; margin-top: 0;">Wali Kelas</p>
            <div style="height: 60px;"></div>
            <p style="text-decoration: underline; font-weight: bold;">( ${uniqueWaliKelas || school.nama_wali_kelas} )</p>
            <p style="margin: 0; font-size: 8pt; color: #555;">NIP: ${school.nip_wali_kelas || "......................................."}</p>
          </div>
        `;
      }
      
      // Guru (Always show)
      signaturesHtml += `
        <div class="sig-box">
          <p>&nbsp;</p>
          <p style="font-weight: bold; margin-top: 0;">Guru Mata Pelajaran</p>
          <div style="height: 60px;"></div>
          <p style="text-decoration: underline; font-weight: bold;">( ${currentUser?.nama_lengkap || "___________________________"} )</p>
          <p style="margin: 0; font-size: 8pt; color: #555;">NIP: ${currentUser?.nip || "..................................."}</p>
        </div>
      `;
    } else {
      signaturesHtml += `
        <div class="sig-box">
          <p>&nbsp;</p>
          <p style="font-weight: bold; margin-top: 0;">Guru Mata Pelajaran</p>
          <div style="height: 60px;"></div>
          <p style="text-decoration: underline; font-weight: bold;">( ${currentUser?.nama_lengkap || "___________________________"} )</p>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>Jurnal Harian Guru - ${school?.nama_sekolah || "GuruPRO"}</title>
        <style>
          body { font-family: Arial, sans-serif; font-size: 10pt; color: black; padding: 20px; }
          .title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .meta-table { width: 100%; border: none; margin-bottom: 15px; font-size: 10pt; }
          .meta-table td { border: none; padding: 3px 6px; }
          .report-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .report-table th, .report-table td { border: 1px solid black; padding: 6px; font-size: 9pt; }
          .report-table th { background-color: #e5e7eb; font-weight: bold; text-align: center; }
          .sub-headers th { font-size: 8pt; padding: 2px 4px; }
          .sig-container { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
          .sig-box { text-align: center; width: 22%; font-size: 9.5pt; }
          @media print {
            @page { size: landscape; margin: 25mm 30mm 25mm 20mm; }
          }
        </style>
      </head>
      <body>
        <div class="title">JURNAL HARIAN GURU</div>
        
        <table class="meta-table">
          <tr>
            <td style="width: 15%; font-weight: bold;">Sekolah</td>
            <td style="width: 35%;">: ${school?.nama_sekolah || "SMA Negeri 1 Jatiluhur"}</td>
            <td style="width: 15%; font-weight: bold;">Kurikulum</td>
            <td style="width: 35%;">: Kurikulum Merdeka / K13</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Mata Pelajaran</td>
            <td>: ${representedSubjects || "-"}</td>
            <td style="font-weight: bold;">Nama Guru</td>
            <td>: ${currentUser?.nama_lengkap || "Pendidik GuruPro"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Kelas/Semester</td>
            <td>: ${representedClasses || "-"}</td>
            <td style="font-weight: bold;">NIP/WA</td>
            <td>: ${currentUser?.whatsapp || "-"}</td>
          </tr>
          <tr>
            <td style="font-weight: bold;">Tahun Ajaran</td>
            <td>: 2025-2026</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        </table>

        <table class="report-table">
          <thead>
            <tr>
              <th rowspan="2" style="width: 40px;">No.</th>
              <th rowspan="2" style="width: 140px;">Hari / Tanggal</th>
              <th rowspan="2" style="width: 70px;">Kelas</th>
              <th rowspan="2" style="width: 90px;">Pertemuan Ke-</th>
              <th rowspan="2" style="width: 180px;">Tujuan Pembelajaran</th>
              <th rowspan="2">Kegiatan Belajar Mengajar</th>
              <th colspan="3" style="width: 90px;">Absensi Siswa</th>
              <th rowspan="2" style="width: 80px;">Prosentase Kehadiran</th>
              <th rowspan="2" style="width: 180px;">Permasalahan Dalam Proses KBM</th>
            </tr>
            <tr class="sub-headers">
              <th style="width: 30px;">S</th>
              <th style="width: 30px;">I</th>
              <th style="width: 30px;">A</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="sig-container">
          ${signaturesHtml}
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSaveSupervision = async (status: "Approved" | "Revision") => {
    if (!activeJournal || !supervisionComment) {
      showError("Mohon isi catatan ulasan terlebih dahulu");
      return;
    }
    try {
      const res = await apiFetch("/api/journals/supervision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journal_id: activeJournal.id,
          catatan_supervisi: supervisionComment,
          rekomendasi: supervisionRecom,
          status_persetujuan: status,
        }),
      });
      if (res.ok) {
        showSuccess(status === "Approved" ? "Jurnal disetujui!" : "Permintaan revisi dikirim!");
        setActiveJournal(null);
        setSupervisionComment("");
        setSupervisionRecom("");
        fetchSupervisions();
      } else {
        const data = await res.json();
        showError(data.error || "Gagal menyimpan supervisi");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleGenerateJournalAI = async () => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.");
      return;
    }
    if (!journalMateri || !journalTujuan || !journalAktivitas) {
      showError("Mohon isi Materi, Tujuan, dan Aktivitas terlebih dahulu untuk panduan AI!");
      return;
    }
    setIsAiGeneratingJournal(true);
    try {
      const selClass = classes.find(c => c.id === selectedClassId)?.nama_kelas || "";
      const selMapel = subjects.find(s => s.id === selectedSubjectId)?.nama_mapel || "";
      
      const res = await apiFetch("/api/journals/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materi: journalMateri,
          aktivitas: journalAktivitas,
          tujuan: journalTujuan,
          kelas: selClass,
          mapel: selMapel,
          kurikulum: journalKurikulum,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setJournalRefleksi(data.refleksi || "");
        setJournalTindakLanjut(data.tindak_lanjut || "");
        showSuccess("Teks jurnal berhasil dirumuskan AI!");
        fetchProfile();
      } else {
        showError(data.error || "AI gagal merumuskan jurnal.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    } finally {
      setIsAiGeneratingJournal(false);
    }
  };

  const handleEvidenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menggunakan kapasitas penyimpanan (storage) dan mengunggah evidensi.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showError("Ukuran file evidensi maksimal 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setJournalEvidensi(prev => [...prev, base64]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // --- TAMS Loader & Handler Functions ---
  const fetchAcademicCalendar = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/academic-calendar?school_id=${schoolId}`);
      if (Array.isArray(res)) setAcademicEvents(res);
    } catch (e) {
      console.error("Gagal memuat kalender akademik:", e);
    }
  };

  const fetchAssessments = async (schoolId: string, classId: string, subjectId: string) => {
    if (!schoolId || !classId || !subjectId) return;
    try {
      const res = await safeJson(`/api/assessments?school_id=${schoolId}&class_id=${classId}&subject_id=${subjectId}`);
      setAssessments(res?.data ?? (Array.isArray(res) ? res : []));
    } catch (e) {
      console.error("Gagal memuat daftar asesmen:", e);
    }
  };

  const fetchStudentGrades = async (assessmentId: string) => {
    if (!assessmentId) return;
    try {
      const res = await safeJson(`/api/assessments/grades?assessment_id=${assessmentId}&school_id=${selectedSchoolId}`);
      if (Array.isArray(res)) setStudentGrades(res);
    } catch (e) {
      console.error("Gagal memuat nilai siswa:", e);
    }
  };

  const fetchAnalytics = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/analytics?school_id=${schoolId}`);
      setAnalyticsData(res);
    } catch (e) {
      console.error("Gagal memuat data analitik:", e);
    }
  };

  const fetchSupervisionDocs = async (schoolId: string) => {
    if (!schoolId) return;
    try {
      const res = await safeJson(`/api/admin/supervision/documents?school_id=${schoolId}`);
      if (Array.isArray(res)) {
        setSupervisionDocsList(res);
      }
    } catch (e) {
      console.error("Gagal memuat dokumen supervisi:", e);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await safeJson("/api/audit-logs");
      setAuditLogs(res?.data ?? (Array.isArray(res) ? res : []));
    } catch (e) {
      console.error("Gagal memuat log audit:", e);
    }
  };

  const handleSaveCalendarEvent = async () => {
    if (!selectedSchoolId || !calEventName || !calStart || !calEnd) {
      showError("Nama kegiatan, tanggal mulai, dan selesai wajib diisi!");
      return;
    }
    try {
      const res = await apiFetch("/api/academic-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: calActiveId || null,
          school_id: selectedSchoolId,
          event_name: calEventName,
          tanggal_mulai: calStart,
          tanggal_selesai: calEnd,
          keterangan: calKeterangan
        })
      });
      if (res.ok) {
        showSuccess(calActiveId ? "Agenda akademik diperbarui!" : "Agenda akademik ditambahkan!");
        setCalEventName("");
        setCalStart("");
        setCalEnd("");
        setCalKeterangan("");
        setCalActiveId("");
        fetchAcademicCalendar(selectedSchoolId);
      } else {
        const err = await res.json();
        showError(err.error || "Gagal menyimpan agenda.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus agenda akademik ini?")) return;
    try {
      const res = await apiFetch(`/api/academic-calendar?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showSuccess("Agenda akademik dihapus!");
        fetchAcademicCalendar(selectedSchoolId);
      } else {
        showError("Gagal menghapus agenda.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleSaveAssessment = async () => {
    if (!selectedSchoolId || !selectedClassId || !selectedSubjectId || !assessName) {
      showError("Pilih sekolah, kelas, mapel, dan nama asesmen!");
      return;
    }
    try {
      const res = await apiFetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: selectedSchoolId,
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          nama_asesmen: assessName,
          tipe_asesmen: assessType,
          kkm: assessKkm
        })
      });
      if (res.ok) {
        showSuccess("Asesmen berhasil dibuat!");
        setAssessName("");
        fetchAssessments(selectedSchoolId, selectedClassId, selectedSubjectId);
      } else {
        const err = await res.json();
        showError(err.error || "Gagal membuat asesmen.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleDeleteAssessment = async (id: string) => {
    if (!confirm("Hapus asesmen ini beserta seluruh nilai siswa di dalamnya?")) return;
    try {
      const res = await apiFetch(`/api/assessments?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showSuccess("Asesmen dihapus!");
        setActiveAssessId("");
        setStudentGrades([]);
        fetchAssessments(selectedSchoolId, selectedClassId, selectedSubjectId);
      } else {
        showError("Gagal menghapus asesmen.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handleSaveGrades = async () => {
    if (!activeAssessId || studentGrades.length === 0) {
      showError("Tidak ada nilai siswa untuk disimpan.");
      return;
    }
    try {
      const payload = studentGrades.map(sg => ({
        assessment_id: activeAssessId,
        student_id: sg.student_id,
        nilai_awal: sg.nilai_awal,
        nilai_remedial: sg.nilai_remedial,
        catatan: sg.catatan
      }));
      const res = await apiFetch("/api/assessments/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showSuccess("Buku nilai berhasil disimpan!");
        fetchStudentGrades(activeAssessId);
        fetchAnalytics(selectedSchoolId);
      } else {
        showError("Gagal menyimpan buku nilai.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    }
  };

  const handlePerpanjangClick = () => {
    window.location.href = "/profile?tab=billing";
  };

  const handleGenerateAIAssessment = async () => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.");
      return;
    }
    if (!selectedSubjectId || !selectedClassId || !assessAILearningGoal.trim()) {
      showError("Pilih kelas, mapel, dan tuliskan Capaian Pembelajaran!");
      return;
    }
    setIsGeneratingAssessRubric(true);
    try {
      const mapelName = subjects.find(s => s.id === selectedSubjectId)?.nama_mapel || "Mata Pelajaran";
      const kelasName = classes.find(c => c.id === selectedClassId)?.nama_kelas || "Kelas";

      const res = await apiFetch("/api/assessments/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapel: mapelName,
          kelas: kelasName,
          materi_capaian: assessAILearningGoal,
          kurikulum: assessAIKurikulum,
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAssessAIResult(data && (data.rubrik || data.soal || data.raw) ? data : null);
        showSuccess("AI berhasil merancang asesmen & rubrik!");
        fetchProfile(); // reload token limit
      } else {
        showError(data.error || "Gagal men-generate rubrik asesmen.");
      }
    } catch (e) {
      showError("Koneksi bermasalah.");
    } finally {
      setIsGeneratingAssessRubric(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedSchoolId) {
        fetchAcademicCalendar(selectedSchoolId);
        fetchAnalytics(selectedSchoolId);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedSchoolId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeAssessId) {
        fetchStudentGrades(activeAssessId);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeAssessId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentModule === "nilai" && selectedSchoolId && selectedClassId && selectedSubjectId) {
        fetchAssessments(selectedSchoolId, selectedClassId, selectedSubjectId);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [currentModule, selectedSchoolId, selectedClassId, selectedSubjectId]);

  const fetchExplorerData = async () => {
    setIsLoadingExplorer(true);
    try {
      const semester = typeof window !== 'undefined' ? (localStorage.getItem('semester') || '') : ''
      const tahunAjaranId = typeof window !== 'undefined' ? (localStorage.getItem('tahunAjaranId') || '') : ''
      const params = new URLSearchParams()
      if (semester) params.set('semester', semester)
      if (tahunAjaranId) params.set('tahun_ajaran_id', tahunAjaranId)

      const [docs, journals, assessments, dokumenBuktis] = await Promise.all([
        safeJson(`/api/administrasi${selectedSchoolId ? `?school_id=${selectedSchoolId}` : ''}`),
        safeJson(`/api/journals${selectedSchoolId ? `?school_id=${selectedSchoolId}&limit=100` : ''}`),
        safeJson(`/api/assessments${selectedSchoolId ? `?school_id=${selectedSchoolId}` : ''}`),
        safeJson(`/api/dokumen-bukti?${params.toString()}`)
      ]);
      setAllExplorerDocs(docs?.data ?? (Array.isArray(docs) ? docs : []));
      if (journals?.data) setAllExplorerJournals(journals.data);
      setAllExplorerAssessments(assessments?.data ?? (Array.isArray(assessments) ? assessments : []));
      setAllExplorerDokumenBukti(dokumenBuktis?.data ?? (Array.isArray(dokumenBuktis) ? dokumenBuktis : []));
    } catch (e) {
      console.error("Gagal memuat explorer data:", e);
    } finally {
      setIsLoadingExplorer(false);
    }
  };

  const fetchExplorerAssessmentGrades = async (assessmentId: string) => {
    setIsLoadingGrades(true);
    try {
      const res = await safeJson(`/api/assessments/grades?assessment_id=${assessmentId}&school_id=${selectedSchoolId}`);
      if (Array.isArray(res)) {
        setExplorerGrades(res);
      } else {
        setExplorerGrades([]);
      }
    } catch (e) {
      console.error("Gagal memuat nilai explorer:", e);
      setExplorerGrades([]);
    } finally {
      setIsLoadingGrades(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedSchoolId) {
        if (currentModule === "tugas_harian") {
          fetchAnalytics(selectedSchoolId);
          fetchSchedules(selectedSchoolId);
        }
        if (currentModule === "jurnal") {
          fetchAllUsers();
          fetchSupervisions();
          fetchJournals();
          fetchChecklist();
        }
        if (currentModule === "supervisi_analitik") {
          fetchAuditLogs();
          fetchAnalytics(selectedSchoolId);
          fetchSupervisionDocs(selectedSchoolId);
        }
        if (currentModule === "administrasi") {
          fetchSavedDocs();
          fetchKeuangan();
          fetchChecklist();
        }
        if (currentModule === "sekolah") {
          fetchClasses(selectedSchoolId);
          fetchSubjects(selectedSchoolId);
          fetchSchedules(selectedSchoolId);
        }
        if (currentModule === "storage_saya") {
          fetchExplorerData();
        }
      }
      if (currentModule === "profil") {
        // Profil dipindah ke /profile
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [currentModule, selectedSchoolId]);

  const fetchProfile = async () => {
    // 1. Try loading from background cache first to make it instant
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("gurupro_cached_profile");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setCurrentUser(parsed);
        } catch (_) {}
      }
    }

    try {
      const response = await apiFetch("/api/user/profile");
      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data);
        useProfileStore.getState().setProfile(data);

        // 2. Update background cache
        if (typeof window !== "undefined") {
          localStorage.setItem("gurupro_cached_profile", JSON.stringify(data));
        }
      } else if (response.status === 404 || response.status === 401) {
        // Session invalid - just clear local cache, don't redirect
        // Let the page continue with empty/default state
        console.warn("Session invalid, clearing cache...");
        useProfileStore.getState().clearProfile();
        if (typeof window !== "undefined") {
          localStorage.removeItem("gurupro_cached_profile");
        }
      } else {
        // Server error (500 etc.) — keep cached data, don't overwrite
        // Will use the defaults set below if no cache exists
        const text = await response.text().catch(() => "");
        console.warn(`Gagal memuat profil dari server (${response.status}):`, text || "(empty body)");
      }
    } catch (err) {
      // Network error — keep cached data
      console.warn("Gagal memuat profil:", err);
    }

    setCurrentUser((prev: any) => {
      if (!prev) return { status_langganan: "free", token_limit: 0, quota_poin_available: 0, addon_poin_available: 0 };
      if (prev.quota_poin_available === undefined && prev.token_limit === undefined) return { ...prev, token_limit: 0, quota_poin_available: 0, addon_poin_available: 0 };
      return prev;
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedExplorerFile && openExplorerFolder === "nilai") {
        fetchExplorerAssessmentGrades(selectedExplorerFile.id);
      } else {
        setExplorerGrades([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selectedExplorerFile, openExplorerFolder]);

  const fetchSavedDocs = async () => {
    try {
      const res = await safeJson(`/api/administrasi${selectedSchoolId ? `?school_id=${selectedSchoolId}` : ''}`);
      const list = res?.data ?? (Array.isArray(res) ? res : []);
      const filtered = list.filter((d) =>
        ["rpp", "modul", "silabus", "lkpd", "laporan_lkpd", "bahan_ajar"].includes(d.tipe_dokumen)
      );
      setSavedDocs(filtered);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchJournals = async () => {
    try {
      const res = await safeJson(`/api/administrasi?tipe=jurnal${selectedSchoolId ? `&school_id=${selectedSchoolId}` : ''}`);
      setJurnalList(res?.data ?? (Array.isArray(res) ? res : []));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchChecklist = async () => {
    try {
      const res = await safeJson(`/api/administrasi?tipe=ceklis${selectedSchoolId ? `&school_id=${selectedSchoolId}` : ''}`);
      const list = res?.data ?? (Array.isArray(res) ? res : []);
      if (list.length > 0 && list[0].konten?.tasks?.length > 0) {
        setCeklisTasks(list[0].konten.tasks);
      } else {
        setCeklisTasks([
          { id: "1", text: "Mengisi Absensi Presensi Kelas", completed: false },
          { id: "2", text: "Memeriksa Tugas/PR Siswa", completed: false },
          { id: "3", text: "Menyiapkan Bahan Ajar/Media", completed: false },
          { id: "4", text: "Membaca Rencana Pelaksanaan Pembelajaran (RPP)", completed: false },
          { id: "5", text: "Mengevaluasi Keaktifan Siswa", completed: false }
        ]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await safeJson("/api/user/notifications?limit=50&includeRead=true");
      const list = data?.notifications ?? (Array.isArray(data) ? data : []);
      setNotifications(
        list.map((n: any) => ({
          id: String(n.id),
          title: n.title,
          body: n.body,
          date: n.created_at
            ? new Date(n.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
            : "Baru saja",
          read: Boolean(n.is_read),
        }))
      );
    } catch (e) {
      console.error("Gagal memuat notifikasi:", e);
    }
  };

  const fetchKeuangan = async () => {
    try {
      const res = await safeJson("/api/administrasi?tipe=keuangan");
      const list = res?.data ?? (Array.isArray(res) ? res : []);
      if (list.length > 0) {
        const doc = list[0];
        setFinanceDocId(doc.id);
        const data = doc.konten;
        if (data && !Array.isArray(data)) {
          setFinanceLedger(data.transactions || []);
          setFinanceSavings(data.savings || []);
          setFinanceInvestments(data.investments || []);
        } else {
          setFinanceLedger(data || []);
          setFinanceSavings([]);
          setFinanceInvestments([]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const saveFinance = async (ledger: any[], savings: any[], investments: any[]) => {
    try {
      await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: financeDocId || undefined,
          judul_dokumen: "Catatan Keuangan",
          tipe_dokumen: "keuangan",
          konten: {
            transactions: ledger,
            savings: savings,
            investments: investments
          },
          tanggal_kegiatan: getLocalDateString()
        })
      });
    } catch (e) {
      console.error("Gagal auto-save keuangan:", e);
    }
  };

  const fetchSignatures = async () => {
    try {
      const body = await safeJson("/api/administrasi?tipe=tanda_tangan");
      if (body) {
        const list = body?.data ?? (Array.isArray(body) ? body : []);
        if (list.length > 0) {
          const doc = list[0];
          setSigDocId(doc.id);
          const c = doc.konten || {};
          setSigKepalaNama(c.kepala_sekolah?.nama || "");
          setSigKepalaNip(c.kepala_sekolah?.nip || "");
          setSigGuruNama(c.guru_mapel?.nama || "");
          setSigGuruNip(c.guru_mapel?.nip || "");
          setSigPengawasNama(c.pengawas?.nama || "");
          setSigPengawasNip(c.pengawas?.nip || "");
          setSigWaliNama(c.wali_kelas?.nama || "");
          setSigWaliNip(c.wali_kelas?.nip || "");
        }
      }
    } catch (e) {
      console.error("Gagal memuat tanda tangan:", e);
    }
  };

  const saveSignatures = async () => {
    try {
      await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sigDocId || undefined,
          tipe_dokumen: "tanda_tangan",
          judul_dokumen: "Konfigurasi Tanda Tangan",
          konten: {
            kepala_sekolah: { nama: sigKepalaNama, nip: sigKepalaNip },
            guru_mapel: { nama: sigGuruNama, nip: sigGuruNip },
            pengawas: { nama: sigPengawasNama, nip: sigPengawasNip },
            wali_kelas: { nama: sigWaliNama, nip: sigWaliNip }
          }
        })
      });
    } catch (e) {
      console.error("Gagal menyimpan tanda tangan:", e);
    }
  };

  const triggerWebNotification = (title: string, body: string) => {
    const newNotif = {
      id: generateId(),
      title,
      body,
      date: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      read: false
    };
    setNotifications((prev) => [newNotif, ...prev]);

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏰</text></svg>"
        });
      } catch (err) {
        console.error("Browser notification failed to display", err);
      }
    }
  };

  const [schedulerDocId, setSchedulerDocId] = useState<string>("");

  const fetchSchedulers = async () => {
    try {
      const response = await apiFetch("/api/administrasi?tipe=scheduler");
      if (response.ok) {
        const body = await response.json();
        const list = body?.data ?? (Array.isArray(body) ? body : []);
        if (list.length > 0) {
          setSchedulerDocId(list[0].id);
          setSchedulers(list[0].konten || []);
        }
      }
    } catch (e) {
      console.error("Gagal load scheduler:", e);
    }
  };

  const saveSchedulers = async (updatedList: any[]) => {
    try {
      await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: schedulerDocId || undefined,
          judul_dokumen: "Pengingat Jadwal & Aktifitas",
          tipe_dokumen: "scheduler",
          konten: updatedList,
          tanggal_kegiatan: getLocalDateString()
        })
      });
    } catch (e) {
      console.error("Gagal menyimpan scheduler:", e);
    }
  };

  const addSchedulerItem = () => {
    if (!schedTitle.trim() || !schedDateTime) {
      showError("Judul aktifitas dan Waktu wajib diisi!");
      return;
    }
    const newItem = {
      id: generateId(),
      title: schedTitle.trim(),
      dateTime: schedDateTime, // Format: YYYY-MM-DDTHH:MM
      notified: false
    };
    const updated = [newItem, ...schedulers];
    setSchedulers(updated);
    setSchedTitle("");
    setSchedDateTime("");
    saveSchedulers(updated);
    showSuccess("Aktivitas baru berhasil dijadwalkan!");
  };

  const deleteSchedulerItem = (itemId: string) => {
    const updated = schedulers.filter((s) => s.id !== itemId);
    setSchedulers(updated);
    saveSchedulers(updated);
    showSuccess("Jadwal pengingat berhasil dihapus!");
  };



  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    signOut({ callbackUrl: "/login" });
  };

  const generateAdminDoc = async () => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.");
      return;
    }

    if (!adminMapel || !adminKelas || !adminTopik) {
      showError("Mata Pelajaran, Kelas, dan Topik wajib diisi!");
      return;
    }
    setIsGeneratingDoc(true);
    try {
      const response = await apiFetch("/api/generate-administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe: adminDocType,
          mapel: adminMapel,
          kelas: adminKelas,
          kurikulum: adminKurikulum,
          topik: adminTopik,
          tujuan: adminTujuan,
          school_id: selectedSchoolId || null
        })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal membuat dokumen AI.");
      }
      const data = await response.json();
      setGeneratedDoc(data);
      setViewingDoc(null);
      fetchProfile();
      showSuccess("Dokumen AI berhasil dibuat!");
    } catch (err: any) {
      showError(err.message || "Gagal membuat dokumen.");
    } finally {
      setIsGeneratingDoc(false);
    }
  };

    const saveGeneratedDoc = async () => {
    if (!generatedDoc) return;
    try {
      const response = await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: generatedDoc.id || null,
          tipe_dokumen: adminDocType,
          judul_dokumen: generatedDoc.judul,
          konten: { 
            markdown: generatedDoc.konten,
            pptx_url: generatedDoc.pptx_url || null,
            pdf_url: generatedDoc.pdf_url || null,
            docx_url: generatedDoc.docx_url || null
          },
          tanggal_kegiatan: getLocalDateString(),
          school_id: selectedSchoolId || null
        })
      });
      if (!response.ok) throw new Error("Gagal menyimpan dokumen.");
      showSuccess("Dokumen berhasil disimpan ke database!");
      fetchSavedDocs();
      fetchExplorerData();
      setGeneratedDoc(null);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const openSavedDoc = (doc: any) => {
    if (isSubscriptionExpiredOver30Days()) {
      showError("Dokumen ini telah diarsipkan karena masa aktif langganan Anda berakhir lebih dari 30 hari yang lalu. Perpanjang paket premium untuk mengakses kembali berkas Anda.");
      return;
    }
    setViewingDoc(doc);
    setGeneratedDoc(null);
  };

  const updateSavedDoc = async () => {
    if (!viewingDoc) return;
    try {
      const response = await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: viewingDoc.id,
          tipe_dokumen: viewingDoc.tipe_dokumen,
          judul_dokumen: viewingDoc.judul_dokumen,
          konten: viewingDoc.konten,
          tanggal_kegiatan: viewingDoc.tanggal_kegiatan
        })
      });
      if (!response.ok) throw new Error("Gagal meng-update dokumen.");
      showSuccess("Dokumen berhasil diperbarui!");
      fetchSavedDocs();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteSavedDoc = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus dokumen ini?")) return;
    try {
      const response = await apiFetch(`/api/administrasi?id=${id}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error("Gagal menghapus dokumen.");
      showSuccess("Dokumen berhasil dihapus!");
      fetchSavedDocs();
      if (viewingDoc?.id === id) setViewingDoc(null);
    } catch (err: any) {
      showError(err.message);
    }
  };

  const saveJournal = async () => {
    if (!jurnalMapel || !jurnalKelas || !jurnalBahasan) {
      showError("Mata Pelajaran, Kelas, dan Bahasan wajib diisi!");
      return;
    }
    try {
      const response = await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipe_dokumen: "jurnal",
          judul_dokumen: `Jurnal - ${jurnalMapel} Kelas ${jurnalKelas}`,
          konten: { mapel: jurnalMapel, kelas: jurnalKelas, bahasan: jurnalBahasan, catatan: jurnalCatatan },
          tanggal_kegiatan: jurnalDate
        })
      });
      if (!response.ok) throw new Error("Gagal menyimpan jurnal.");
      showSuccess("Jurnal berhasil disimpan!");
      fetchJournals();
      setJurnalMapel("");
      setJurnalKelas("");
      setJurnalBahasan("");
      setJurnalCatatan("");
    } catch (err: any) {
      showError(err.message);
    }
  };

  const deleteJournal = async (id: string) => {
    if (!confirm("Hapus jurnal ini?")) return;
    try {
      await apiFetch(`/api/administrasi?id=${id}`, { method: "DELETE" });
      showSuccess("Jurnal terhapus.");
      fetchJournals();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const saveChecklist = async (tasksList: any[]) => {
    try {
      await apiFetch("/api/administrasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judul_dokumen: "Ceklis Harian",
          tipe_dokumen: "ceklis",
          konten: { tasks: tasksList },
          tanggal_kegiatan: getLocalDateString()
        })
      });
    } catch (e) {
      console.error("Gagal auto-save checklist:", e);
    }
  };

  const toggleTask = (taskId: string) => {
    const updated = ceklisTasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    setCeklisTasks(updated);
    saveChecklist(updated);
  };

  const addTask = () => {
    if (!newCeklisTask.trim()) return;
    const newTask = {
      id: `task-${generateId()}`,
      text: newCeklisTask.trim(),
      completed: false
    };
    const updated = [...ceklisTasks, newTask];
    setCeklisTasks(updated);
    setNewCeklisTask("");
    saveChecklist(updated);
  };

  const removeTask = (taskId: string) => {
    const updated = ceklisTasks.filter((t) => t.id !== taskId);
    setCeklisTasks(updated);
    saveChecklist(updated);
  };

  const addFinanceTransaction = () => {
    if (!finKet.trim() || !finJumlah) {
      showError("Keterangan dan Jumlah wajib diisi!");
      return;
    }
    const newTx = {
      id: `tx-${generateId()}`,
      keterangan: finKet.trim(),
      jumlah: Number(finJumlah),
      tipe: finTipe,
      kategori: finKat,
      tanggal: finTgl
    };
    const updated = [...financeLedger, newTx];
    setFinanceLedger(updated);
    saveFinance(updated, financeSavings, financeInvestments);
    setFinKet("");
    setFinJumlah("");
    showSuccess("Transaksi berhasil ditambahkan!");
  };

  const deleteFinanceTransaction = (txId: string) => {
    const updated = financeLedger.filter((t) => t.id !== txId);
    setFinanceLedger(updated);
    saveFinance(updated, financeSavings, financeInvestments);
    showSuccess("Transaksi berhasil dihapus.");
  };

  const addSavingsGoal = () => {
    if (!savGoal.trim() || !savTarget || !savSaved) {
      showError("Keterangan Target dan Jumlah wajib diisi!");
      return;
    }
    const newSav = {
      id: `sav-${generateId()}`,
      goal: savGoal.trim(),
      target: Number(savTarget),
      saved: Number(savSaved),
      date: savDate || "-"
    };
    const updated = [...financeSavings, newSav];
    setFinanceSavings(updated);
    saveFinance(financeLedger, updated, financeInvestments);
    setSavGoal("");
    setSavTarget("");
    setSavSaved("");
    setSavDate("");
    showSuccess("Target tabungan berhasil ditambahkan!");
  };

  const deleteSavingsGoal = (id: string) => {
    const updated = financeSavings.filter((s) => s.id !== id);
    setFinanceSavings(updated);
    saveFinance(financeLedger, updated, financeInvestments);
    showSuccess("Target tabungan berhasil dihapus.");
  };

  const addInvestment = () => {
    if (!invNama.trim() || !invBeli || !invSekarang) {
      showError("Nama investasi, harga beli, dan harga sekarang wajib diisi!");
      return;
    }
    const newInv = {
      id: `inv-${generateId()}`,
      nama: invNama.trim(),
      kategori: invKategori,
      beli: Number(invBeli),
      sekarang: Number(invSekarang)
    };
    const updated = [...financeInvestments, newInv];
    setFinanceInvestments(updated);
    saveFinance(financeLedger, financeSavings, updated);
    setInvNama("");
    setInvBeli("");
    setInvSekarang("");
    showSuccess("Investasi berhasil ditambahkan!");
  };

  const deleteInvestment = (id: string) => {
    const updated = financeInvestments.filter((i) => i.id !== id);
    setFinanceInvestments(updated);
    saveFinance(financeLedger, financeSavings, updated);
    showSuccess("Investasi berhasil dihapus.");
  };

  // Finance Chat Helpers
  useEffect(() => {
    if (activeFinanceTab === 'chat') {
      const key = financeLedger.map((t) => t.id).join(',');
      const savedKey = (window as any).__financeChatLoadedKey;
      if (savedKey !== key) {
        (window as any).__financeChatLoadedKey = key;
        setFinanceChatMessages(financeLedger.map((tx) => ({
          id: tx.id,
          role: 'ai' as const,
          type: 'saved' as const,
          data: tx,
          text: `Tercatat: ${tx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} ${tx.keterangan} sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(tx.jumlah))} pada ${new Date(tx.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          timestamp: Date.now(),
        })));
        setFinanceChatEditId(null);
        setFinanceChatEditDraft(null);
      }
    } else {
      (window as any).__financeChatLoadedKey = undefined;
    }
  }, [activeFinanceTab]);

  const onFinanceSendChat = async () => {
    const text = financeChatInput.trim();
    if (!text || financeChatLoading) return;

    const userMsgId = `chat-${Date.now()}`;
    setFinanceChatMessages((prev) => [...prev, { id: userMsgId, role: 'user', text, timestamp: Date.now() }]);
    setFinanceChatInput('');
    setFinanceChatLoading(true);
    (window as any).__financeChatLoadedKey = undefined;

    try {
      const res = await apiFetch('/api/administrasi/parse-keuangan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memproses');

      const aiMsgId = `chat-${Date.now() + 1}`;
      setFinanceChatMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: 'ai',
          type: 'confirm',
          data: data.data,
          timestamp: Date.now(),
        },
      ]);
    } catch (err: any) {
      const aiMsgId = `chat-${Date.now() + 1}`;
      setFinanceChatMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: 'ai',
          text: err.message || 'Gagal memproses teks. Coba lagi.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setFinanceChatLoading(false);
    }
  };

  const onFinanceSaveDraft = async (msgId: string, data: any) => {
    const newTx = {
      id: `tx-${generateId()}`,
      keterangan: data.keterangan,
      jumlah: Number(data.jumlah),
      tipe: data.tipe,
      kategori: data.kategori,
      tanggal: data.tanggal,
    };
    const updated = [...financeLedger, newTx];
    setFinanceLedger(updated);
    saveFinance(updated, financeSavings, financeInvestments);

    const savedText = `Tercatat: ${data.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} ${data.keterangan} sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(data.jumlah))} pada ${new Date(data.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`;

    setFinanceChatMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, type: 'saved', data: newTx, text: savedText } : m)));

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const todayTotal = updated.filter((t) => t.tanggal === today && t.tipe === 'pengeluaran').reduce((sum, t) => sum + Number(t.jumlah), 0);

    setFinanceChatMessages((prev) => [
      ...prev,
      {
        id: `chat-${Date.now()}`,
        role: 'ai',
        type: 'saved',
        text: `Total pengeluaran hari ini: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(todayTotal)}.`,
        totalToday: todayTotal,
        timestamp: Date.now(),
      },
    ]);

    showSuccess('Transaksi berhasil ditambahkan!');
  };

  const onFinanceStartEdit = (msgId: string, data: any) => {
    setFinanceChatEditId(msgId);
    setFinanceChatEditDraft({
      jumlah: String(data.jumlah),
      tipe: data.tipe,
      kategori: data.kategori,
      tanggal: data.tanggal,
      keterangan: data.keterangan,
    });
  };

  const onFinanceConfirmEdit = async (msgId: string) => {
    if (!financeChatEditDraft) return;
    const newTx = {
      id: `tx-${generateId()}`,
      keterangan: financeChatEditDraft.keterangan,
      jumlah: Number(financeChatEditDraft.jumlah),
      tipe: financeChatEditDraft.tipe,
      kategori: financeChatEditDraft.kategori,
      tanggal: financeChatEditDraft.tanggal,
    };
    const updated = [...financeLedger, newTx];
    setFinanceLedger(updated);
    saveFinance(updated, financeSavings, financeInvestments);

    const savedText = `Tercatat: ${newTx.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'} ${newTx.keterangan} sebesar ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(newTx.jumlah)} pada ${new Date(newTx.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`;

    setFinanceChatMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, type: 'saved', data: newTx, text: savedText } : m)));

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
    const todayTotal = updated.filter((t) => t.tanggal === today && t.tipe === 'pengeluaran').reduce((sum, t) => sum + Number(t.jumlah), 0);

    setFinanceChatMessages((prev) => [
      ...prev,
      {
        id: `chat-${Date.now()}`,
        role: 'ai',
        type: 'saved',
        text: `Total pengeluaran hari ini: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(todayTotal)}.`,
        totalToday: todayTotal,
        timestamp: Date.now(),
      },
    ]);

    setFinanceChatEditId(null);
    setFinanceChatEditDraft(null);
    showSuccess('Transaksi berhasil ditambahkan!');
  };

  const onFinanceCancelEdit = () => {
    setFinanceChatEditId(null);
    setFinanceChatEditDraft(null);
  };

  useEffect(() => {
    if (activeFinanceTab === 'chat' && financeChatEndRef.current) {
      financeChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeFinanceTab, financeChatMessages, financeChatLoading]);

  const handlePlanCheckout = async (planType: string) => {
    if (!currentUser) return;
    setIsCheckingOut(true);
    try {
      const response = await apiFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planType, userId: currentUser.id })
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menginisialisasi pembayaran.");
      }
      const data = await response.json();
      if (typeof window !== 'undefined') window.location.assign(data.checkoutUrl);
    } catch (err: any) {
      showError(err.message);
      setIsCheckingOut(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 5000);
  };

  const handleGenerate = async (formData: any) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.");
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    setLoadingProgress("Mempersiapkan pembuatan soal...");

    // Isi otomatis nama guru dan sekolah dari user login & sekolah aktif
    const activeSchool = schools.find((s: any) => s.id === selectedSchoolId);
    formData = {
      ...formData,
      namaGuru: currentUser?.nama_lengkap || "",
      namaSekolah: activeSchool?.nama_sekolah || "",
      schoolName: activeSchool?.nama_sekolah || "",
      schoolAddress: activeSchool?.alamat || "",
      schoolNpsn: activeSchool?.npsn || "",
      schoolLogo: activeSchool?.logo || "",
    };

    setMetaInfo(formData);
    setCurrentFormData(formData);
    
    const totalSoal = formData.totalSoal;
    const BATCH_THRESHOLD = 40;
    let allSoal: any[] = [];

    try {
      console.log("[Generate Soal] Starting generation, totalSoal:", totalSoal, "BATCH_THRESHOLD:", BATCH_THRESHOLD);

      if (totalSoal <= BATCH_THRESHOLD) {
        setLoadingProgress("Menghubungi GuruPRO AI...");
        const response = await apiFetch('/api/generate-soal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        console.log("[Generate Soal] Response status:", response.status);

        if (!response.ok) {
          const bodyText = await response.text();
          let errData: any;
          try {
            errData = JSON.parse(bodyText);
          } catch {
            console.error("[Generate Soal] API error (non-JSON body):", bodyText.slice(0, 500));
            errData = {};
          }
          console.error("[Generate Soal] API error response:", errData);
          if (errData.reason === "poin_habis" || errData.reason === "subscription_expired" || errData.reason === "grace_period_expired") {
            setShowTokenModal(true);
            setTokenShortfall(1);
            throw new Error("Poin habis. Silakan top-up atau upgrade paket.");
          }
          throw new Error(errData.error || `Gagal membuat soal (HTTP ${response.status}).`);
        }
        const result = await response.json();
        console.log("[Generate Soal] Response result:", result);

        if (result.error) {
          throw new Error(result.error);
        }

        if (result.soal && Array.isArray(result.soal)) {
          allSoal = result.soal;
          console.log("[Generate Soal] Generated", allSoal.length, "questions");
        } else {
          console.error("[Generate Soal] Invalid response structure:", result);
          throw new Error("Respon AI tidak valid. Struktur response tidak sesuai ekspektasi.");
        }
      } else {
        const batches = splitIntoBatches(formData);
        console.log(`Auto-batching: ${totalSoal} soal -> ${batches.length} batch`);
        
        for (let i = 0; i < batches.length; i++) {
          setLoadingProgress(`Membuat batch ${i + 1} dari ${batches.length}... (${allSoal.length}/${totalSoal} selesai)`);
          const response = await apiFetch('/api/generate-soal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batches[i]),
          });
          if (!response.ok) {
            const bodyText = await response.text();
            let errData: any;
            try {
              errData = JSON.parse(bodyText);
            } catch {
              console.error(`[Generate Soal] Batch ${i + 1} non-JSON error:`, bodyText.slice(0, 300));
              errData = {};
            }
            if (errData.reason === "poin_habis" || errData.reason === "subscription_expired" || errData.reason === "grace_period_expired") {
              setShowTokenModal(true);
              setTokenShortfall(1);
            }
            showError(`Batch ${i + 1} gagal: ${errData.error || "API error"}. Melanjutkan batch berikutnya...`);
            continue;
          }
          const result = await response.json();
          if (result.soal && Array.isArray(result.soal)) {
            allSoal = allSoal.concat(result.soal);
          }
          
          if (i < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      if (allSoal.length === 0) {
        throw new Error("Tidak ada soal yang berhasil dibuat.");
      }

      // Re-map the keys of requested quantities to kebab-case
      const keyMap: { [key: string]: string } = {
        pg: 'pg',
        isian: 'isian',
        essay: 'essay',
        pgKompleks: 'pg-kompleks',
        bs: 'bs',
        jodoh: 'jodoh',
        urutan: 'urutan',
        tabel: 'tabel',
        sebabAkibat: 'sebab-akibat'
      };

      // Build requested quantities with kebab-case keys
      const requestedQuantities: { [key: string]: number } = {};
      if (formData.qty) {
        Object.entries(formData.qty).forEach(([key, val]) => {
          const kebabKey = keyMap[key] || key;
          requestedQuantities[kebabKey] = Number(val) || 0;
        });
      }

      // Filter and cap each question type to match requested quantities exactly
      // If no specific quantities requested, accept all soal
      const hasSpecificRequests = Object.values(requestedQuantities).some(v => v > 0);
      const takenCounts: { [key: string]: number } = {};
      const finalSoalList: any[] = [];

      allSoal.forEach((s: any) => {
        const tipe = s.tipe || 'pg';
        const limit = requestedQuantities[tipe] || 0;
        const currentCount = takenCounts[tipe] || 0;

        // If no specific quantities were requested, accept all soal
        // Otherwise, only accept soal that matches requested types and hasn't exceeded the limit
        if (!hasSpecificRequests) {
          finalSoalList.push(s);
        } else if (limit > 0 && currentCount < limit) {
          finalSoalList.push(s);
          takenCounts[tipe] = currentCount + 1;
        }
      });

      if (finalSoalList.length === 0) {
        console.warn("[Generate Soal] finalSoalList is empty. allSoal:", allSoal.length, "requestedQuantities:", requestedQuantities);
        throw new Error("Tidak ada soal yang sesuai dengan tipe yang diminta.");
      }

      // Reindex nomor questions
      const indexedSoal = finalSoalList.map((s, idx) => ({
        ...s,
        id: s.id || `soal-${generateId()}-${idx}`,
        nomor: idx + 1
      }));

      setSoalList(indexedSoal);
      setRevealedKunci({});
      setReviewedQuestions({});
      setQuizCheckedAnswers({});
      setQuizScore(0);
      setActiveTab("soal");
      setMobileTab("preview");
      showSuccess(`Berhasil membuat ${indexedSoal.length} butir soal!`);
      fetchProfile();
    } catch (err: any) {
      console.error(err);
      showError(err.message || "Gagal membuat soal. Coba lagi.");
      throw err;
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  };

  const toggleKunci = (idx: number) => {
    setRevealedKunci((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleSelectQuizOption = (soalIdx: number, selectedLetter: string, correctKunci: string) => {
    if (quizCheckedAnswers.hasOwnProperty(soalIdx)) return;
    
    let correctLetter = String(correctKunci).trim().toUpperCase();
    if (correctLetter.length > 1) {
      const match = correctLetter.match(/^([A-H])/i);
      correctLetter = match ? match[1].toUpperCase() : correctLetter.charAt(0);
    }

    setQuizCheckedAnswers((prev) => ({ ...prev, [soalIdx]: selectedLetter }));
    if (selectedLetter === correctLetter) {
      setQuizScore((prev) => prev + 1);
    }
  };

  // --- ACTIONS PER SOAL ---
  const deleteQuestion = (index: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus soal ini?")) return;
    const deletedSoal = soalList[index];
    const updated = soalList.filter((_, idx) => idx !== index);
    const reindexed = updated.map((s, idx) => ({ ...s, nomor: idx + 1 }));
    setSoalList(reindexed);
    // Add to history
    addToHistory("delete", index, deletedSoal, null, reindexed);
    showSuccess("Soal berhasil dihapus!");
  };

  const duplicateQuestion = (index: number) => {
    const original = soalList[index];
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = `soal-${generateId()}`;
    const updated = [...soalList];
    updated.splice(index + 1, 0, clone);
    const reindexed = updated.map((s, idx) => ({ ...s, nomor: idx + 1 }));
    setSoalList(reindexed);
    // Add to history
    addToHistory("duplicate", index, original, clone);
    showSuccess("Soal berhasil diduplikat!");
  };

  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setEditingSoal(JSON.parse(JSON.stringify(soalList[index])));
    setIsEditModalOpen(true);
  };

  const saveEditedSoal = () => {
    if (editingIndex === null || !editingSoal) return;
    const oldSoal = soalList[editingIndex];
    const updated = [...soalList];
    updated[editingIndex] = editingSoal;
    setSoalList(updated);
    if (editingSoal.id) {
      setReviewedQuestions(prev => ({ ...prev, [editingSoal.id]: true }));
    }
    // Add to history
    addToHistory("edit", editingIndex, oldSoal, editingSoal);
    setIsEditModalOpen(false);
    setEditingIndex(null);
    setEditingSoal(null);
    showSuccess("Soal berhasil diperbarui!");
  };

  const handleRegenerateSingle = async (index: number) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.");
      return;
    }
    if (regeneratingIndexes[index]) return;
    setRegeneratingIndexes(prev => ({ ...prev, [index]: true }));

    try {
      const oldSoal = soalList[index];
      const payload = {
        formData: currentFormData || metaInfo,
        oldSoal
      };

      const response = await apiFetch('/api/regenerate-soal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errMsg = "Gagal meregenerasi soal.";
        try {
          const errData = await response.json();
          errMsg = errData?.error || errData?.message || errMsg;
        } catch {
          // Response body might be empty or invalid JSON
          errMsg = `Server error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errMsg);
      }

      const newSoal = await response.json();
      
      // Preserve some elements if missed
      newSoal.nomor = oldSoal.nomor;
      newSoal.tipe = oldSoal.tipe;
      if (oldSoal.stimulus) newSoal.stimulus = oldSoal.stimulus;
      if (oldSoal.stimulus_id) newSoal.stimulus_id = oldSoal.stimulus_id;
      if (oldSoal.level_akm && !newSoal.level_akm) newSoal.level_akm = oldSoal.level_akm;
      if (oldSoal.gambarData) newSoal.gambarData = oldSoal.gambarData;
      
      // Generate a new unique ID for the new regenerated question
      newSoal.id = `soal-${generateId()}`;

      const updated = [...soalList];
      updated[index] = newSoal;
      setSoalList(updated);

      // Reset reviewed status for this new question
      setReviewedQuestions(prev => ({ ...prev, [newSoal.id]: false }));

      // Add to history
      addToHistory("regenerate", index, oldSoal, newSoal);

      showSuccess(`Soal nomor ${oldSoal.nomor} berhasil diregenerasi!`);
    } catch (err: any) {
      console.error(err);
      showError(`Gagal meregenerasi soal: ${err.message}`);
    } finally {
      setRegeneratingIndexes(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleGenerateImage = async (index: number, desc: string) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan akun Anda telah habis! Silakan lakukan perpanjangan langganan terlebih dahulu.");
      return;
    }
    if (generatingImageIndexes[index]) return;
    setGeneratingImageIndexes(prev => ({ ...prev, [index]: true }));

    try {
      const response = await apiFetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal membuat ilustrasi gambar.");
      }

      const result = await response.json();
      if (result.image) {
        // Check if we're in edit modal context
        if (isGeneratingForEditModal && editingSoal) {
          setEditingSoal({ ...editingSoal, gambarData: result.image });
          showSuccess(`Ilustrasi gambar berhasil dibuat dan ditambahkan ke soal!`);
        } else {
          const updated = [...soalList];
          updated[index].gambarData = result.image;
          setSoalList(updated);
          showSuccess(`Ilustrasi gambar soal nomor ${index + 1} berhasil dibuat!`);
        }
      } else {
        throw new Error("Format respons gambar tidak valid.");
      }
    } catch (err: any) {
      console.error(err);
      showError(`Gagal membuat ilustrasi: ${err.message}`);
    } finally {
      setGeneratingImageIndexes(prev => ({ ...prev, [index]: false }));
      setIsGeneratingForEditModal(false);
    }
  };

  // --- REORDERING & SHUFFLING LOGIC ---
  const shuffleQuestions = () => {
    if (soalList.length === 0) return;
    const oldList = [...soalList];
    const shuffled = [...soalList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // eslint-disable-next-line react-hooks/purity
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const reindexed = shuffled.map((s, idx) => ({ ...s, nomor: idx + 1 }));
    setSoalList(reindexed);
    // Add to history
    addToHistory("shuffle", -1, oldList, reindexed);
    showSuccess("Seluruh urutan soal berhasil diacak!");
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === soalList.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const newList = [...soalList];
    [newList[index], newList[targetIdx]] = [newList[targetIdx], newList[index]];
    const reindexed = newList.map((s, idx) => ({ ...s, nomor: idx + 1 }));
    setSoalList(reindexed);
  };

  const moveType = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === typeOrder.length - 1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newOrder = [...typeOrder];
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    setTypeOrder(newOrder);
  };

  const applyTypeSorting = () => {
    if (soalList.length === 0) return;
    const sorted = [...soalList].sort((a, b) => {
      const orderA = typeOrder.indexOf(a.tipe);
      const orderB = typeOrder.indexOf(b.tipe);
      const idxA = orderA === -1 ? 999 : orderA;
      const idxB = orderB === -1 ? 999 : orderB;
      return idxA - idxB;
    });
    const reindexed = sorted.map((s, idx) => ({ ...s, nomor: idx + 1 }));
    setSoalList(reindexed);
    showSuccess("Urutan tipe soal berhasil diterapkan!");
    setShowTypeSorter(false);
  };

  // --- EXPORT LOGIC ---
  const copyToClipboard = () => {
    if (soalList.length === 0) return;
    
    let text = `SOAL EVALUASI - ${metaInfo.mapel || "GuruPRO"}\n`;
    text += `Materi: ${metaInfo.topik || ""}\n`;
    text += `Kelas: ${metaInfo.kelas || ""} (${metaInfo.jenjang || ""})\n`;
    text += `=========================================\n\n`;

    soalList.forEach((soal, idx) => {
      text += `${idx + 1}. ${soal.pertanyaan} (Tipe: ${typeLabelsMap[soal.tipe] || soal.tipe})\n`;
      if (soal.opsi) {
        if (Array.isArray(soal.opsi)) {
          soal.opsi.forEach((pil: string, pIdx: number) => {
            const char = String.fromCharCode(65 + pIdx);
            text += `   ${char}. ${pil}\n`;
          });
        } else if (soal.tipe === 'jodoh' && soal.opsi.kiri) {
          text += `   Kolom Kiri: ${soal.opsi.kiri.join(", ")}\n`;
          text += `   Kolom Kanan: ${soal.opsi.kanan.join(", ")}\n`;
        } else if (soal.tipe === 'sebab-akibat') {
          text += `   Pernyataan: ${soal.opsi.pernyataan}\n`;
          text += `   Alasan: ${soal.opsi.alasan}\n`;
        }
      }
      
      let kunciStr = "";
      if (soal.tipe === 'jodoh') {
        kunciStr = JSON.stringify(soal.kunci);
      } else if (Array.isArray(soal.kunci)) {
        kunciStr = soal.kunci.join(', ');
      } else {
        kunciStr = String(soal.kunci);
      }
      text += `   Kunci Jawaban: ${kunciStr}\n\n`;
    });

    navigator.clipboard.writeText(text);
    showSuccess("Seluruh soal berhasil disalin ke clipboard!");
  };

  const handleSaveSoalToStorage = async () => {
    if (soalList.length === 0) return;

    setIsLoading(true);
    setLoadingProgress("Menyimpan ke Cloud Storage...");

    const data = currentFormData || metaInfo;
    const mapel = data.mapel || "Mata Pelajaran";
    const kelas = data.kelas || "Kelas";
    const topik = data.topik || "Ujian";

    try {
      // Use new R2-enabled API route
      const response = await apiFetch("/api/soal/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          soalList,
          meta: data,
          generatePdf: true,
          generateDoc: false,
        })
      });

      const result = await response.json();

      if (response.ok) {
        showSuccess(result.message || "Bank soal berhasil disimpan ke Storage Saya (Cloud R2)!");
        fetchExplorerData();
      } else {
        showError(result.error || "Gagal menyimpan bank soal.");
      }
    } catch (e: any) {
      console.error("Save error:", e);
      showError("Koneksi bermasalah: " + e.message);
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  };

  const generateGradesMarkdown = (file: any, grades: any[]) => {
    let md = `# LAPORAN REKAPITULASI NILAI ASESMEN\n\n`;
    md += `- **Sekolah**: ${file.nama_sekolah || "-"}\n`;
    md += `- **Asesmen**: ${file.nama_asesmen || "-"}\n`;
    md += `- **Tipe Asesmen**: ${file.tipe_asesmen || "-"}\n`;
    md += `- **KKM**: ${file.kkm || 70} Poin\n`;
    md += `- **Mata Pelajaran**: ${file.nama_mapel || "-"}\n`;
    md += `- **Kelas**: ${file.nama_kelas || "-"}\n\n`;
    
    md += `### DAFTAR NILAI SISWA:\n\n`;
    md += `| No | NISN | Nama Siswa | Nilai Akhir | Status Kelulusan |\n`;
    md += `|----|------|------------|-------------|------------------|\n`;
    
    grades.forEach((g, idx) => {
      const isPassed = (g.nilai_akhir || 0) >= (file.kkm || 70);
      md += `| ${idx + 1} | ${g.nisn || "-"} | ${g.nama_siswa || "-"} | ${g.nilai_akhir || 0} | ${isPassed ? "LULUS" : "REMEDIAL"} |\n`;
    });
    
    return md;
  };

  const downloadExplorerSoalWord = (file: any) => {
    const originalSoalList = soalList;
    const originalFormData = currentFormData;
    
    setSoalList(file.konten?.soalList || []);
    setCurrentFormData(file.konten?.meta || null);
    
    setTimeout(() => {
      downloadWord();
      setSoalList(originalSoalList);
      setCurrentFormData(originalFormData);
    }, 100);
  };

  const downloadExplorerSoalPdf = (file: any) => {
    const originalSoalList = soalList;
    const originalFormData = currentFormData;
    
    setSoalList(file.konten?.soalList || []);
    setCurrentFormData(file.konten?.meta || null);
    
    setTimeout(() => {
      downloadPdf();
      setSoalList(originalSoalList);
      setCurrentFormData(originalFormData);
    }, 100);
  };

  const generatePrintLayout = (
    title: string,
    markdown: string,
    opts?: { showPageNumber?: boolean; isDocx?: boolean }
  ) => {
    const { showPageNumber = false, isDocx = false } = opts || {};
    const activeSchool = schools.find((s: any) => s.id === selectedSchoolId);

    // Markdown-to-HTML converter
    let bodyHtml = markdown
      .replace(/^### (.+)$/gm, '<h3 style="font-family: Arial, sans-serif; font-size: 13pt; color: #1e293b; margin-top: 12pt; margin-bottom: 4pt; font-weight: bold;">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 style="font-family: Arial, sans-serif; font-size: 15pt; color: #1e3a8a; margin-top: 18pt; margin-bottom: 6pt; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 2pt; font-weight: bold;">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 style="font-family: Arial, sans-serif; font-size: 18pt; color: #1e3a8a; text-align: center; margin-top: 24pt; margin-bottom: 12pt; text-transform: uppercase; font-weight: bold;">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li style="font-family: Arial, sans-serif; font-size: 11pt; color: #334155; margin-left: 20pt; margin-bottom: 4pt; line-height: 1.6;">$1</li>')
      .replace(/\n\n/g, "</p><p style='font-family: Arial, sans-serif; font-size: 11pt; color: #334155; line-height: 1.6; text-align: justify; margin-bottom: 8pt;'>")
      .replace(/\n/g, "<br>");

    // Table conversion
    const lines = bodyHtml.split('<br>');
    let isTable = false;
    const formattedLines = lines.map(line => {
      if (line.trim().startsWith('|')) {
        const cells = line.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1);
        if (!isTable) {
          isTable = true;
          return `<table style="width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 8pt; font-family: Arial, sans-serif; font-size: 10pt;">
            <tr style="background-color: #f1f5f9;">
              ${cells.map(c => `<th style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; text-align: left;">${c}</th>`).join('')}
            </tr>`;
        } else {
          if (cells.every(c => /^:-*-*:*$/.test(c) || /^-+$/.test(c))) {
            return '';
          }
          return `<tr>
            ${cells.map(c => `<td style="border: 1px solid #cbd5e1; padding: 8px; color: #334155;">${c}</td>`).join('')}
          </tr>`;
        }
      } else {
        if (isTable) {
          isTable = false;
          return `</table>${line}`;
        }
        return line;
      }
    });
    bodyHtml = formattedLines.join('<br>').replace(/(<\/table>)<br>/g, '$1');

    // Kop Surat
    const kopSuratHtml = `
      <table style="width: 100%; border-collapse: collapse; border-bottom: 3px double #000000; margin-bottom: 20pt; font-family: Arial, sans-serif;">
        <tr>
          <td style="width: 15%; text-align: center; padding-bottom: 10pt;">
            ${
              activeSchool?.logo
                ? `<img src="${activeSchool.logo}" style="max-height: 60px; max-width: 60px; object-fit: contain;" alt="Logo Sekolah"/>`
                : '<span style="font-size: 32pt;">🏫</span>'
            }
          </td>
          <td style="width: 70%; text-align: center; padding-bottom: 10pt;">
            <h2 style="margin: 0; font-size: 11pt; font-weight: bold; text-transform: uppercase; color: #1e3a8a; letter-spacing: 1px;">PEMERINTAH REPUBLIK INDONESIA</h2>
            <h1 style="margin: 2px 0 0 0; font-size: 14pt; font-weight: bold; text-transform: uppercase; color: #1e3a8a; letter-spacing: 1px;">${(activeSchool?.nama_sekolah || "ECOSYSTEM GURUPRO").toUpperCase()}</h1>
            <p style="margin: 4px 0 0 0; font-size: 9pt; color: #475569;">
              ${activeSchool?.alamat ? `Alamat: ${activeSchool.alamat}` : 'Alamat: Jalan Raya Pendidikan No. 1, Kota GuruPRO'}
              ${activeSchool?.npsn ? ` | NPSN: ${activeSchool.npsn}` : ''}
            </p>
          </td>
          <td style="width: 15%; text-align: center; padding-bottom: 10pt;">
            <span style="font-size: 32pt;">🇮🇩</span>
          </td>
        </tr>
      </table>
    `;

    const pageNumFooter = showPageNumber
      ? `<div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>`
      : '';

    const pageMargin = isDocx
      ? "@page { margin: 2.5cm 2cm 2cm 3cm; size: A4; }"
      : "@page { margin: 25mm 20mm 20mm 30mm; size: A4; }";

    return `
      <!DOCTYPE html>
      ${isDocx ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` : '<html>'}
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          ${pageMargin}
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; }
          h1, h2, h3 { page-break-after: avoid; }
          p { margin: 0 0 8pt 0; text-align: justify; font-size: 12pt; }
          table { page-break-inside: avoid; width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 8pt; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; }
          li { line-height: 1.6; margin-bottom: 4pt; font-size: 12pt; }
          .page-footer { position: fixed; bottom: 1.5cm; left: 0; right: 0; text-align: right; font-size: 9pt; color: #666; }
          @media print { .page-footer { display: block; } }
        </style>
      </head>
      <body>
        ${kopSuratHtml}
        <div style="padding: 20px 25px;">
          ${bodyHtml}
        </div>
        ${pageNumFooter}
      </body>
      </html>
    `;
  };

  const downloadDocxClient = (title: string, markdown: string) => {
    const htmlContent = generatePrintLayout(title, markdown, { showPageNumber: true, isDocx: true });
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("Berkas Word (.doc) berhasil diunduh!");
  };

  const downloadPdfClient = async (title: string, markdown: string) => {
    setIsLoading(true);
    setLoadingProgress("Mempersiapkan ekspor PDF...");
try {
      const html2pdf = await loadHtml2Pdf();
      const data = enrichExportMeta();
      const content = document.createElement('div');
      content.innerHTML = htmlContent;

      const opt = {
        margin: [25, 20, 20, 30],
        filename: `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().from(content).set(opt).save();
      showSuccess("Berkas PDF berhasil diunduh!");
    } catch (e: any) {
      console.error(e);
      showError("Gagal mengekspor PDF: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const enrichExportMeta = () => {
    const data = currentFormData || metaInfo;
    const school = schools.find((s: any) => s.id === selectedSchoolId);
    return {
      ...data,
      schoolName: data?.schoolName || school?.nama_sekolah || "",
      schoolAddress: data?.schoolAddress || school?.alamat || "",
      schoolNpsn: data?.schoolNpsn || school?.npsn || "",
      schoolLogo: data?.schoolLogo || school?.logo || "",
    };
  };

  const downloadWord = () => {
    if (soalList.length === 0) return;
    const data = enrichExportMeta();
    
    let contentHtml = "";
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    if (activeTab === 'soal') {
      soalList.forEach((s, idx) => {
        let opsiHtml = "";
        if (s.opsi && Array.isArray(s.opsi)) {
          opsiHtml = s.opsi.map((o: string, oIdx: number) => {
            const prefix = /^[A-H][\.\)]\s?/.test(o) ? "" : `${letters[oIdx]}. `;
            return `<p class="opsi">${prefix}${o}</p>`;
          }).join('');
        } else if (s.tipe === 'jodoh' && s.opsi?.kiri) {
          opsiHtml += `<table style="border-collapse:collapse;margin-left:24pt;margin-top:4pt;margin-bottom:4pt;width:80%;">`;
          opsiHtml += `<tr><th style="border:1px solid #000;padding:4px;background:#f3f4f6;">Kolom Kiri</th><th style="border:1px solid #000;padding:4px;background:#f3f4f6;">Kolom Kanan</th></tr>`;
          const maxLen = Math.max(s.opsi.kiri.length, s.opsi.kanan?.length || 0);
          for (let i = 0; i < maxLen; i++) {
            opsiHtml += `<tr><td style="border:1px solid #000;padding:4px;">${s.opsi.kiri[i] || ""}</td><td style="border:1px solid #000;padding:4px;">${s.opsi.kanan?.[i] || ""}</td></tr>`;
          }
          opsiHtml += `</table>`;
        } else if (s.tipe === 'tabel' && s.opsi?.headers) {
          opsiHtml += `<table style="border-collapse:collapse;margin-left:24pt;margin-top:4pt;margin-bottom:4pt;width:90%;">`;
          opsiHtml += `<tr>${s.opsi.headers.map((h: string) => `<th style="border:1px solid #000;padding:4px;background:#f3f4f6;">${h}</th>`).join('')}</tr>`;
          s.opsi.rows?.forEach((row: string[]) => {
            opsiHtml += `<tr>${row.map(cell => `<td style="border:1px solid #000;padding:4px;">${cell}</td>`).join('')}</tr>`;
          });
          opsiHtml += `</table>`;
        } else if (s.tipe === 'sebab-akibat' && s.opsi?.pernyataan) {
          opsiHtml += `<p class="opsi"><strong>PERNYATAAN:</strong> ${s.opsi.pernyataan}</p>`;
          opsiHtml += `<p class="opsi"><strong>ALASAN:</strong> ${s.opsi.alasan}</p>`;
        } else if (s.tipe === 'bs') {
          opsiHtml = `<p class="opsi"><strong>A.</strong> Benar &nbsp;&nbsp;&nbsp; <strong>B.</strong> Salah</p>`;
        }

        contentHtml += `
          <div class="soal-item">
            <div class="soal-header">
              <strong>${idx + 1}.</strong> <span class="tipe-badge">${typeLabelsMap[s.tipe] || s.tipe}</span>
              ${s.tingkat ? `<span class="tipe-badge">${s.tingkat}</span>` : ""}
              ${s.kognitif ? `<span class="tipe-badge" style="background:#dbeafe;">${s.kognitif}</span>` : ""}
              ${s.skor ? `<span class="tipe-badge" style="background:#f3e8ff;">Skor: ${s.skor}</span>` : ""}
            </div>
            <div class="pertanyaan">${s.pertanyaan}</div>
            ${s.stimulus ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;margin:6px 0;font-style:italic;font-size:10pt;"><strong>Stimulus:</strong> ${s.stimulus}</div>` : ""}
            ${s.gambar ? `<div style="margin:6px 0;text-align:center;font-style:italic;color:#666;font-size:9pt;">[Gambar: ${s.gambar}]</div>` : ""}
            ${s.gambarData ? `<div style="margin:6px 0;"><img src="${s.gambarData}" style="max-width:240px;height:auto;" /></div>` : ""}
            ${opsiHtml}
            ${s.pembahasan ? `<div class="pembahasan"><strong>Pembahasan:</strong> ${s.pembahasan}</div>` : ""}
          </div>
        `;
      });
    } else if (activeTab === 'kunci') {
      soalList.forEach((s, idx) => {
        let kunciStr = "";
        if (s.tipe === 'jodoh') {
          kunciStr = JSON.stringify(s.kunci);
        } else if (Array.isArray(s.kunci)) {
          kunciStr = s.kunci.join(', ');
        } else {
          kunciStr = String(s.kunci);
        }
        contentHtml += `
          <div class="soal-item">
            <div class="soal-header"><strong>${idx + 1}.</strong> ${s.pertanyaan}</div>
            <div class="kunci-box"><strong>Kunci:</strong> ${kunciStr}</div>
            ${s.pembahasan ? `<div class="pembahasan"><strong>Pembahasan:</strong> ${s.pembahasan}</div>` : ""}
          </div>
        `;
      });
    } else if (activeTab === 'kisikisi') {
      contentHtml += `
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr style="background-color: #e0e7ff;">
              <th style="border: 1px solid black; padding: 6px;">No</th>
              <th style="border: 1px solid black; padding: 6px;">Tipe</th>
              <th style="border: 1px solid black; padding: 6px;">Elemen</th>
              <th style="border: 1px solid black; padding: 6px;">Capaian Pembelajaran (CP)</th>
              <th style="border: 1px solid black; padding: 6px;">Indikator Soal</th>
              <th style="border: 1px solid black; padding: 6px;">Level</th>
              <th style="border: 1px solid black; padding: 6px;">Kesulitan</th>
              <th style="border: 1px solid black; padding: 6px;">Skor</th>
            </tr>
          </thead>
          <tbody>
            ${soalList.map((s, idx) => `
              <tr>
                <td style="border: 1px solid black; padding: 6px; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid black; padding: 6px;">${s.tipe}</td>
                <td style="border: 1px solid black; padding: 6px;">${s.elemen || "-"}</td>
                <td style="border: 1px solid black; padding: 6px;">${s.cp || "-"}</td>
                <td style="border: 1px solid black; padding: 6px;">${s.indikator || "-"}</td>
                <td style="border: 1px solid black; padding: 6px; text-align: center;">${s.kognitif}</td>
                <td style="border: 1px solid black; padding: 6px; text-align: center;">${s.tingkat}</td>
                <td style="border: 1px solid black; padding: 6px; text-align: center;">${s.skor || 1}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (activeTab === 'analisis') {
      contentHtml += `
        <h3>Analisis Butir Soal</h3>
        <p>Total Soal: ${soalList.length}</p>
        <p>LOTS (C1-C3): ${lotsCount} (${lotsPct}%)</p>
        <p>HOTS (C4-C6): ${hotsCount} (${hotsPct}%)</p>
        <p>Kesulitan - Mudah: ${tingkatCount.mudah} (${mudahPct}%)</p>
        <p>Kesulitan - Sedang: ${tingkatCount.sedang} (${sedangPct}%)</p>
        <p>Kesulitan - Sulit: ${tingkatCount.sulit} (${sulitPct}%)</p>
      `;
    }

    const filename = `${activeTab === 'soal' ? 'Soal' : activeTab === 'kunci' ? 'Kunci' : activeTab === 'kisikisi' ? 'Kisi_Kisi' : 'Analisis'}_${(data.mapel || "GuruPRO").replace(/[^a-zA-Z0-9]/g, "_")}.doc`;

    const schoolName = data.namaSekolah || "GuruPRO";
    const guruName = data.namaGuru || "Pendidik";
    const jenjang = data.jenjang || "";
    const kelas = data.kelas || "-";
    const mapel = data.mapel || "Mata Pelajaran";
    const kurikulum = data.kurikulumLabel || "Kurikulum Merdeka";
    const jenis = data.jenisAsesmen || "Asesmen";
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const kopTable = buildKopSekolahHTML({
      nama_sekolah: schoolName,
      alamat: data.schoolAddress || null,
      npsn: data.schoolNpsn || null,
      logo: data.schoolLogo || null,
    });

    const identitasRows = [
      ["Mata Pelajaran", mapel, "Jenis Asesmen", jenis],
      ["Kelas / Jenjang", `Kelas ${kelas} (${jenjang})`, "Kurikulum", kurikulum],
    ];
    const identitasTable = `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      ${identitasRows.map(([l1, v1, l2, v2]) =>
        `<tr>
          <td style="width:130px;padding:3px 8px 3px 0;font-size:11pt;font-weight:bold;vertical-align:top;">${l1}</td>
          <td style="padding:3px 0;font-size:11pt;vertical-align:top;">: ${v1}</td>
          <td style="width:130px;padding:3px 8px 3px 0;font-size:11pt;font-weight:bold;vertical-align:top;">${l2}</td>
          <td style="padding:3px 0;font-size:11pt;vertical-align:top;">: ${v2}</td>
        </tr>`
      ).join("")}
    </table>`;

    const html = `
      <!DOCTYPE html>
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <meta name=ProgId content=Word.Document>
        <meta name=Generator content="GuruPRO AI">
        <meta name=Originator content="Microsoft Word">
        <title>${jenis} - ${mapel}</title>
        <!--[if gte mso 9]><xml><o:DocumentProperties><o:Title>${jenis} - ${mapel}</o:Title><o:Author>GuruPRO</o:Author></o:DocumentProperties></xml><![endif]-->
        <style>
          @page { margin: 2.5cm 2cm 2cm 3cm; size: A4; }
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; margin: 0; padding: 0; }
          h2 { font-size: 14pt; margin: 16px 0 10px; font-weight: bold; text-transform: uppercase; text-align: center; border-bottom: 1px solid #ccc; padding-bottom: 6px; }
          h3 { font-size: 12pt; margin: 14px 0 8px; font-weight: bold; }
          p { margin: 6px 0; text-align: justify; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; vertical-align: top; }
          th { background: #f3f4f6; font-weight: bold; text-align: center; }
          .kop-section { margin-bottom: 16px; }
          .soal-item { page-break-inside: avoid; margin-bottom: 16px; }
          .soal-header { font-size: 12pt; margin-bottom: 6px; }
          .pertanyaan { margin-bottom: 8px; text-align: justify; }
          .opsi { margin-left: 20px; margin-bottom: 4px; }
          .tipe-badge { background: #e5e7eb; padding: 1px 6px; border-radius: 3px; font-size: 9pt; }
          .pembahasan { margin-top: 8px; padding: 8px; background: #f0fdf4; border-left: 3px solid #22c55e; font-size: 10pt; color: #166534; }
          .kunci-box { margin-top: 6px; padding: 6px; background: #fefce8; border-left: 3px solid #f59e0b; font-size: 10pt; }
          .page-footer { position: fixed; bottom: 1.5cm; left: 0; right: 0; text-align: right; font-size: 9pt; color: #666; }
          @media print { .page-footer { display: block; } }
        </style>
      </head>
      <body>
        <div class="kop-section">
          ${kopTable}
          ${identitasTable}
          <h2>${jenis}</h2>
        </div>
        <div class="soal-list">
          ${contentHtml}
        </div>
        <div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess("File Word berhasil di-download!");
  };

  const downloadPdf = async () => {
    if (soalList.length === 0) return;
    setIsLoading(true);
    setLoadingProgress("Mempersiapkan ekspor PDF...");
    
    try {
      const html2pdf = await loadHtml2Pdf();
      const data = enrichExportMeta();
      const content = document.createElement('div');
      
      content.style.fontFamily = "'Times New Roman', serif";
      content.style.fontSize = "12pt";
      content.style.lineHeight = "1.5";
      content.style.color = "black";

      let contentHtml = "";
      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const schoolName = data.namaSekolah || "GuruPRO";
      const jenjang = data.jenjang || "";
      const kelas = data.kelas || "-";
      const mapel = data.mapel || "Mata Pelajaran";
      const kurikulum = data.kurikulumLabel || "Kurikulum Merdeka";
      const jenis = data.jenisAsesmen || "Asesmen";
      const guru = data.namaGuru || "Pendidik";
      const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

      const kopHtml = buildKopSekolahHTML({
        nama_sekolah: schoolName,
        alamat: data.schoolAddress || null,
        npsn: data.schoolNpsn || null,
        logo: data.schoolLogo || null,
      }) + `

      <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
        <tr>
          <td style="width:130px;padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Mata Pelajaran</td>
          <td style="padding:2px 0;font-size:11pt;">: ${mapel}</td>
          <td style="width:130px;padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Jenis Asesmen</td>
          <td style="padding:2px 0;font-size:11pt;">: ${jenis}</td>
        </tr>
        <tr>
          <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Kelas / Jenjang</td>
          <td style="padding:2px 0;font-size:11pt;">: Kelas ${kelas} (${jenjang})</td>
          <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Kurikulum</td>
          <td style="padding:2px 0;font-size:11pt;">: ${kurikulum}</td>
        </tr>
        <tr>
          <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Guru</td>
          <td style="padding:2px 0;font-size:11pt;">: ${guru}</td>
          <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Tanggal</td>
          <td style="padding:2px 0;font-size:11pt;">: ${today}</td>
        </tr>
      </table>`;

      if (activeTab === 'soal') {
        soalList.forEach((s, idx) => {
          let opsiHtml = "";
          if (s.gambarData) {
            opsiHtml += `<div style="margin:8px 0 8px 24px;"><img src="${s.gambarData}" style="max-width:240px;height:auto;" /></div>`;
          }
          if (s.opsi && Array.isArray(s.opsi)) {
            opsiHtml += s.opsi.map((o: string, oIdx: number) => {
              const prefix = /^[A-H][\.\)]\s?/.test(o) ? "" : `${letters[oIdx]}. `;
              return `<p class="opsi">${prefix}${o}</p>`;
            }).join('');
          } else if (s.tipe === 'jodoh' && s.opsi?.kiri) {
            opsiHtml += `<table style="border-collapse:collapse;margin-left:24px;margin-top:4pt;margin-bottom:4pt;width:80%;">`;
            opsiHtml += `<tr><th style="border:1px solid #000;padding:4px;background:#f3f4f6;">Kolom Kiri</th><th style="border:1px solid #000;padding:4px;background:#f3f4f6;">Kolom Kanan</th></tr>`;
            const maxLen = Math.max(s.opsi.kiri.length, s.opsi.kanan?.length || 0);
            for (let i = 0; i < maxLen; i++) {
              opsiHtml += `<tr><td style="border:1px solid #000;padding:4px;">${s.opsi.kiri[i] || ""}</td><td style="border:1px solid #000;padding:4px;">${s.opsi.kanan?.[i] || ""}</td></tr>`;
            }
            opsiHtml += `</table>`;
          } else if (s.tipe === 'tabel' && s.opsi?.headers) {
            opsiHtml += `<table style="border-collapse:collapse;margin-left:24px;margin-top:4pt;margin-bottom:4pt;width:90%;">`;
            opsiHtml += `<tr>${s.opsi.headers.map((h: string) => `<th style="border:1px solid #000;padding:4px;background:#f3f4f6;">${h}</th>`).join('')}</tr>`;
            s.opsi.rows?.forEach((row: string[]) => {
              opsiHtml += `<tr>${row.map(cell => `<td style="border:1px solid #000;padding:4px;">${cell}</td>`).join('')}</tr>`;
            });
            opsiHtml += `</table>`;
          } else if (s.tipe === 'sebab-akibat' && s.opsi?.pernyataan) {
            opsiHtml += `<p class="opsi"><strong>PERNYATAAN:</strong> ${s.opsi.pernyataan}</p>`;
            opsiHtml += `<p class="opsi"><strong>ALASAN:</strong> ${s.opsi.alasan}</p>`;
          } else if (s.tipe === 'bs') {
            opsiHtml = `<p class="opsi"><strong>A.</strong> Benar &nbsp;&nbsp;&nbsp; <strong>B.</strong> Salah</p>`;
          }

          contentHtml += `
            <div class="soal-item">
              <div class="soal-header">
                <strong>${idx + 1}.</strong> <span class="tipe-badge">${typeLabelsMap[s.tipe] || s.tipe}</span>
                ${s.tingkat ? `<span class="tipe-badge">${s.tingkat}</span>` : ""}
                ${s.kognitif ? `<span class="tipe-badge" style="background:#dbeafe;">${s.kognitif}</span>` : ""}
                ${s.skor ? `<span class="tipe-badge" style="background:#f3e8ff;">Skor: ${s.skor}</span>` : ""}
              </div>
              <div class="pertanyaan">${s.pertanyaan}</div>
              ${s.stimulus ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;margin:6px 0;font-style:italic;font-size:10pt;"><strong>Stimulus:</strong> ${s.stimulus}</div>` : ""}
              ${s.gambar ? `<div style="margin:6px 0;text-align:center;font-style:italic;color:#666;font-size:9pt;">[Gambar: ${s.gambar}]</div>` : ""}
              ${opsiHtml}
              ${s.pembahasan ? `<div class="pembahasan"><strong>Pembahasan:</strong> ${s.pembahasan}</div>` : ""}
            </div>
          `;
        });
      } else if (activeTab === 'kunci') {
        soalList.forEach((s, idx) => {
          let kunciStr = "";
          if (s.tipe === 'jodoh') {
            kunciStr = JSON.stringify(s.kunci);
          } else if (Array.isArray(s.kunci)) {
            kunciStr = s.kunci.join(', ');
          } else {
            kunciStr = String(s.kunci);
          }
          contentHtml += `
            <div class="soal-item">
              <div class="soal-header"><strong>${idx + 1}.</strong> ${s.pertanyaan}</div>
              <div class="kunci-box"><strong>Kunci:</strong> ${kunciStr}</div>
              ${s.pembahasan ? `<div class="pembahasan"><strong>Pembahasan:</strong> ${s.pembahasan}</div>` : ""}
            </div>
          `;
        });
      } else if (activeTab === 'kisikisi') {
        contentHtml += `
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr style="background-color:#1E3A8A;">
                <th style="border:1px solid #000;padding:4px;text-align:center;color:#fff;font-size:9pt;">No</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;">Tipe</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;">Elemen</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;">Capaian Pembelajaran (CP)</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;">Indikator Soal</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;text-align:center;">Level</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;text-align:center;">Kesulitan</th>
                <th style="border:1px solid #000;padding:4px;color:#fff;font-size:9pt;text-align:center;">Skor</th>
              </tr>
            </thead>
            <tbody>
              ${soalList.map((s, idx) => `
                <tr>
                  <td style="border:1px solid #000;padding:4px;text-align:center;font-size:9pt;">${idx + 1}</td>
                  <td style="border:1px solid #000;padding:4px;font-size:9pt;">${s.tipe}</td>
                  <td style="border:1px solid #000;padding:4px;font-size:9pt;">${s.elemen || "-"}</td>
                  <td style="border:1px solid #000;padding:4px;font-size:9pt;">${s.cp || "-"}</td>
                  <td style="border:1px solid #000;padding:4px;font-size:9pt;">${s.indikator || "-"}</td>
                  <td style="border:1px solid #000;padding:4px;text-align:center;font-size:9pt;">${s.kognitif}</td>
                  <td style="border:1px solid #000;padding:4px;text-align:center;font-size:9pt;">${s.tingkat}</td>
                  <td style="border:1px solid #000;padding:4px;text-align:center;font-size:9pt;">${s.skor || 1}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else if (activeTab === 'analisis') {
        contentHtml += `
          <h3 style="font-family:Arial,sans-serif;margin-bottom:12px;font-size:14pt;">Analisis Butir Soal</h3>
          <table style="border-collapse:collapse;width:100%;">
            <thead>
              <tr style="background-color:#1E3A8A;">
                <th style="border:1px solid #000;padding:6px;color:#fff;font-size:10pt;">Kategori</th>
                <th style="border:1px solid #000;padding:6px;color:#fff;font-size:10pt;text-align:center;">Kuantitas</th>
                <th style="border:1px solid #000;padding:6px;color:#fff;font-size:10pt;text-align:center;">Persentase</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border:1px solid #000;padding:6px;font-weight:bold;">Total Soal</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;">${soalList.length}</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;">100%</td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="border:1px solid #000;padding:6px;">LOTS (C1-C3)</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${lotsCount}</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${lotsPct}%</td>
              </tr>
              <tr>
                <td style="border:1px solid #000;padding:6px;">HOTS (C4-C6)</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${hotsCount}</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${hotsPct}%</td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="border:1px solid #000;padding:6px;">Tingkat Kesulitan: Mudah</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${tingkatCount.mudah}</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${mudahPct}%</td>
              </tr>
              <tr>
                <td style="border:1px solid #000;padding:6px;">Tingkat Kesulitan: Sedang</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${tingkatCount.sedang}</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${sedangPct}%</td>
              </tr>
              <tr style="background:#f9fafb;">
                <td style="border:1px solid #000;padding:6px;">Tingkat Kesulitan: Sulit</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${tingkatCount.sulit}</td>
                <td style="border:1px solid #000;padding:6px;text-align:center;">${sulitPct}%</td>
              </tr>
            </tbody>
          </table>
        `;
      }

      // Note: Word field codes work in DOCX but not in html2pdf (canvas-based).
      // For DOCX downloads, Word field codes provide proper multi-page numbering.
      // For PDF, the footer appears on the last page only (html2pdf limitation).
      // Proper multi-page PDF numbering would require jsPDF direct manipulation.
      const printHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>${jenis} - ${mapel}</title>
          <style>
            @page { margin: 25mm 20mm 20mm 30mm; size: A4; }
            * { box-sizing: border-box; }
            body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; margin: 0; padding: 20px 25px; }
            h1 { font-size: 16pt; text-align: center; margin: 0 0 4px; font-weight: bold; text-transform: uppercase; }
            h2 { font-size: 14pt; margin: 16px 0 10px; font-weight: bold; }
            h3 { font-size: 12pt; margin: 14px 0 8px; font-weight: bold; }
            p { margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; vertical-align: top; }
            th { background: #f3f4f6; font-weight: bold; text-align: center; }
            .kop-section { margin-bottom: 16px; }
            .soal-item { page-break-inside: avoid; margin-bottom: 16px; }
            .soal-header { font-size: 12pt; margin-bottom: 4px; }
            .pertanyaan { margin-bottom: 8px; text-align: justify; }
            .opsi { margin-left: 24px; margin-bottom: 2px; }
            .tipe-badge { background: #e5e7eb; padding: 1px 6px; border-radius: 3px; font-size: 9pt; }
            .pembahasan { margin-top: 8px; padding: 8px; background: #f0fdf4; border-left: 3px solid #22c55e; font-size: 10pt; color: #166534; }
            .kunci-box { margin-top: 6px; padding: 6px; background: #fefce8; border-left: 3px solid #f59e0b; font-size: 10pt; }
            .page-footer { position: fixed; bottom: 15mm; right: 20mm; font-size: 9pt; color: #666; }
            @media print { .page-footer { display: block; } body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="kop-section">
            ${kopHtml}
          </div>
          <div class="soal-list">
            ${contentHtml}
          </div>
          <div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
        </body>
        </html>
      `;
      content.innerHTML = printHtml;

      const opt = {
        margin: [25, 20, 20, 30],
        filename: `${activeTab === 'soal' ? 'Soal' : activeTab === 'kunci' ? 'Kunci' : activeTab === 'kisikisi' ? 'Kisi_Kisi' : 'Analisis'}_${(data.mapel || "GuruPRO").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: activeTab === 'kisikisi' ? 'landscape' : 'portrait' }
      };

      await html2pdf().set(opt).from(content).save();
      showSuccess("PDF berhasil di-download!");
    } catch (error: any) {
      console.error(error);
      showError("Gagal membuat PDF: " + error.message);
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  };

  const exportToJSON = () => {
    if (soalList.length === 0) return;
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      metadata: currentFormData || metaInfo,
      soal: soalList
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soal_${(currentFormData?.topik || "gurupro").replace(/[^a-zA-Z0-9]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("JSON berhasil di-download!");
  };

  // --- KISI-KISI EXPORT FUNCTIONS ---
  const downloadKisikisiPdf = async (html: string) => {
    if (soalList.length === 0) return;
    setIsLoading(true);
    setLoadingProgress("Mempersiapkan export Kisi-kisi PDF...");

    try {
      const html2pdf = await loadHtml2Pdf();
      const data = currentFormData || metaInfo;
      const content = document.createElement('div');
      content.innerHTML = html;
      content.style.fontFamily = "'Times New Roman', serif";
      content.style.fontSize = "11pt";
      content.style.lineHeight = "1.4";

      const opt = {
        margin: [25, 20, 20, 30],
        filename: `Kisi_Kisi_${(data.mapel || "GuruPRO").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(content).save();
      showSuccess("Kisi-kisi PDF berhasil di-download!");
    } catch (error: any) {
      console.error(error);
      showError("Gagal membuat Kisi-kisi PDF: " + error.message);
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  };

  const downloadKisikisiWord = (html: string) => {
    if (soalList.length === 0) return;
    try {
      const blob = new Blob(['﻿' + html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kisi_Kisi_${(currentFormData?.mapel || "GuruPRO").replace(/[^a-zA-Z0-9]/g, "_")}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess("Kisi-kisi Word berhasil di-download!");
    } catch (error: any) {
      console.error(error);
      showError("Gagal membuat Kisi-kisi Word: " + error.message);
    }
  };

  // --- IMPORT SOAL FUNCTION ---
  const handleImportSoal = (importedList: any[], merge: boolean) => {
    const oldList = [...soalList];
    const newSoalList = importedList.map((soal, idx) => ({
      ...soal,
      id: soal.id || `import-${Date.now()}-${idx}`,
      nomor: merge ? soalList.length + idx + 1 : idx + 1,
    }));

    if (merge) {
      setSoalList(prev => [...prev, ...newSoalList]);
      addToHistory("import", -1, null, newSoalList, [...soalList, ...newSoalList]);
      showSuccess(`${newSoalList.length} soal berhasil ditambahkan! Total: ${soalList.length + newSoalList.length} soal`);
    } else {
      setSoalList(newSoalList);
      addToHistory("import", -1, oldList, newSoalList, newSoalList);
      showSuccess(`${newSoalList.length} soal berhasil diimport!`);
    }
    setActiveTab("soal");
  };

  const exportToCBT = () => {
    if (soalList.length === 0) return;
    const data = currentFormData || metaInfo;
    const tipeMap: { [key: string]: string } = {
      'pg': 'pg',
      'isian': 'isian',
      'essay': 'essay',
      'bs': 'bs',
      'pg-kompleks': 'pg_kompleks',
      'jodoh': 'menjodohkan',
      'urutan': 'urutan',
      'tabel': 'tabel',
      'sebab-akibat': 'sebab-akibat'
    };

    const questions = soalList.map(s => {
      const mappedType = tipeMap[s.tipe] || s.tipe;
      let opts = s.opsi;
      let answerKey = s.kunci;

      if (mappedType === 'pg_kompleks' && Array.isArray(opts)) {
        opts = opts.map(o => String(o).replace(/^[A-H][\.\)]\s?/, '').trim());
        if (typeof answerKey === 'string' && answerKey.includes(',')) {
          answerKey = answerKey.split(',').map(k => k.trim());
        } else if (!Array.isArray(answerKey)) {
          answerKey = answerKey ? [String(answerKey).trim()] : [];
        }
      }

      if (mappedType === 'menjodohkan' && opts && typeof opts === 'object' && opts.kiri) {
        const ak: { [key: string]: string } = {};
        for (let i = 0; i < (opts.kiri || []).length; i++) {
          ak[String(i)] = String.fromCharCode(65 + i);
        }
        answerKey = ak;
      }

      return {
        type: mappedType,
        difficulty: s.tingkat || 'sedang',
        cognitive_level: s.kognitif || 'C2',
        topic: data.topik || '',
        indicator: s.indikator || '',
        question: s.pertanyaan || '',
        options: opts,
        answer_key: answerKey,
        explanation: s.pembahasan || ''
      };
    });

    const exportPayload = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      source: 'GuruPRO Pembuat Soal Otomatis',
      metadata: {
        mapel: data.mapel || '',
        jenjang: data.jenjang || '',
        kelas: data.kelas || '',
        topik: data.topik || '',
        kurikulum: data.kurikulumLabel || '',
        jenisAsesmen: data.jenisAsesmen || '',
        totalSoal: questions.length
      },
      questions: questions
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `soal_${(data.topik || "gurupro").replace(/[^a-zA-Z0-9]/g, "_")}-cbt.json`;
    a.click();
    URL.revokeObjectURL(url);
    showSuccess("Format CBT berhasil di-download!");
  };

  const totalReviewed = soalList.filter((s) => s.id && reviewedQuestions[s.id]).length;
  const isAllReviewed = totalReviewed === soalList.length;

  const triggerExportWithReviewCheck = (exportAction: () => void) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk melakukan ekspor, cetak, atau unduh dokumen.");
      return;
    }
    if (totalReviewed < soalList.length) {
      setPendingExportAction(() => exportAction);
    } else {
      exportAction();
    }
  };

  // --- STATS CALCULATION FOR ANALYTICS TAB ---
  const total = soalList.length;
  const kognitifCount = { C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0 };
  const tingkatCount = { mudah: 0, sedang: 0, sulit: 0 };
  const tipeCount: { [key: string]: number } = {};

  soalList.forEach((s) => {
    const k = String(s.kognitif || "C2").toUpperCase().replace(/[^C0-6]/g, "") as keyof typeof kognitifCount;
    if (kognitifCount.hasOwnProperty(k)) kognitifCount[k]++;
    
    const t = String(s.tingkat || "sedang").toLowerCase() as keyof typeof tingkatCount;
    if (tingkatCount.hasOwnProperty(t)) tingkatCount[t]++;
    
    const tp = s.tipe || "pg";
    tipeCount[tp] = (tipeCount[tp] || 0) + 1;
  });

  const lotsCount = kognitifCount.C1 + kognitifCount.C2 + kognitifCount.C3;
  const hotsCount = kognitifCount.C4 + kognitifCount.C5 + kognitifCount.C6;
  const lotsPct = total > 0 ? Math.round((lotsCount / total) * 100) : 0;
  const hotsPct = total > 0 ? Math.round((hotsCount / total) * 100) : 0;

  const mudahPct = total > 0 ? Math.round((tingkatCount.mudah / total) * 100) : 0;
  const sedangPct = total > 0 ? Math.round((tingkatCount.sedang / total) * 100) : 0;
  const sulitPct = total > 0 ? Math.round((tingkatCount.sulit / total) * 100) : 0;

  const kognitifLabels = {
    C1: "C1 - Mengingat",
    C2: "C2 - Memahami",
    C3: "C3 - Menerapkan",
    C4: "C4 - Menganalisis",
    C5: "C5 - Mengevaluasi",
    C6: "C6 - Mencipta"
  };

  const kognitifColors = {
    C1: "bg-blue-400",
    C2: "bg-emerald-400",
    C3: "bg-amber-400",
    C4: "bg-orange-500",
    C5: "bg-rose-500",
    C6: "bg-purple-500"
  };

  const typeLabelsMap: { [key: string]: string } = {
    pg: "Pilihan Ganda",
    isian: "Isian Singkat",
    essay: "Uraian / Essay",
    "pg-kompleks": "PG Kompleks",
    bs: "Benar / Salah",
    jodoh: "Menjodohkan",
    urutan: "Urutan",
    tabel: "Lengkapi Tabel",
    "sebab-akibat": "Sebab-Akibat"
  };

  const renderJodohAnswers = (jawaban: any) => {
    if (Array.isArray(jawaban)) {
      return (
        <div className="space-y-1 mt-2 text-xs">
          {jawaban.map((item: any, index: number) => (
            <div key={index} className="flex gap-2 items-center">
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{item.kunci}</span>
              <span className="text-gray-400">➡️</span>
              <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">{item.nilai}</span>
            </div>
          ))}
        </div>
      );
    }
    return String(jawaban);
  };

  // Helper render opsi in dashboard
  const renderOpsiInList = (soal: any) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    if (!soal.opsi) return null;

    if (Array.isArray(soal.opsi)) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {soal.opsi.map((o: string, idx: number) => {
            const hasPrefix = /^[A-H][\.\)]\s?/.test(o);
            const displayText = hasPrefix ? o : `${letters[idx]}. ${o}`;
            return (
              <div key={idx} className="flex items-start gap-3 p-3 bg-white border border-slate-200/60 rounded-xl text-sm text-slate-700">
                <span className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs bg-slate-100 text-slate-500 shrink-0">{letters[idx]}.</span>
                <span className="flex-1 mt-0.5">{o.replace(/^[A-H][\.\)]\s?/, '')}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (soal.tipe === 'jodoh' && soal.opsi.kiri && soal.opsi.kanan) {
      return (
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5">
            <p className="text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wide">Kolom Kiri:</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {soal.opsi.kiri.map((k: string, i: number) => <li key={i} className="bg-white px-3 py-1.5 rounded border border-indigo-100/50">{k}</li>)}
            </ul>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5">
            <p className="text-xs font-bold text-emerald-700 mb-2 uppercase tracking-wide">Kolom Kanan:</p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              {soal.opsi.kanan.map((k: string, i: number) => <li key={i} className="bg-white px-3 py-1.5 rounded border border-emerald-100/50">{k}</li>)}
            </ul>
          </div>
        </div>
      );
    }

    if (soal.tipe === 'tabel' && soal.opsi.headers && soal.opsi.rows) {
      return (
        <div className="mt-3 overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full text-sm text-slate-700">
            <thead className="bg-slate-50">
              <tr>
                {soal.opsi.headers.map((h: string, idx: number) => (
                  <th key={idx} className="border-b border-slate-200 px-4 py-2 text-left font-bold text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {soal.opsi.rows.map((row: string[], rIdx: number) => (
                <tr key={rIdx}>
                  {row.map((cell: string, cIdx: number) => (
                    <td key={cIdx} className="px-4 py-2 border-r border-slate-100 last:border-0">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (soal.tipe === 'sebab-akibat' && (soal.opsi.pernyataan || soal.opsi.alasan)) {
      return (
        <div className="mt-3 space-y-3">
          <div className="bg-amber-50/50 border border-amber-200/50 rounded-xl p-3.5">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">PERNYATAAN:</p>
            <p className="text-sm text-slate-800 mt-1 font-medium leading-relaxed">{soal.opsi.pernyataan}</p>
          </div>
          <div className="bg-rose-50/50 border border-rose-200/50 rounded-xl p-3.5">
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">ALASAN / SEBAB:</p>
            <p className="text-sm text-slate-800 mt-1 font-medium leading-relaxed">{soal.opsi.alasan}</p>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderSekolahModule = () => {
    return (
      <div className="space-y-6">
        {/* Header Modul */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Manajemen Sekolah &amp; Akademik</h3>
            <p className="text-xs text-slate-500 mt-1">
              Kelola profil sekolah, data kelas, mata pelajaran, jadwal mengajar, dan presensi harian secara terpadu.
            </p>
          </div>
          
          {/* Sub-Tab Navigator */}
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl gap-0.5 shrink-0 self-start sm:self-auto">
            {[
              { id: "tahun-ajaran", label: "TA", icon: Calendar },
              { id: "profil", label: "Profil", icon: School },
              { id: "kelas-mapel", label: "Kelas & Mapel", icon: BookOpen },
              { id: "ekskul", label: "Ekskul", icon: Users },
              { id: "siswa", label: "Siswa", icon: Users },
              { id: "jadwal", label: "Jadwal", icon: Calendar },
              { id: "presensi", label: "Presensi", icon: Clock },
            ].map((tab) => {
              const isActive = tabSekolah === tab.id;
              const hasActiveTa = tahunAjaranList.some((ta: any) => ta.is_active);
              const isLocked = tab.id !== "tahun-ajaran" && !hasActiveTa;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (isLocked) {
                      setTabSekolah("tahun-ajaran");
                    } else {
                      setTabSekolah(tab.id as any);
                    }
                  }}
                  title={isLocked ? "Aktifkan Tahun Ajaran terlebih dahulu di tab TA" : tab.label}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                    isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                  } ${
                    isActive ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <AppIcon label={tab.label} size={36} iconSize={18} category={resolveCategory(tab.label)} active={isActive} icon={<tab.icon size={18} />} />
                  <span>{tab.label}</span>
                  {isLocked && <span className="text-[9px]">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-Tab: Profil Sekolah */}
        {tabSekolah === "profil" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Input/Edit */}
            <div className="lg:col-span-1 bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {schId ? "✏️ Edit Profil Sekolah" : "➕ Tambah Sekolah Baru"}
              </h4>
              
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Sekolah <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={schNama}
                    onChange={(e) => setSchNama(e.target.value)}
                    placeholder="Contoh: SMA Negeri 1 Jakarta"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">NPSN <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={schNpsn}
                    onChange={(e) => setSchNpsn(e.target.value)}
                    placeholder="Masukkan Nomor Pokok Sekolah Nasional"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                  />
                  {foundInstitution && (
                    <div className="mt-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-[10px] font-semibold text-emerald-800 mb-2">
                        ✅ Ditemukan: <strong>{foundInstitution.name}</strong> ({foundInstitution.jenjang})
                      </p>
                      <p className="text-[9px] text-emerald-600 mb-2">
                        Sekolah Anda sudah terdaftar sebagai institusi di GuruPRO. Hubungkan akun Anda untuk mengakses data sekolah.
                      </p>
                      <button
                        onClick={handleConnectInstitution}
                        disabled={connectingInstitution}
                        className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {connectingInstitution ? "Menghubungkan..." : "🔗 Hubungkan Akun Saya"}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Kepala Sekolah</label>
                  <input
                    type="text"
                    value={schKepala}
                    onChange={(e) => setSchKepala(e.target.value)}
                    placeholder="Contoh: Drs. H. Budi Santoso, M.Pd."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Pengawas Pembina</label>
                  <input
                    type="text"
                    value={schPengawas}
                    onChange={(e) => setSchPengawas(e.target.value)}
                    placeholder="Contoh: Dra. Endang Susilowati, M.Pd."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">NIP Kepala Sekolah</label>
                  <input
                    type="text"
                    value={schNipKepala}
                    onChange={(e) => setSchNipKepala(e.target.value)}
                    placeholder="Masukkan NIP Kepala Sekolah"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">NIP Pengawas Pembina</label>
                  <input
                    type="text"
                    value={schNipPengawas}
                    onChange={(e) => setSchNipPengawas(e.target.value)}
                    placeholder="Masukkan NIP Pengawas Pembina"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                  />
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50 space-y-3 sm:col-span-2">
                  <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tampilkan Tanda Tangan pada Dokumen</h5>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schShowTtdKepala}
                        onChange={(e) => setSchShowTtdKepala(e.target.checked)}
                        className="w-4 h-4 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500"
                      />
                      <span>Kepala Sekolah</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schShowTtdPengawas}
                        onChange={(e) => setSchShowTtdPengawas(e.target.checked)}
                        className="w-4 h-4 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500"
                      />
                      <span>Pengawas Pembina</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={schShowTtdWali}
                        onChange={(e) => setSchShowTtdWali(e.target.checked)}
                        className="w-4 h-4 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500"
                      />
                      <span>Wali Kelas</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Alamat Sekolah</label>
                  <textarea
                    value={schAlamat}
                    onChange={(e) => setSchAlamat(e.target.value)}
                    placeholder="Tulis alamat lengkap sekolah..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Logo Sekolah (Maks. 500KB)</label>
                  <div className="flex items-center gap-3 mt-1">
                    {schLogo ? (
                      <div className="relative w-12 h-12 border border-slate-200 rounded-xl overflow-hidden bg-white flex items-center justify-center shrink-0">
                        <Image src={schLogo} alt="Logo Preview" width={48} height={48} className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setSchLogo("")}
                          className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold shadow"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-12 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-400 text-lg shrink-0">
                        🏫
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer bg-white hover:bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-[10px] font-bold text-slate-600 text-center transition">
                      Pilih Berkas Logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleAddSchool}
                  className="flex-grow py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
                >
                  {schId ? "Perbarui Sekolah" : "Simpan Sekolah"}
                </button>
                {schId && (
                  <button
                    type="button"
                    onClick={() => {
                      setSchId("");
                      setSchNama("");
                      setSchNpsn("");
                      setSchAlamat("");
                      setSchKepala("");
                      setSchLogo("");
                    }}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                )}
              </div>
            </div>

            {/* List Sekolah */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sekolah Terdaftar</h4>
              {schools.length === 0 ? (
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 text-center">
                  <span className="text-3xl">🏫</span>
                  <p className="text-xs text-slate-500 font-medium mt-3">Belum ada sekolah terdaftar.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Silakan tambahkan sekolah pertama Anda menggunakan form di sebelah kiri.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {schools.map((sch) => {
                    const isSelected = selectedSchoolId === sch.id;
                    return (
                      <div
                        key={sch.id}
                        className={`bg-white border rounded-3xl p-5 shadow-sm transition-all flex flex-col justify-between ${
                          isSelected ? "border-indigo-500 ring-2 ring-indigo-500/10 shadow-indigo-50/50" : "border-slate-200/80 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden">
                            {sch.logo ? (
                              <Image src={sch.logo} alt="Logo" width={56} height={56} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-2xl text-slate-400">🏫</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-slate-900 truncate">{sch.nama_sekolah}</h5>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">NPSN: {sch.npsn || "-"}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-1 leading-normal line-clamp-2">{sch.alamat || "Alamat belum diatur"}</p>
                            {sch.nama_kepala_sekolah && (
                              <p className="text-[9px] text-slate-400 italic mt-1.5 truncate">Kepsek: {sch.nama_kepala_sekolah}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setSelectedSchoolId(sch.id)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                              isSelected ? "bg-indigo-50 text-indigo-700 font-bold" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {isSelected ? "🟢 Aktif" : "Gunakan"}
                          </button>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSchId(sch.id);
                                setSchNama(sch.nama_sekolah);
                                setSchNpsn(sch.npsn || "");
                                setSchAlamat(sch.alamat || "");
                                setSchKepala(sch.nama_kepala_sekolah || "");
                                setSchLogo(sch.logo || "");
                                setSchPengawas(sch.nama_pengawas || "");
                                setSchNipKepala(sch.nip_kepala_sekolah || "");
                                setSchNipPengawas(sch.nip_pengawas || "");
                                setSchShowTtdKepala(sch.show_ttd_kepala !== false);
                                setSchShowTtdPengawas(sch.show_ttd_pengawas !== false);
                                setSchShowTtdWali(sch.show_ttd_wali !== false);
                              }}
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 rounded-lg text-xs cursor-pointer"
                              title="Ubah"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchool(sch.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-xs cursor-pointer"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sub-Tab: Kelas & Mapel */}
        {tabSekolah === "kelas-mapel" && (
          <div className="space-y-6">
            {!selectedSchoolId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk mengelola kelas dan mata pelajaran.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Kelola Kelas */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">🏫 Kelola Kelas</h4>
                  
                  <div className="space-y-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Nama Kelas</label>
                        <input
                          type="text"
                          value={newClassName}
                          onChange={(e) => setNewClassName(e.target.value)}
                          placeholder="Contoh: X MIPA 1"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Wali Kelas <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={newClassWali}
                          onChange={(e) => setNewClassWali(e.target.value)}
                          placeholder="Contoh: Budi Cahyono, S.Pd."
                          required
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-semibold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 block mb-0.5">NIP Wali Kelas</label>
                        <input
                          type="text"
                          value={newClassWaliNip}
                          onChange={(e) => setNewClassWaliNip(e.target.value)}
                          placeholder="Masukkan NIP Wali Kelas"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-semibold text-slate-800"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={newClassWaliUser}
                            onChange={(e) => setNewClassWaliUser(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-[10px] font-semibold text-slate-600">Saya Wali Kelas kelas ini</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      {editingClassId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClassId("");
                            setNewClassName("");
                            setNewClassWali("");
                            setNewClassWaliNip("");
                            setNewClassWaliUser(false);
                          }}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Batal
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddClass}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer shrink-0"
                      >
                        {editingClassId ? "Simpan Perubahan" : "Tambah Kelas"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {classes.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-medium text-center py-4">Belum ada kelas terdaftar.</p>
                    ) : (
                      classes.map((cls) => (
                        <div key={cls.id} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 border border-slate-100 px-3.5 py-2.5 rounded-xl transition">
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-slate-800 block">{cls.nama_kelas}</span>
                            {cls.wali_kelas && (
                              <span className="text-[9px] font-semibold text-indigo-600 block">Wali Kelas: {cls.wali_kelas}{cls.wali_kelas_nip ? ` (NIP: ${cls.wali_kelas_nip})` : ''}</span>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClassId(cls.id);
                                  setNewClassName(cls.nama_kelas);
                                  setNewClassWali(cls.wali_kelas || "");
                                  setNewClassWaliNip(cls.wali_kelas_nip || "");
                                  setNewClassWaliUser(!!cls.wali_kelas_user_id);
                                }}
                                className="p-1 hover:bg-slate-200 border border-transparent text-indigo-600 rounded-lg text-xs cursor-pointer"
                                title="Ubah"
                              >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClass(cls.id)}
                              className="p-1 hover:bg-slate-200 border border-transparent text-rose-500 rounded-lg text-xs cursor-pointer"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Kelola Mapel */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📚 Kelola Mata Pelajaran</h4>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      placeholder="Mata Pelajaran (Contoh: Matematika Wajib)"
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    />
                    {editingSubjectId && (
                      <button
                        type="button"
                        onClick={() => { setEditingSubjectId(""); setNewSubjectName(""); }}
                        className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddSubject}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer shrink-0"
                    >
                      {editingSubjectId ? "Simpan Perubahan" : "Tambah Mapel"}
                    </button>
                  </div>

                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {subjects.length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-medium text-center py-4">Belum ada mata pelajaran terdaftar.</p>
                    ) : (
                      subjects.map((sb) => (
                        <div key={sb.id} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 border border-slate-100 px-3.5 py-2 rounded-xl transition">
                          <span className="text-xs font-semibold text-slate-800">{sb.nama_mapel}</span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubjectId(sb.id);
                                setNewSubjectName(sb.nama_mapel);
                              }}
                              className="p-1 hover:bg-slate-200 border border-transparent text-indigo-600 rounded-lg text-xs cursor-pointer"
                              title="Ubah"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubject(sb.id)}
                              className="p-1 hover:bg-slate-200 border border-transparent text-rose-500 rounded-lg text-xs cursor-pointer"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab: Ekskul */}
        {tabSekolah === "ekskul" && (
          <div className="space-y-6">
            {!selectedSchoolId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah terlebih dahulu untuk mengelola ekstrakurikuler.
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">🎯 Kelola Ekstrakurikuler</h4>

                <div className="space-y-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Nama Ekskul</label>
                      <input
                        type="text"
                        value={newEkskulName}
                        onChange={(e) => setNewEkskulName(e.target.value)}
                        placeholder="Contoh: Pramuka, Paskibra"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-semibold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 block mb-0.5">Kelas</label>
                      <select
                        value={newEkskulClassId}
                        onChange={(e) => setNewEkskulClassId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-semibold text-slate-800"
                      >
                        <option value="">-- Pilih Kelas --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>{cls.nama_kelas}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="newEkskulPembinaUser"
                      type="checkbox"
                      checked={newEkskulPembinaUser}
                      onChange={(e) => setNewEkskulPembinaUser(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="newEkskulPembinaUser" className="text-[10px] font-semibold text-slate-600 cursor-pointer select-none">
                      Saya Pembina ekskul ini
                    </label>
                  </div>
                  <div className="flex gap-2 justify-end">
                    {editingEkskulId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEkskulId("");
                          setNewEkskulName("");
                          setNewEkskulClassId("");
                          setNewEkskulPembinaUser(false);
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddEkskul}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer shrink-0"
                    >
                      {editingEkskulId ? "Simpan Perubahan" : "Tambah Ekskul"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {ekskulList.length === 0 ? (
                    <p className="text-[10px] text-slate-400 font-medium text-center py-4">Belum ada ekstrakurikuler.</p>
                  ) : (
                    ekskulList.map((ekskul) => (
                      <div key={ekskul.id} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 border border-slate-100 px-3.5 py-2.5 rounded-xl transition">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-slate-800 block">{ekskul.namaEkskul}</span>
                          <span className="text-[9px] font-semibold text-slate-500 block">{ekskul.namaKelas || "-"}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEkskulId(ekskul.id);
                              setNewEkskulName(ekskul.namaEkskul);
                              setNewEkskulClassId(ekskul.kelasId || "");
                              setNewEkskulPembinaUser(!!ekskul.pembina_user_id);
                            }}
                            className="p-1 hover:bg-slate-200 border border-transparent text-indigo-600 rounded-lg text-xs cursor-pointer"
                            title="Ubah"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEkskul(ekskul.id)}
                            className="p-1 hover:bg-slate-200 border border-transparent text-rose-500 rounded-lg text-xs cursor-pointer"
                            title="Hapus"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab: Database Siswa */}
        {tabSekolah === "siswa" && (
          <div className="space-y-6">
            {/* Filter Kelas */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-4 max-w-sm">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Kelas:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={!selectedSchoolId}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.nama_kelas}</option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedSchoolId || !selectedClassId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah aktif via Top Bar, lalu pilih <strong>Kelas</strong> di atas untuk mengelola database siswa.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Form Input Manual & CSV */}
                <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
                  {/* Tambah Manual */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">➕ Tambah Siswa Manual</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Lengkap Siswa <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                          placeholder="Masukkan nama lengkap siswa"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">NISN</label>
                          <input
                            type="text"
                            value={newStudentNisn}
                            onChange={(e) => setNewStudentNisn(e.target.value)}
                            placeholder="Contoh: 0012345"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">No Absen</label>
                          <input
                            type="number"
                            value={newStudentAbsen}
                            onChange={(e) => setNewStudentAbsen(e.target.value)}
                            placeholder="Contoh: 1"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    {editingStudentId && (
                      <button
                        type="button"
                        onClick={() => { setEditingStudentId(""); setNewStudentName(""); setNewStudentNisn(""); setNewStudentAbsen(""); }}
                        className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Batal Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddStudent}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
                    >
                      {editingStudentId ? "Simpan Perubahan" : "Tambah Siswa"}
                    </button>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Batch Import CSV */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📤 Unggah Batch CSV</h4>
                    
                    <button
                      type="button"
                      onClick={downloadStudentTemplate}
                      className="w-full py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      📥 Unduh Template CSV
                    </button>

                    <div className="relative">
                      <label className="w-full py-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1.5">
                        <span>📤 Pilih File CSV Siswa</span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleCSVImport}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      * Pastikan file berformat CSV dengan kolom header: <strong>Nama Siswa,NISN,Nomor Absen</strong>. Data diproses secara transaksional.
                    </p>
                  </div>
                </div>

                {/* List Table Murid */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Murid Kelas</h4>
                    <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-lg text-[10px]">
                      {students.length} Siswa
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    {students.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 text-xs">
                        😴 Belum ada data murid untuk kelas ini.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                            <th className="py-2.5 px-3 w-16 text-center">Absen</th>
                            <th className="py-2.5 px-3">Nama Lengkap</th>
                            <th className="py-2.5 px-3 w-32">NISN</th>
                            <th className="py-2.5 px-3 w-16 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentsPager.pagedItems.map((st) => (
                              <tr key={st.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition text-xs font-semibold text-slate-700">
                                <td className="py-2.5 px-3 text-center text-slate-400 font-bold">{st.nomor_absen || "-"}</td>
                                <td className="py-2.5 px-3 text-slate-900">{st.nama_siswa}</td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono">{st.nisn || "-"}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingStudentId(st.id);
                                        setNewStudentName(st.nama_siswa);
                                        setNewStudentNisn(st.nisn || "");
                                        setNewStudentAbsen(st.nomor_absen ? String(st.nomor_absen) : "");
                                      }}
                                      className="text-indigo-500 hover:text-indigo-700 p-1 cursor-pointer"
                                      title="Ubah"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStudent(st.id)}
                                      className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                                      title="Hapus"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                  {studentsPager.total > 0 && (
                    <Pagination
                      page={studentsPager.page}
                      pageSize={studentsPager.pageSize}
                      total={studentsPager.total}
                      totalPages={studentsPager.totalPages}
                      onPageChange={(p) => studentsPager.reset(p)}
                      onPageSizeChange={(s) => {
                        studentsPager.setPageSize(s);
                        studentsPager.reset(1);
                      }}
                      loading={false}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab: Jadwal Pelajaran */}
        {tabSekolah === "jadwal" && (
          <div className="space-y-6">
            {!selectedSchoolId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk mengelola jadwal pelajaran.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Form Tambah Jadwal */}
                <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{editingScheduleId ? "✏️ Edit Jadwal" : "📅 Tambah Jadwal Manual"}</h4>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Kelas <span className="text-rose-500">*</span></label>
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Pilih Kelas --</option>
                          {classes.map((cls) => (
                            <option key={cls.id} value={cls.id}>{cls.nama_kelas}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Mata Pelajaran <span className="text-rose-500">*</span></label>
                        <select
                          value={selectedSubjectId}
                          onChange={(e) => setSelectedSubjectId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Pilih Mapel --</option>
                          {subjects.map((sb) => (
                            <option key={sb.id} value={sb.id}>{sb.nama_mapel}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Hari Pelaksanaan <span className="text-rose-500">*</span></label>
                        <select
                          value={schDay}
                          onChange={(e) => setSchDay(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        >
                          {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Jam Mulai</label>
                          <input
                            type="time"
                            value={schStart}
                            onChange={(e) => setSchStart(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Jam Selesai</label>
                          <input
                            type="time"
                            value={schEnd}
                            onChange={(e) => setSchEnd(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                          />
                        </div>
                      </div>
                    </div>

                    {editingScheduleId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingScheduleId("");
                          setSelectedClassId(classes.length > 0 ? classes[0].id : "");
                          setSelectedSubjectId(subjects.length > 0 ? subjects[0].id : "");
                          setSchDay("Senin");
                          setSchStart("07:30");
                          setSchEnd("09:00");
                        }}
                        className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                      >
                        Batal Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddSchedule}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
                    >
                      {editingScheduleId ? "Simpan Perubahan" : "Simpan Jadwal"}
                    </button>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Batch Import Jadwal CSV */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">📤 Unggah Batch CSV Jadwal</h4>
                    
                    <button
                      type="button"
                      onClick={downloadScheduleTemplate}
                      className="w-full py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                    >
                      📥 Unduh Template CSV Jadwal
                    </button>

                    <div className="relative">
                      <label className="w-full py-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1.5">
                        <span>📤 Pilih File CSV Jadwal</span>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleScheduleCSVImport}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      * Pastikan berkas CSV menggunakan kolom header: <strong>Hari,Jam Mulai,Jam Selesai,Nama Kelas,Nama Mapel</strong>.
                    </p>
                  </div>
                </div>

                {/* List Jadwal Mengajar */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Jadwal Mengajar Anda</h4>
                  
                  {schedules.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-10 text-center text-slate-400 text-xs">
                      📭 Belum ada jadwal mengajar terdaftar di sekolah ini.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((day) => {
                        const daySchedules = schedules.filter(s => s.hari === day);
                        if (daySchedules.length === 0) return null;
                        
                        return (
                          <div key={day} className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
                            <h5 className="text-xs font-bold text-indigo-700 border-b border-slate-100 pb-1.5">{day}</h5>
                            <div className="space-y-2">
                              {daySchedules
                                .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
                                .map((sch) => (
                                  <div key={sch.id} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/50 border border-slate-100 px-3.5 py-2.5 rounded-xl transition">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                      <span className="font-mono text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-lg text-[10px] font-black">
                                        ⏱️ {sch.jam_mulai} - {sch.jam_selesai}
                                      </span>
                                      <span className="font-bold text-slate-800">
                                        Kelas {sch.nama_kelas}
                                      </span>
                                      <span className="text-slate-400 font-bold">•</span>
                                      <span className="text-slate-500 font-semibold">
                                        {sch.nama_mapel}
                                      </span>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingScheduleId(sch.id);
                                          setSelectedClassId(sch.class_id);
                                          setSelectedSubjectId(sch.subject_id);
                                          setSchDay(sch.hari);
                                          setSchStart(sch.jam_mulai);
                                          setSchEnd(sch.jam_selesai);
                                        }}
                                        className="p-1 hover:bg-slate-200 border border-transparent text-indigo-600 rounded-lg text-xs cursor-pointer"
                                        title="Ubah Jadwal"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSchedule(sch.id)}
                                        className="p-1 hover:bg-slate-200 border border-transparent text-rose-500 rounded-lg text-xs cursor-pointer"
                                        title="Hapus Jadwal"
                                      >
                                        🗑️
                                      </button>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab: Tahun Ajaran & Semester */}
        {tabSekolah === "tahun-ajaran" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-700">📅 Tahun Ajaran & Semester</h4>
                <p className="text-[10px] text-slate-500 mt-1">Pilih periode untuk filter data Anda</p>
              </div>
              <button onClick={() => setShowTahunAjaranModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition">
                + Tambah TA
              </button>
            </div>

            {tahunAjaranList.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                <span className="text-4xl block mb-3">📅</span>
                <p className="text-xs text-amber-700 font-medium">Belum ada tahun ajaran.</p>
                <p className="text-[10px] text-amber-600 mt-1">Buat tahun ajaran pertama Anda</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tahunAjaranList.map((ta: any) => (
                  <div key={ta.id}
                    className={`border rounded-2xl p-5 transition ${
                      ta.is_active ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-800">{ta.nama}</span>
                          {ta.is_active && (
                            <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">AKTIF</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(ta.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} — {new Date(ta.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      </div>
                      {!ta.is_active && (
                        <div className="flex gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); activateTahunAjaran(ta.id, localStorage.getItem('semester') || 'ganjil'); }}
                            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600 transition">
                            Aktifkan
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteModalTa(ta); setDeletePassword(''); setDeleteTaError(''); }}
                            className="px-3 py-1.5 bg-white border border-red-200 rounded-lg text-[10px] font-bold text-red-500 hover:bg-red-50 hover:border-red-300 transition">
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Semester Selector */}
                    {ta.is_active && (
                      <div className="border-t border-indigo-200 pt-3 mt-2">
                        <p className="text-[10px] font-bold text-indigo-700 mb-2">📌 Pilih Periode Data:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => {
                              localStorage.setItem('tahunAjaranId', ta.id);
                              localStorage.setItem('tahunAjaranNama', ta.nama);
                              localStorage.setItem('semester', 'ganjil');
                              localStorage.setItem('semesterLabel', `${ta.nama} - Semester 1`);
                              activateTahunAjaran(ta.id, 'ganjil');
                            }}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition ${
                              localStorage.getItem('semester') === 'ganjil' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            }`}
                          >
                            📚 Semester 1<br/><span className="text-[9px] opacity-75">Jul - Des</span>
                          </button>
                          <button
                            onClick={() => {
                              localStorage.setItem('tahunAjaranId', ta.id);
                              localStorage.setItem('tahunAjaranNama', ta.nama);
                              localStorage.setItem('semester', 'genap');
                              localStorage.setItem('semesterLabel', `${ta.nama} - Semester 2`);
                              activateTahunAjaran(ta.id, 'genap');
                            }}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition ${
                              localStorage.getItem('semester') === 'genap' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            }`}
                          >
                            📚 Semester 2<br/><span className="text-[9px] opacity-75">Jan - Jun</span>
                          </button>
                          <button
                            onClick={() => {
                              localStorage.setItem('tahunAjaranId', ta.id);
                              localStorage.setItem('tahunAjaranNama', ta.nama);
                              localStorage.setItem('semester', 'full');
                              localStorage.setItem('semesterLabel', `${ta.nama} - Full Year`);
                              activateTahunAjaran(ta.id, 'full');
                            }}
                            className={`px-3 py-2 rounded-xl text-[10px] font-bold transition ${
                              localStorage.getItem('semester') === 'full' || (!localStorage.getItem('semester') && ta.is_active) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            }`}
                          >
                            📅 Full Year<br/><span className="text-[9px] opacity-75">Semua data</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Current Selection */}
                <div className="bg-slate-100 border border-slate-200 rounded-xl p-4">
                  <p className="text-[10px] text-slate-500 font-bold">📊 Filter aktif:</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">
                    {localStorage.getItem('semesterLabel') || localStorage.getItem('tahunAjaranNama') || 'Pilih semester'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sub-Tab: Presensi Harian */}
        {tabSekolah === "presensi" && (
          <div className="space-y-6">
            {/* Filter Tanggal & Jadwal */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">1. Tanggal Presensi:</label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">2. Pilih Jadwal Mengajar:</label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => {
                    const schedId = e.target.value;
                    setSelectedScheduleId(schedId);
                    
                    // Auto select the class of this schedule so students fetch correctly
                    const schedObj = schedules.find(s => s.id === schedId);
                    if (schedObj) {
                      setSelectedClassId(schedObj.class_id);
                    }
                  }}
                  disabled={!selectedSchoolId}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">-- Pilih Sesi Mengajar --</option>
                  {schedules.map((sch) => (
                    <option key={sch.id} value={sch.id}>
                      [{sch.hari}] {sch.jam_mulai}-{sch.jam_selesai} | Kelas {sch.nama_kelas} - {sch.nama_mapel}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {!selectedSchoolId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk melakukan presensi.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Bagian A: Kehadiran Guru */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">👩‍🏫 Presensi Kehadiran Guru (Hari Ini)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Status Kehadiran Guru</label>
                      <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5 w-full">
                        {["Hadir", "Sakit", "Izin", "Alpa"].map((st) => {
                          const isSelected = teacherStatus === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setTeacherStatus(st)}
                              className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                isSelected ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {st}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Catatan Kegiatan / Jurnal Singkat</label>
                      <input
                        type="text"
                        value={teacherNotes}
                        onChange={(e) => setTeacherNotes(e.target.value)}
                        placeholder="Contoh: Mengajar bab trigonometri, materi tersampaikan dengan baik."
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Bagian B: Kehadiran Siswa */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">👥 Presensi Siswa Kelas</h4>
                    {selectedScheduleId && (
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                        Total {students.length} Murid
                      </span>
                    )}
                  </div>

                  {!selectedScheduleId ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                      👈 Silakan pilih <strong>Jadwal Pelajaran</strong> terlebih dahulu untuk menginput kehadiran murid.
                    </div>
                  ) : students.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-xs font-semibold">
                      ⚠️ Kelas pada jadwal ini belum memiliki data murid. Silakan tambahkan murid terlebih dahulu di tab <strong>Siswa</strong>.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Grid/Table Presensi */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                              <th className="py-2 px-3 w-12 text-center">Absen</th>
                              <th className="py-2 px-3">Nama Murid</th>
                              <th className="py-2 px-3 w-56 text-center">Status Kehadiran</th>
                              <th className="py-2 px-3 w-64">Catatan Khusus (Opsional)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students
                              .sort((a, b) => (a.nomor_absen || 999) - (b.nomor_absen || 999))
                              .map((st) => {
                                const record = studentAttRecords[st.id] || { status: "Hadir", catatan: "" };
                                return (
                                  <tr key={st.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition text-xs font-semibold text-slate-700">
                                    <td className="py-3 px-3 text-center text-slate-400 font-bold">{st.nomor_absen || "-"}</td>
                                    <td className="py-3 px-3 text-slate-900">{st.nama_siswa}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5 w-full max-w-[220px] mx-auto">
                                        {[
                                          { val: "Hadir", key: "H" },
                                          { val: "Sakit", key: "S" },
                                          { val: "Izin", key: "I" },
                                          { val: "Alpa", key: "A" }
                                        ].map(item => {
                                          const isAct = record.status === item.val;
                                          return (
                                            <button
                                              key={item.val}
                                              type="button"
                                              onClick={() => {
                                                setStudentAttRecords(prev => ({
                                                  ...prev,
                                                  [st.id]: { ...record, status: item.val }
                                                }));
                                              }}
                                              className={`flex-1 py-1 rounded-md text-[9px] font-black transition cursor-pointer ${
                                                isAct
                                                  ? item.val === "Hadir" ? "bg-emerald-600 text-white shadow-sm"
                                                    : item.val === "Sakit" ? "bg-amber-500 text-white shadow-sm"
                                                    : item.val === "Izin" ? "bg-blue-500 text-white shadow-sm"
                                                    : "bg-rose-600 text-white shadow-sm"
                                                  : "text-slate-500 hover:text-slate-800"
                                              }`}
                                            >
                                              {item.key}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3">
                                      <input
                                        type="text"
                                        value={record.catatan}
                                        onChange={(e) => {
                                          setStudentAttRecords(prev => ({
                                            ...prev,
                                            [st.id]: { ...record, catatan: e.target.value }
                                          }));
                                        }}
                                        placeholder="Tulis catatan (misal: Terlambat, Dispensasi)"
                                        className="w-full px-2.5 py-1 border border-slate-200 rounded-lg text-[10px] focus:border-indigo-300 focus:outline-none bg-white font-medium text-slate-700"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>

                      {/* Tombol Simpan */}
                      <div className="flex justify-end pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleSaveAttendance}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100 cursor-pointer"
                        >
                          💾 Simpan Seluruh Presensi
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderKeuanganModule = () => {
    let totalIn = 0;
    let totalOut = 0;
    financeLedger.forEach(t => {
      if (t.tipe === "pemasukan") totalIn += Number(t.jumlah);
      else totalOut += Number(t.jumlah);
    });
    const netBalance = totalIn - totalOut;

    // Savings sum
    let totalSaved = 0;
    let totalTargetSavings = 0;
    financeSavings.forEach(s => {
      totalSaved += Number(s.saved || 0);
      totalTargetSavings += Number(s.target || 0);
    });

    // Investments sum
    let totalBeliInv = 0;
    let totalSekarangInv = 0;
    financeInvestments.forEach(i => {
      totalBeliInv += Number(i.beli || 0);
      totalSekarangInv += Number(i.sekarang || 0);
    });
    const totalGainLoss = totalSekarangInv - totalBeliInv;
    const gainLossPercent = totalBeliInv > 0 ? (totalGainLoss / totalBeliInv) * 100 : 0;

    const netWorth = netBalance + totalSaved + totalSekarangInv;

    const formatter = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    });

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Dompet & Keuangan Guru</h3>
            <p className="text-xs text-slate-500 mt-1">Kelola arus kas harian, perencanaan tabungan masa depan, dan aset investasi Anda secara mandiri.</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-slate-400 font-bold block uppercase">Kekayaan Bersih (Net Worth)</span>
            <span className="text-lg font-black text-indigo-650 block mt-0.5">{formatter.format(netWorth)}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 gap-6 text-xs font-bold no-print">
          <button
            onClick={() => setActiveFinanceTab("arus_kas")}
            className={`pb-3 transition relative cursor-pointer ${
              activeFinanceTab === "arus_kas" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            📈 Arus Kas
            {activeFinanceTab === "arus_kas" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveFinanceTab("tabungan")}
            className={`pb-3 transition relative cursor-pointer ${
              activeFinanceTab === "tabungan" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            🎯 Tabungan & Impian
            {activeFinanceTab === "tabungan" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveFinanceTab("investasi")}
            className={`pb-3 transition relative cursor-pointer ${
              activeFinanceTab === "investasi" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            💎 Portofolio Investasi
            {activeFinanceTab === "investasi" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveFinanceTab("analisis")}
            className={`pb-3 transition relative cursor-pointer ${
              activeFinanceTab === "analisis" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            📊 Analisis Keuangan
            {activeFinanceTab === "analisis" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />}
          </button>
          <button
            onClick={() => setActiveFinanceTab("chat")}
            className={`pb-3 transition relative cursor-pointer ${
              activeFinanceTab === "chat" ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            💬 Catat via Chat
            {activeFinanceTab === "chat" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500 rounded-full" />}
          </button>
        </div>

        {/* Tab Chat: Catat via Chat */}
        {activeFinanceTab === "chat" && (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col" style={{ height: '520px' }}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3" id="finance-chat-messages">
                {financeChatMessages.length === 0 && !financeChatLoading && (
                  <div className="text-center text-slate-400 text-xs mt-10">
                    Mulai dengan mengetik transaksi Anda, misal:<br/>
                    <span className="italic">"200rb biaya makan"</span> atau <span className="italic">"gaji ngajar les 500rb"</span>
                  </div>
                )}
                {financeChatMessages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {msg.role === 'user' ? (
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      ) : (
                        <div className="space-y-2">
                          {msg.type === 'confirm' && msg.data ? (
                            <>
                              <p className="font-medium">
                                Oke, saya catat: <span className={msg.data.tipe === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}>
                                  {msg.data.tipe === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
                                </span> {msg.data.keterangan} sebesar <span className="font-bold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(msg.data.jumlah)}</span> pada {new Date(msg.data.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
                              </p>
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => onFinanceSaveDraft(msg.id, msg.data!)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                                >
                                  Simpan
                                </button>
                                <button
                                  onClick={() => onFinanceStartEdit(msg.id, msg.data!)}
                                  className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                >
                                  Edit
                                </button>
                              </div>
                              {financeChatEditId === msg.id && financeChatEditDraft && (
                                <div className="mt-3 bg-white border border-slate-200 rounded-xl p-3 space-y-2">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Jumlah (Rp)</label>
                                      <input type="number" value={financeChatEditDraft.jumlah} onChange={(e) => setFinanceChatEditDraft({...financeChatEditDraft, jumlah: e.target.value})} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[11px] bg-white" />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Tipe</label>
                                      <select value={financeChatEditDraft.tipe} onChange={(e) => setFinanceChatEditDraft({...financeChatEditDraft, tipe: e.target.value})} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[11px] bg-white">
                                        <option value="pemasukan">Pemasukan</option>
                                        <option value="pengeluaran">Pengeluaran</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Kategori</label>
                                      <select value={financeChatEditDraft.kategori} onChange={(e) => setFinanceChatEditDraft({...financeChatEditDraft, kategori: e.target.value})} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[11px] bg-white">
                                        <option value="Gaji">Gaji Pokok</option>
                                        <option value="Honor">Honor Mengajar</option>
                                        <option value="ATK">ATK & Cetak</option>
                                        <option value="Transport">Transportasi</option>
                                        <option value="Konsumsi">Konsumsi</option>
                                        <option value="Sampingan">Sampingan</option>
                                        <option value="Lainnya">Lainnya</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Tanggal</label>
                                      <input type="date" value={financeChatEditDraft.tanggal} onChange={(e) => setFinanceChatEditDraft({...financeChatEditDraft, tanggal: e.target.value})} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[11px] bg-white" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Keterangan</label>
                                    <input type="text" value={financeChatEditDraft.keterangan} onChange={(e) => setFinanceChatEditDraft({...financeChatEditDraft, keterangan: e.target.value})} className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[11px] bg-white" />
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => onFinanceConfirmEdit(msg.id)} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition cursor-pointer">Simpan Perubahan</button>
                                    <button onClick={onFinanceCancelEdit} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer">Batal</button>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : msg.type === 'saved' ? (
                            <>
                              <p className="text-emerald-700 font-medium">Tercatat! {msg.text}</p>
                            </>
                          ) : (
                            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {financeChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={financeChatEndRef} />
              </div>
              <div className="border-t border-slate-200 p-3 bg-slate-50 rounded-b-3xl">
                <form onSubmit={(e) => { e.preventDefault(); onFinanceSendChat(); }} className="flex gap-2">
                  <input
                    type="text"
                    value={financeChatInput}
                    onChange={(e) => setFinanceChatInput(e.target.value)}
                    placeholder="Ketik transaksi, misal: 200rb biaya makan"
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-white focus:border-amber-300 outline-none text-slate-800"
                    disabled={financeChatLoading}
                  />
                  <button
                    type="submit"
                    disabled={financeChatLoading || !financeChatInput.trim()}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Kirim
                  </button>
                </form>
                <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                  AI akan merangkum teks bebas Anda ke dalam data transaksi terstruktur.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeFinanceTab === "arus_kas" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-3xl p-5 shadow-sm shadow-emerald-50/50">
                <span className="text-xs font-semibold block text-emerald-600">Total Pemasukan</span>
                <span className="text-xl font-black block mt-1">{formatter.format(totalIn)}</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-3xl p-5 shadow-sm shadow-rose-50/50">
                <span className="text-xs font-semibold block text-rose-600">Total Pengeluaran</span>
                <span className="text-xl font-black block mt-1">{formatter.format(totalOut)}</span>
              </div>
              <div className={`border rounded-3xl p-5 shadow-sm ${
                netBalance >= 0 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <span className="text-xs font-semibold block text-indigo-600">Saldo Arus Kas</span>
                <span className="text-xl font-black block mt-1">{formatter.format(netBalance)}</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 no-print">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4">Tambah Transaksi Baru</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Keterangan</label>
                  <input 
                    type="text" 
                    value={finKet}
                    onChange={(e) => setFinKet(e.target.value)}
                    placeholder="Gaji PNS, Jual Buku..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none bg-white font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Jumlah (Rp)</label>
                  <input 
                    type="number" 
                    value={finJumlah}
                    onChange={(e) => setFinJumlah(e.target.value)}
                    placeholder="100000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none bg-white font-medium text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipe</label>
                  <select 
                    value={finTipe}
                    onChange={(e) => setFinTipe(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none bg-white font-bold text-slate-800"
                  >
                    <option value="pemasukan">📈 Pemasukan</option>
                    <option value="pengeluaran">📉 Pengeluaran</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Kategori</label>
                  <select 
                    value={finKat}
                    onChange={(e) => setFinKat(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none bg-white font-medium text-slate-800"
                  >
                    <option value="Gaji">Gaji Pokok</option>
                    <option value="Honor">Honor Mengajar</option>
                    <option value="ATK">ATK &amp; Cetak</option>
                    <option value="Transport">Transportasi</option>
                    <option value="Konsumsi">Konsumsi</option>
                    <option value="Sampingan">Sampingan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
                <div>
                  <button
                    onClick={addFinanceTransaction}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer text-center"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">Tanggal</th>
                      <th className="px-5 py-3.5">Keterangan</th>
                      <th className="px-5 py-3.5">Kategori</th>
                      <th className="px-5 py-3.5 text-right">Jumlah</th>
                      <th className="px-5 py-3.5 text-center no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {financeLedger.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-8 text-center text-slate-400 italic">Belum ada transaksi keuangan yang tercatat.</td>
                      </tr>
                    ) : (
                      financeLedger.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 whitespace-nowrap">{tx.tanggal}</td>
                          <td className="px-5 py-3 font-semibold text-slate-800">{tx.keterangan}</td>
                          <td className="px-5 py-3">
                            <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                              {tx.kategori}
                            </span>
                          </td>
                          <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${
                            tx.tipe === "pemasukan" ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {tx.tipe === "pemasukan" ? "+" : "-"} {formatter.format(tx.jumlah)}
                          </td>
                          <td className="px-5 py-3 text-center no-print">
                            <button
                              onClick={() => deleteFinanceTransaction(tx.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-xs cursor-pointer"
                              title="Hapus"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tabungan & Impian */}
        {activeFinanceTab === "tabungan" && (
          <div className="space-y-6">
            <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold block text-indigo-700">Total Dana Ditabung</span>
                <span className="text-2xl font-black block mt-1 text-indigo-900">{formatter.format(totalSaved)}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold block text-slate-400">Akumulasi Target Impian</span>
                <span className="text-lg font-bold block mt-1 text-slate-600">{formatter.format(totalTargetSavings)}</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 no-print">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 font-sans">Tambah Impian Baru</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Target Impian / Rencana</label>
                  <input 
                    type="text" 
                    value={savGoal}
                    onChange={(e) => setSavGoal(e.target.value)}
                    placeholder="Beli Laptop Ajar, Umroh..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Target Biaya (Rp)</label>
                  <input 
                    type="number" 
                    value={savTarget}
                    onChange={(e) => setSavTarget(e.target.value)}
                    placeholder="10000000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Saldo Saat Ini (Rp)</label>
                  <input 
                    type="number" 
                    value={savSaved}
                    onChange={(e) => setSavSaved(e.target.value)}
                    placeholder="1500000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Target Tanggal</label>
                  <input 
                    type="date" 
                    value={savDate}
                    onChange={(e) => setSavDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <button
                    onClick={addSavingsGoal}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer text-center"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {financeSavings.length === 0 ? (
                <div className="col-span-2 text-center py-10 bg-white border border-slate-100 rounded-3xl text-slate-400 italic text-xs font-medium">Belum ada target impian/tabungan yang ditambahkan.</div>
              ) : (
                financeSavings.map((s) => {
                  const progress = s.target > 0 ? Math.min(100, (s.saved / s.target) * 100) : 0;
                  return (
                    <div key={s.id} className="bg-white border border-slate-200 rounded-3xl p-5 space-y-4 relative overflow-hidden shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">{s.goal}</h5>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Target Tanggal: {s.date}</p>
                        </div>
                        <button
                          onClick={() => deleteSavingsGoal(s.id)}
                          className="text-slate-400 hover:text-rose-600 transition cursor-pointer text-xs p-1"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-600">
                          <span>{formatter.format(s.saved)} terkumpul</span>
                          <span className="text-indigo-600">{progress.toFixed(0)}%</span>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-650 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>

                        <div className="text-[9px] text-slate-400 text-right font-semibold">
                          Target: {formatter.format(s.target)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Portofolio Investasi */}
        {activeFinanceTab === "investasi" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 shadow-sm">
                <span className="text-xs font-semibold block text-indigo-600">Total Nilai Investasi</span>
                <span className="text-xl font-black block mt-1 text-indigo-900">{formatter.format(totalSekarangInv)}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 shadow-sm">
                <span className="text-xs font-semibold block text-slate-500">Modal Pokok Investasi</span>
                <span className="text-xl font-bold block mt-1 text-slate-700">{formatter.format(totalBeliInv)}</span>
              </div>
              <div className={`border rounded-3xl p-5 shadow-sm ${
                totalGainLoss >= 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <span className="text-xs font-semibold block text-slate-500">Total Profit / Loss</span>
                <span className="text-xl font-black block mt-1">
                  {totalGainLoss >= 0 ? "+" : ""} {formatter.format(totalGainLoss)} ({totalGainLoss >= 0 ? "+" : ""}{gainLossPercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 no-print">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-4 font-sans">Tambah Portofolio Investasi</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Aset / Produk</label>
                  <input 
                    type="text" 
                    value={invNama}
                    onChange={(e) => setInvNama(e.target.value)}
                    placeholder="Contoh: Logam Mulia Antam..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Harga Beli / Pokok (Rp)</label>
                  <input 
                    type="number" 
                    value={invBeli}
                    onChange={(e) => setInvBeli(e.target.value)}
                    placeholder="Contoh: 2000000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nilai Sekarang (Rp)</label>
                  <input 
                    type="number" 
                    value={invSekarang}
                    onChange={(e) => setInvSekarang(e.target.value)}
                    placeholder="Contoh: 2350000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Kategori Aset</label>
                  <select 
                    value={invKategori}
                    onChange={(e) => setInvKategori(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-bold"
                  >
                    <option value="Reksadana">📈 Reksadana</option>
                    <option value="Emas">💛 Emas Murni</option>
                    <option value="Saham">📊 Saham / Stock</option>
                    <option value="Deposito">🏦 Deposito Bank</option>
                    <option value="Obligasi">📜 SBSN / SBR / Obligasi</option>
                    <option value="Lainnya">📦 Lainnya</option>
                  </select>
                </div>
                <div>
                  <button
                    onClick={addInvestment}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer text-center"
                  >
                    Tambah Aset
                  </button>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">Nama Investasi</th>
                      <th className="px-5 py-3.5">Kategori</th>
                      <th className="px-5 py-3.5 text-right">Modal Awal</th>
                      <th className="px-5 py-3.5 text-right">Nilai Saat Ini</th>
                      <th className="px-5 py-3.5 text-right">Gain / Loss</th>
                      <th className="px-5 py-3.5 text-center no-print">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {financeInvestments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic">Belum ada portofolio investasi yang tercatat.</td>
                      </tr>
                    ) : (
                      financeInvestments.map((inv) => {
                        const gl = inv.sekarang - inv.beli;
                        const pct = inv.beli > 0 ? (gl / inv.beli) * 100 : 0;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="px-5 py-3 font-bold text-slate-800">{inv.nama}</td>
                            <td className="px-5 py-3">
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                {inv.kategori}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">{formatter.format(inv.beli)}</td>
                            <td className="px-5 py-3 text-right font-semibold text-slate-800">{formatter.format(inv.sekarang)}</td>
                            <td className={`px-5 py-3 text-right font-black ${
                              gl >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {gl >= 0 ? "+" : ""} {formatter.format(gl)} ({gl >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                            </td>
                            <td className="px-5 py-3 text-center no-print">
                              <button
                                onClick={() => deleteInvestment(inv.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-xs cursor-pointer"
                                title="Hapus"
                              >
                                🗑️
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Analisis & Keuangan Sehat */}
        {activeFinanceTab === "analisis" && (
          <div className="space-y-6 bg-slate-50 border border-slate-200/50 rounded-3xl p-6">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200 pb-2">Analisis Kesehatan Keuangan GuruPRO</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Financial Assets Distribution */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <h5 className="text-xs font-black text-slate-700 uppercase">Distribusi Aset Keuangan</h5>
                <div className="space-y-3 font-semibold text-slate-600 text-xs">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Kas Harian</span>
                      <span>{netWorth > 0 ? ((netBalance / netWorth) * 100).toFixed(0) : "0"}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${netWorth > 0 ? Math.max(0, (netBalance / netWorth) * 100) : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Tabungan / Impian</span>
                      <span>{netWorth > 0 ? ((totalSaved / netWorth) * 100).toFixed(0) : "0"}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${netWorth > 0 ? (totalSaved / netWorth) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span>Investasi Produk</span>
                      <span>{netWorth > 0 ? ((totalSekarangInv / netWorth) * 100).toFixed(0) : "0"}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: `${netWorth > 0 ? (totalSekarangInv / netWorth) * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Health Evaluation & Recommendation */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                <h5 className="text-xs font-black text-slate-700 uppercase">Rekomendasi Keuangan Sehat</h5>
                
                <div className="space-y-3 text-xs leading-relaxed text-slate-600 font-medium">
                  {/* Evaluation 1: Emergency Fund */}
                  <div className="border-l-4 border-indigo-400 pl-3">
                    <p className="font-bold text-slate-800 text-[11px]">Dana Darurat Guru</p>
                    {totalSaved >= totalOut * 3 ? (
                      <p className="text-[11px] text-emerald-600 font-semibold">✓ Sangat Baik! Tabungan Anda saat ini ({formatter.format(totalSaved)}) mencukupi batas aman dana darurat guru (min. 3x pengeluaran bulanan).</p>
                    ) : (
                      <p className="text-[11px] text-amber-600 font-semibold">⚠ Rekomendasi: Usahakan menambah tabungan Anda hingga minimal mencapai {formatter.format(totalOut * 3)} (3x pengeluaran) untuk dana darurat penunjang kegiatan guru.</p>
                    )}
                  </div>

                  {/* Evaluation 2: Investment Ratio */}
                  <div className="border-l-4 border-amber-400 pl-3">
                    <p className="font-bold text-slate-800 text-[11px]">Rasio Investasi</p>
                    {totalSekarangInv >= netWorth * 0.15 ? (
                      <p className="text-[11px] text-emerald-600 font-semibold">✓ Hebat! Portofolio investasi Anda telah melebihi 15% dari total aset bersih. Langkah keuangan masa depan yang cerdas!</p>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-medium">Tips: Mulai sisihkan minimal 10-15% dari pendapatan bulanan untuk diinvestasikan secara bertahap pada emas murni atau reksadana aman.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

const renderJurnalModule = () => {
    return (
      <div className="space-y-6">
        {/* Header Modul */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Dynamic Teacher Journal System</h3>
            <p className="text-xs text-slate-500 mt-1">
              Sistem Dokumentasi, Evidensi Belajar, Supervisi Digital &amp; AI Jurnal Copilot.
            </p>
          </div>
          
          {/* Sub-Tab Navigator */}
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl gap-0.5 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setJournalSubTab("tulis")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                journalSubTab === "tulis" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>📓</span>
              <span>Jurnal Saya</span>
            </button>
            <button
              onClick={() => setJournalSubTab("supervisi")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                journalSubTab === "supervisi" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🛡️</span>
              <span>Supervisi Jurnal</span>
            </button>
            <button
              onClick={() => setJournalSubTab("format")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                journalSubTab === "format" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>⚙️</span>
              <span>Format Jurnal</span>
            </button>
          </div>
        </div>

        {/* 1. Sub-Tab: Format Jurnal (Form Builder) */}
        {journalSubTab === "format" && (
          <div className="space-y-6 animate-fadeIn">
            {!selectedSchoolId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk merancang format kustom jurnal.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Builder */}
                <div className="lg:col-span-1 bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-5">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">➕ Rancang Kolom Form Baru</h4>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Format Jurnal</label>
                    <input
                      type="text"
                      value={schemaNama}
                      onChange={(e) => setSchemaNama(e.target.value)}
                      placeholder="Contoh: Format Jurnal PAUD, Format Jurnal SMA"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    />
                  </div>

                  <hr className="border-slate-200" />

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Label Kolom (Input Label)</label>
                      <input
                        type="text"
                        value={fieldLabel}
                        onChange={(e) => setFieldLabel(e.target.value)}
                        placeholder="Contoh: Metode Pembelajaran, Hambatan Siswa"
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipe Input</label>
                      <select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                      >
                        <option value="text">Teks Pendek (Text)</option>
                        <option value="textarea">Paragraf Panjang (Textarea)</option>
                        <option value="select">Pilihan Opsi (Dropdown Select)</option>
                      </select>
                    </div>

                    {fieldType === "select" && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Opsi Dropdown (Pisahkan dengan koma)</label>
                        <input
                          type="text"
                          value={fieldOpts}
                          onChange={(e) => setFieldOpts(e.target.value)}
                          placeholder="Contoh: Diskusi, Ceramah, Praktek"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="fieldReq"
                        checked={fieldReq}
                        onChange={(e) => setFieldReq(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="fieldReq" className="text-xs font-semibold text-slate-600 cursor-pointer">Wajib diisi (Required)</label>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!fieldLabel) return;
                        const name = fieldLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
                        const newField = {
                          name,
                          label: fieldLabel,
                          type: fieldType,
                          options: fieldType === "select" ? fieldOpts.split(",").map(o => o.trim()) : [],
                          required: fieldReq
                        };
                        setSchemaFields(prev => [...prev, newField]);
                        setFieldLabel("");
                        setFieldOpts("");
                        setFieldReq(false);
                      }}
                      className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      ➕ Tambahkan Kolom
                    </button>
                  </div>
                </div>

                {/* Preview Skema & Simpan */}
                <div className="lg:col-span-2 space-y-6 bg-white border border-slate-200/80 rounded-3xl p-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Preview Format Form Skema</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Daftar kolom kustom yang akan ditambahkan ke format ini.</p>
                  </div>

                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {schemaFields.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-10">Belum ada kolom kustom ditambahkan.</p>
                    ) : (
                      schemaFields.map((f, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-slate-50 hover:bg-slate-100/70 border border-slate-100 px-4 py-2.5 rounded-xl transition text-xs font-semibold">
                          <div>
                            <span className="text-slate-800">{f.label}</span>
                            <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md ml-2 uppercase font-black">
                              {f.type}
                            </span>
                            {f.required && (
                              <span className="text-[10px] text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md ml-1 font-bold">
                                Wajib
                              </span>
                            )}
                            {f.type === "select" && (
                              <p className="text-[9px] text-slate-400 mt-1">Opsi: {f.options.join(", ")}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSchemaFields(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 text-xs cursor-pointer p-1"
                          >
                            🗑️
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {schemaFields.length > 0 && (
                    <div className="flex justify-end pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleSaveSchema}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
                      >
                        💾 Simpan Seluruh Format Skema
                      </button>
                    </div>
                  )}

                  <hr className="border-slate-100 my-6" />

                  {/* Skema Tersimpan */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Format Jurnal Aktif Sekolah</h4>
                    {journalSchemas.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-4">Belum ada format kustom terdaftar untuk sekolah ini.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {journalSchemas.map(sch => (
                          <div key={sch.id} className="bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 rounded-2xl p-4 flex justify-between items-start transition shadow-sm">
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold text-slate-800">{sch.nama_skema}</h5>
                              <p className="text-[9px] text-indigo-600 font-semibold mt-1">Total {sch.fields?.length || 0} kolom kustom</p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {sch.fields?.map((f: any, i: number) => (
                                  <span key={i} className="text-[8px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                    {f.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchema(sch.id)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer shrink-0 ml-2"
                              title="Hapus Format"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Sub-Tab: Jurnal Saya */}
        {journalSubTab === "tulis" && (
          <div className="space-y-6 animate-fadeIn">
            {!selectedSchoolId ? (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
                ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk menulis atau memantau jurnal mengajar.
              </div>
            ) : isWritingJournal ? (
              /* FORM TULIS JURNAL */
              <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{activeJournal ? "✏️ Edit Jurnal Mengajar" : "➕ Tulis Jurnal Mengajar Baru"}</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Gunakan Sesi Jadwal untuk pengisian sebagian besar data ajar secara otomatis.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-white border border-slate-100 p-4 rounded-2xl shadow-inner">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Pilih Sesi Jadwal Ajar</label>
                    <select
                      value={selectedScheduleId}
                      onChange={(e) => {
                        const schedId = e.target.value;
                        setSelectedScheduleId(schedId);
                        
                        const schedObj = schedules.find(s => s.id === schedId);
                        if (schedObj) {
                          setSelectedClassId(schedObj.class_id);
                          setSelectedSubjectId(schedObj.subject_id);
                        } else {
                          setSelectedClassId("");
                          setSelectedSubjectId("");
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-slate-50 font-semibold text-indigo-700"
                    >
                      <option value="">-- Manual (Tanpa Jadwal) --</option>
                      {schedules.map((sch) => (
                        <option key={sch.id} value={sch.id}>
                          [{sch.hari}] {sch.jam_mulai}-{sch.jam_selesai} | Kelas {sch.nama_kelas} - {sch.nama_mapel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Mata Pelajaran <span className="text-rose-500">*</span></label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      disabled={!!selectedScheduleId}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">-- Pilih Mapel --</option>
                      {subjects.map((sb) => (
                        <option key={sb.id} value={sb.id}>{sb.nama_mapel}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Kelas <span className="text-rose-500">*</span></label>
                    <select
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      disabled={!!selectedScheduleId}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>{cls.nama_kelas}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Kurikulum</label>
                    <select
                      value={journalKurikulum}
                      onChange={(e) => setJournalKurikulum(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                    >
                      <option value="merdeka">Kurikulum Merdeka</option>
                      <option value="k13">K13 (Kurikulum 2013)</option>
                      <option value="kbc">KBC (Madrasah)</option>
                      <option value="hybrid">Hybrid (Gabungan)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Kolom Kiri: Form Utama */}
                  <div className="md:col-span-2 space-y-4 bg-white border border-slate-200/80 p-6 rounded-3xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Tanggal</label>
                        <input
                          type="date"
                          value={jurnalDate}
                          onChange={(e) => setJurnalDate(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Materi Utama / Pembahasan <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          value={journalMateri}
                          onChange={(e) => setJournalMateri(e.target.value)}
                          placeholder="Contoh: Operasi Penjumlahan Aljabar"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Tujuan Pembelajaran <span className="text-rose-500">*</span></label>
                      <VoiceTextInput
                        value={journalTujuan}
                        onChange={setJournalTujuan}
                        placeholder="Contoh: Siswa mampu menyederhanakan bentuk pecahan aljabar secara mandiri."
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Aktivitas Pembelajaran <span className="text-rose-500">*</span></label>
                      <VoiceTextInput
                        value={journalAktivitas}
                        onChange={setJournalAktivitas}
                        placeholder="Uraikan rangkaian kegiatan ajar guru dan siswa..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Media / Sumber Belajar</label>
                        <input
                          type="text"
                          value={journalMedia}
                          onChange={(e) => setJournalMedia(e.target.value)}
                          placeholder="Contoh: Proyektor, Google Slides, Buku Paket K13"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Jenis Asesmen / Penilaian</label>
                        <input
                          type="text"
                          value={journalAsesmen}
                          onChange={(e) => setJournalAsesmen(e.target.value)}
                          placeholder="Contoh: Tes Lisan Tanya Jawab, Lembar Kerja Kelompok"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        />
                      </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* AI Copilot & Reflection */}
                    <div className="space-y-4 bg-slate-50 p-5 border border-slate-200/50 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">✨ AI Jurnal Copilot (Gemini)</span>
                        <button
                          type="button"
                          onClick={handleGenerateJournalAI}
                          disabled={isAiGeneratingJournal}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition disabled:bg-slate-300 flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-100"
                        >
                          {isAiGeneratingJournal ? "⌛ Merumuskan..." : "⚡ AI Bantu Tulis"}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Refleksi Pembelajaran (Guru &amp; Siswa)</label>
                          <VoiceTextInput
                            value={journalRefleksi}
                            onChange={setJournalRefleksi}
                            placeholder="Tulis tingkat keberhasilan, kendala, maupun umpan balik reflektif..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">Rencana Tindak Lanjut</label>
                          <VoiceTextInput
                            value={journalTindakLanjut}
                            onChange={setJournalTindakLanjut}
                            placeholder="Rencana remedial untuk siswa di bawah KKM, atau materi pengayaan berikutnya..."
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Kolom Kanan: Evidensi & Format Dinamis */}
                  <div className="space-y-6">
                    {/* Dynamic Fields */}
                    {journalSchemas.length > 0 && (
                      <div className="bg-white border border-slate-200/80 p-6 rounded-3xl space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                          <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">📋 Kolom Kustom Sekolah</h5>
                          <select
                            value={activeSchema?.id || ""}
                            onChange={(e) => {
                              const sch = journalSchemas.find(s => s.id === e.target.value);
                              setActiveSchema(sch || null);
                              setJournalCustomValues({});
                            }}
                            className="text-[10px] px-2 py-1 border border-slate-200 rounded-lg focus:outline-none font-bold"
                          >
                            {journalSchemas.map(s => (
                              <option key={s.id} value={s.id}>{s.nama_skema}</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-3">
                          {activeSchema?.fields?.map((f: any) => {
                            const isReq = f.required;
                            return (
                              <div key={f.name}>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                  {f.label} {isReq && <span className="text-rose-500">*</span>}
                                </label>
                                {f.type === "textarea" ? (
                                  <textarea
                                    value={journalCustomValues[f.name] || ""}
                                    onChange={(e) => setJournalCustomValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 resize-none"
                                  />
                                ) : f.type === "select" ? (
                                  <select
                                    value={journalCustomValues[f.name] || ""}
                                    onChange={(e) => setJournalCustomValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                                  >
                                    <option value="">-- Pilih --</option>
                                    {f.options?.map((opt: string) => (
                                      <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={journalCustomValues[f.name] || ""}
                                    onChange={(e) => setJournalCustomValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Evidensi (Upload Berkas Ajar) */}
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl space-y-4">
                      <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">📸 Upload Evidensi Pembelajaran</h5>
                      
                      <div className="relative">
                        <label className="w-full py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer text-center flex items-center justify-center gap-1.5">
                          <span>📤 Pilih Berkas (Maks. 5MB)</span>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={handleEvidenceUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {journalEvidensi.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {journalEvidensi.map((ev, idx) => (
                            <div key={idx} className="relative w-12 h-12 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center shrink-0">
                              {ev.startsWith("data:image/") ? (
                                <Image src={ev} alt="Preview" width={48} height={48} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[8px] font-black text-slate-500 uppercase">PDF/Doc</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setJournalEvidensi(prev => prev.filter((_, i) => i !== idx))}
                                className="absolute -top-1 -right-1 bg-rose-500 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[8px] font-bold shadow"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Supervisi Assignment */}
                    <div className="bg-white border border-slate-200/80 p-6 rounded-3xl space-y-4">
                      <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">🛡️ Serahkan ke Supervisor</h5>
                      
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Pilih Kepala Sekolah / Pengawas</label>
                        <select
                          value={journalSupervisorId}
                          onChange={(e) => setJournalSupervisorId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800"
                        >
                          <option value="">-- Pilih Supervisor --</option>
                          {allUsers
                            .filter(u => u.id !== currentUser?.id)
                            .map(u => (
                              <option key={u.id} value={u.id}>
                                {u.nama_lengkap} ({u.role === "admin" ? "Admin" : u.email})
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWritingJournal(false);
                      setActiveJournal(null);
                    }}
                    className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveJournal("Draft")}
                    className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Simpan Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveJournal("Submitted")}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    Kirim &amp; Ajukan Supervisi
                  </button>
                </div>
              </div>
            ) : (
              /* TABEL RIWAYAT JURNAL */
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Riwayat Jurnal Ajar Anda</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Daftar rekaman administrasi ajar dan status persetujuan kepala sekolah.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePrintJournalTable}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100 cursor-pointer text-center font-sans"
                    >
                      🖨️ Cetak Jurnal Harian (Tabel)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveJournal(null);
                        setJournalMateri("");
                        setJournalTujuan("");
                        setJournalAktivitas("");
                        setJournalMedia("");
                        setJournalAsesmen("");
                        setJournalRefleksi("");
                        setJournalTindakLanjut("");
                        setJournalEvidensi([]);
                        setJournalCustomValues({});
                        setJournalSupervisorId("");
                        setIsWritingJournal(true);
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer text-center"
                    >
                      ➕ Tulis Jurnal Baru
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {jurnalList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      😴 Belum ada riwayat pengisian jurnal mengajar.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                          <th className="py-2.5 px-3 w-28">Tanggal</th>
                          <th className="py-2.5 px-3">Kelas &amp; Mapel</th>
                          <th className="py-2.5 px-3">Bahasan/Materi</th>
                          <th className="py-2.5 px-3 w-40 text-center">Status</th>
                          <th className="py-2.5 px-3 w-24 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jurnalListPager.pagedItems.map((j) => (
                          <tr key={j.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition text-xs font-semibold text-slate-700">
                            <td className="py-3 px-3 text-slate-500 font-mono">
                              {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-slate-900 font-bold">{j.nama_kelas}</span>
                              <p className="text-[10px] text-slate-400 font-semibold">{j.nama_mapel}</p>
                            </td>
                            <td className="py-3 px-3 text-slate-800 font-medium max-w-xs truncate">{j.materi_pembelajaran}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                                j.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : j.status === "Revision" ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
                                  : j.status === "Submitted" ? "bg-blue-50 border-blue-200 text-blue-700"
                                  : "bg-slate-100 border-slate-200 text-slate-600"
                              }`}>
                                {j.status === "Submitted" ? "Review" : j.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex justify-center gap-1.5">
                                 <button
                                   type="button"
                                   onClick={() => {
                                     handlePrintJournal(j);
                                   }}
                                   className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs cursor-pointer"
                                   title="Cetak Jurnal"
                                 >
                                   🖨️
                                 </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveJournal(j);
                                  }}
                                  className="p-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs cursor-pointer"
                                  title="Buka Detail"
                                >
                                  👁️
                                </button>
                                {(j.status === "Draft" || j.status === "Revision") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveJournal(j);
                                      setSelectedClassId(j.class_id);
                                      setSelectedSubjectId(j.subject_id);
                                      setSelectedScheduleId(j.schedule_id || "");
                                      setJurnalDate(j.tanggal.split("T")[0]);
                                      setJournalMateri(j.materi_pembelajaran);
                                      setJournalTujuan(j.tujuan_pembelajaran);
                                      setJournalAktivitas(j.aktivitas_pembelajaran);
                                      setJournalMedia(j.media_pembelajaran || "");
                                      setJournalAsesmen(j.asesmen_pembelajaran || "");
                                      setJournalRefleksi(j.refleksi_guru || "");
                                      setJournalTindakLanjut(j.tindak_lanjut || "");
                                      setJournalEvidensi(j.evidensi || []);
                                      setJournalCustomValues(j.custom_values || {});
                                      setJournalSupervisorId(j.supervisor_id || "");
                                      setIsWritingJournal(true);
                                    }}
                                    className="p-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 rounded-lg text-xs cursor-pointer"
                                    title="Ubah"
                                  >
                                    ✏️
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteJournal(j.id)}
                                  className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-lg text-xs cursor-pointer"
                                  title="Hapus"
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {jurnalListPager.total > 0 && (
                  <Pagination
                    page={jurnalListPager.page}
                    pageSize={jurnalListPager.pageSize}
                    total={jurnalListPager.total}
                    totalPages={jurnalListPager.totalPages}
                    onPageChange={(p) => jurnalListPager.reset(p)}
                    onPageSizeChange={(s) => {
                      jurnalListPager.setPageSize(s);
                      jurnalListPager.reset(1);
                    }}
                    loading={false}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. Sub-Tab: Supervisi Jurnal */}
        {journalSubTab === "supervisi" && (
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4 animate-fadeIn">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Supervisi &amp; Evaluasi Akademik</h4>
              <p className="text-[10px] text-slate-400 mt-1">Daftar dokumen jurnal mengajar guru yang diserahkan kepada Anda untuk diulas.</p>
            </div>

            <div className="overflow-x-auto">
              {supervisionList.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  😴 Belum ada tugas supervisi masuk.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Nama Guru</th>
                      <th className="py-2.5 px-3">Kelas &amp; Mapel</th>
                      <th className="py-2.5 px-3">Bahasan/Materi</th>
                      <th className="py-2.5 px-3 w-32 text-center">Status</th>
                      <th className="py-2.5 px-3 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supervisionList.map((j) => (
                      <tr key={j.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition text-xs font-semibold text-slate-700">
                        <td className="py-3 px-3 text-slate-500 font-mono">
                          {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="py-3 px-3 text-slate-900 font-bold">{j.nama_guru}</td>
                        <td className="py-3 px-3 text-slate-500">Kelas {j.nama_kelas} - {j.nama_mapel}</td>
                        <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{j.materi_pembelajaran}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            j.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                              : j.status === "Revision" ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-blue-50 border-blue-200 text-blue-700 animate-pulse"
                          }`}>
                            {j.status === "Submitted" ? "Review" : j.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveJournal(j);
                              setSupervisionComment(j.ulasan?.catatan || "");
                              setSupervisionRecom(j.ulasan?.rekomendasi || "");
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition shadow cursor-pointer text-center"
                          >
                            🔍 Ulas
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* DETIL JURNAL MODAL */}
        {activeJournal && journalSubTab !== "supervisi" && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                <div>
                  <h3 className="text-base font-bold text-slate-800">📓 Detail Jurnal Mengajar</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Dibuat oleh {activeJournal.nama_guru || "Guru"}</p>
                </div>
                <button 
                  onClick={() => setActiveJournal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                  <div>
                    <p className="text-slate-400">Tanggal &amp; Sesi</p>
                    <p className="text-slate-800 font-bold mt-0.5">
                      {new Date(activeJournal.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Kelas &amp; Mata Pelajaran</p>
                    <p className="text-slate-800 font-bold mt-0.5">Kelas {activeJournal.nama_kelas} - {activeJournal.nama_mapel}</p>
                  </div>
                </div>

                <div>
                  <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Bahasan / Materi Pembelajaran</h5>
                  <p className="text-slate-900 font-bold mt-1 text-sm">{activeJournal.materi_pembelajaran}</p>
                </div>

                <div>
                  <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Tujuan Pembelajaran</h5>
                  <p className="text-slate-800 mt-1">{activeJournal.tujuan_pembelajaran}</p>
                </div>

                <div>
                  <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Rangkaian Aktivitas Pembelajaran</h5>
                  <p className="text-slate-800 mt-1 whitespace-pre-wrap">{activeJournal.aktivitas_pembelajaran}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Media Belajar</h5>
                    <p className="text-slate-800 mt-1">{activeJournal.media_pembelajaran || "-"}</p>
                  </div>
                  <div>
                    <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Asesmen</h5>
                    <p className="text-slate-800 mt-1">{activeJournal.asesmen_pembelajaran || "-"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                  <div>
                    <h5 className="font-black text-[10px] text-indigo-600 uppercase tracking-wider">Refleksi Guru</h5>
                    <p className="text-slate-800 mt-1">{activeJournal.refleksi_guru || "-"}</p>
                  </div>
                  <div>
                    <h5 className="font-black text-[10px] text-indigo-600 uppercase tracking-wider">Rencana Tindak Lanjut</h5>
                    <p className="text-slate-800 mt-1">{activeJournal.tindak_lanjut || "-"}</p>
                  </div>
                </div>

                {/* Render Custom Values */}
                {activeJournal.custom_values && Object.keys(activeJournal.custom_values).length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider mb-2">Kolom Kustom Sekolah</h5>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(activeJournal.custom_values).map(([k, v]: any) => (
                        <div key={k} className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{k.replace(/_/g, " ")}</p>
                          <p className="text-slate-800 mt-0.5">{v || "-"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Render Evidensi */}
                {activeJournal.evidensi && activeJournal.evidensi.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider mb-2">Evidensi Pembelajaran</h5>
                    <div className="grid grid-cols-4 gap-2">
                      {activeJournal.evidensi.map((ev: string, i: number) => (
                        <a key={i} href={ev} target="_blank" rel="noopener noreferrer" className="block relative w-16 h-16 border border-slate-200 rounded-xl overflow-hidden">
                          {ev.startsWith("data:image/") ? (
                            <Image src={ev} alt="Evidence" width={64} height={64} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[9px] font-black text-slate-500 flex items-center justify-center h-full bg-slate-50 font-sans">PDF/Doc</span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Supervisor */}
                {activeJournal.status !== "Draft" && activeJournal.status !== "Submitted" && activeJournal.ulasan && (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl relative overflow-hidden">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <h5 className="font-black text-[10px] text-emerald-800 uppercase tracking-wider">Ulasan Supervisi dari {activeJournal.nama_supervisor}</h5>
                        <p className="text-emerald-950 font-bold mt-1">Ulasan: {activeJournal.ulasan.catatan}</p>
                        {activeJournal.ulasan.rekomendasi && (
                          <p className="text-emerald-800 mt-1 italic">Rekomendasi: {activeJournal.ulasan.rekomendasi}</p>
                        )}
                      </div>
                      {activeJournal.status === "Approved" && (
                        <div className="relative border-2 border-dashed border-emerald-600 text-emerald-600 rounded-xl px-3 py-1.5 font-black uppercase text-[8px] tracking-widest rotate-[-6deg] select-none pointer-events-none bg-white shadow-sm flex flex-col items-center justify-center shrink-0">
                          <span className="text-[6px] opacity-75">GURUPRO OFFICIAL STAMP</span>
                          <span className="text-[10px] my-0.5 font-extrabold">⭐ APPROVED ⭐</span>
                          <span className="text-[6px] opacity-75 font-mono">BY {activeJournal.nama_supervisor || "SUPERVISOR"}</span>
                          <span className="text-[6px] font-mono opacity-60 mt-0.5">
                            {activeJournal.ulasan.created_at ? new Date(activeJournal.ulasan.created_at).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => handlePrintJournal(activeJournal)}
                  className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer no-print font-sans"
                >
                  🖨️ Cetak Jurnal
                </button>
                <button 
                  onClick={() => setActiveJournal(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SUPERVISI REVIEW DIALOG */}
        {activeJournal && journalSubTab === "supervisi" && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
            <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
                <div>
                  <h3 className="text-base font-bold text-slate-800">🛡️ Supervisi Jurnal Guru</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Guru Pengampu: {activeJournal.nama_guru}</p>
                </div>
                <button 
                  onClick={() => setActiveJournal(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-slate-700">
                {/* Detail Jurnal */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                  <div>
                    <p className="text-slate-400">Tanggal Ajar</p>
                    <p className="text-slate-800 font-bold mt-0.5">
                      {new Date(activeJournal.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">Kelas &amp; Mapel</p>
                    <p className="text-slate-800 font-bold mt-0.5">Kelas {activeJournal.nama_kelas} - {activeJournal.nama_mapel}</p>
                  </div>
                </div>

                <div>
                  <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Materi / Bahasan</h5>
                  <p className="text-slate-900 font-bold mt-1 text-sm">{activeJournal.materi_pembelajaran}</p>
                </div>

                <div>
                  <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider">Aktivitas &amp; Tujuan</h5>
                  <p className="text-slate-800 mt-1 font-bold">Tujuan: {activeJournal.tujuan_pembelajaran}</p>
                  <p className="text-slate-800 mt-1 whitespace-pre-wrap">{activeJournal.aktivitas_pembelajaran}</p>
                </div>

                {/* Custom fields values */}
                {activeJournal.custom_values && Object.keys(activeJournal.custom_values).length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider mb-2">Kolom Kustom Sekolah</h5>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(activeJournal.custom_values).map(([k, v]: any) => (
                        <div key={k} className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{k.replace(/_/g, " ")}</p>
                          <p className="text-slate-800 mt-0.5">{v || "-"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidensi */}
                {activeJournal.evidensi && activeJournal.evidensi.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-wider mb-2">Evidensi Pembelajaran</h5>
                    <div className="grid grid-cols-4 gap-2">
                      {activeJournal.evidensi.map((ev: string, i: number) => (
                        <a key={i} href={ev} target="_blank" rel="noopener noreferrer" className="block relative w-16 h-16 border border-slate-200 rounded-xl overflow-hidden">
                          <Image src={ev} alt="Evidence" width={64} height={64} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <hr className="border-slate-100 my-4" />

                {/* Form Supervisi */}
                <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-200/50">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">✍️ Berikan Ulasan Supervisi Anda</h4>
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Catatan Evaluasi / Komentar <span className="text-rose-500">*</span></label>
                    <textarea
                      value={supervisionComment}
                      onChange={(e) => setSupervisionComment(e.target.value)}
                      placeholder="Tulis ulasan Anda mengenai kegiatan ajar ini..."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 resize-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Rekomendasi Perbaikan (Opsional)</label>
                    <textarea
                      value={supervisionRecom}
                      onChange={(e) => setSupervisionRecom(e.target.value)}
                      placeholder="Saran tindak lanjut metode, media, atau asesmen untuk guru..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white font-medium text-slate-800 resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex justify-between gap-3">
                <button 
                  onClick={() => setActiveJournal(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition"
                >
                  Batal
                </button>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleSaveSupervision("Revision")}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold transition"
                  >
                    ⚠️ Minta Revisi
                  </button>
                  <button 
                    onClick={() => handleSaveSupervision("Approved")}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-100"
                  >
                    ✍️ Tanda Tangan Digital & Setujui
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- TAMS renderBukuNilaiModule ---
  const renderBukuNilaiModule = () => {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h3 className="text-lg font-bold text-slate-900">📊 TAMS Flexible Assessment Engine</h3>
          <p className="text-xs text-slate-500 mt-1">Kelola penilaian diagnostik, formatif, sumatif, dan kelulusan KKM siswa.</p>
        </div>

        {/* Master Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-200/60 rounded-3xl">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Kelas</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800"
            >
              <option value="">-- Pilih Kelas --</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.nama_kelas}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">Mata Pelajaran</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium text-slate-800"
            >
              <option value="">-- Pilih Mapel --</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.nama_mapel}</option>
              ))}
            </select>
          </div>
        </div>

        {(!selectedSchoolId || !selectedClassId || !selectedSubjectId) ? (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
            ⚠️ Silakan pilih sekolah aktif via Top Bar, lalu tentukan <strong>Kelas</strong> dan <strong>Mata Pelajaran</strong> di atas untuk memuat Buku Nilai.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Builder & AI Assistant */}
            <div className="lg:col-span-1 space-y-6">
              {/* Rancang Asesmen */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">➕ Asesmen Baru</h4>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Asesmen</label>
                  <input
                    type="text"
                    value={assessName}
                    onChange={(e) => setAssessName(e.target.value)}
                    placeholder="Contoh: PH 1 Teks Deskripsi"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipe</label>
                    <select
                      value={assessType}
                      onChange={(e) => setAssessType(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                    >
                      <option value="Diagnostik">Diagnostik</option>
                      <option value="Formatif">Formatif</option>
                      <option value="Sumatif">Sumatif</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">KKM Kelulusan</label>
                    <input
                      type="number"
                      value={assessKkm}
                      onChange={(e) => setAssessKkm(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAssessment}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow"
                >
                  Buat Asesmen Baru
                </button>
              </div>

              {/* AI Assistant Generator */}
              <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <h4 className="text-xs font-bold uppercase tracking-wider">AI Asesmen &amp; Rubrik</h4>
                </div>
                <p className="text-[10px] text-indigo-200 leading-relaxed">
                  Tuliskan Capaian Pembelajaran atau materi ajar kelas. AI akan merancang kisi-kisi, bank soal, rubrik evaluasi, dan saran perbaikan belajar siswa.
                </p>
                <div>
                  <textarea
                    rows={4}
                    value={assessAILearningGoal}
                    onChange={(e) => setAssessAILearningGoal(e.target.value)}
                    placeholder="Contoh: Siswa mampu menganalisis struktur dan kaidah kebahasaan teks eksposisi..."
                    className="w-full p-3 border border-indigo-700/50 rounded-xl text-xs bg-white/10 text-white placeholder-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-indigo-300 block mb-1">Kurikulum</label>
                  <select
                    value={assessAIKurikulum}
                    onChange={(e) => setAssessAIKurikulum(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-700/50 rounded-xl text-xs bg-white/10 text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  >
                    <option value="merdeka">Kurikulum Merdeka</option>
                    <option value="k13">K13 (Kurikulum 2013)</option>
                    <option value="kbc">KBC (Madrasah)</option>
                    <option value="hybrid">Hybrid (Gabungan)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateAIAssessment}
                  disabled={isGeneratingAssessRubric}
                  className="w-full py-2.5 bg-white hover:bg-indigo-50 text-indigo-900 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow"
                >
                  {isGeneratingAssessRubric ? "AI Merumuskan..." : "⚡ Rancang via AI (1 Poin)"}
                </button>
              </div>

              {/* Hasil Asesmen AI */}
              {assessAIResult && (
                <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3.5 bg-indigo-900 text-white">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✨</span>
                      <h4 className="text-xs font-bold uppercase tracking-wider">Hasil Rancangan AI</h4>
                    </div>
                    <button
                      onClick={() => setAssessAIResult(null)}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer text-xs"
                      title="Tutup"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="p-5 space-y-5 max-h-[32rem] overflow-y-auto">
                    {/* Rubrik */}
                    {(assessAIResult.rubrik || assessAIResult.raw) && (
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Rubrik Penilaian
                        </h5>
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
                          {assessAIResult.rubrik || assessAIResult.raw}
                        </div>
                      </div>
                    )}

                    {/* Soal */}
                    {assessAIResult.soal && assessAIResult.soal.length > 0 && (
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Bank Soal ({assessAIResult.soal.length})
                        </h5>
                        <div className="space-y-3">
                          {assessAIResult.soal.map((s, i) => (
                            <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                              <div className="text-xs font-semibold text-slate-800">
                                {i + 1}. {s.pertanyaan}
                              </div>
                              {s.pilihan && s.pilihan.length > 0 && (
                                <ul className="space-y-0.5">
                                  {s.pilihan.map((opt, j) => (
                                    <li key={j} className="text-xs text-slate-600 ml-3 flex gap-1">
                                      <span>•</span>
                                      <span>{opt}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {s.kunci_jawaban && (
                                <div className="text-[11px] text-emerald-700 font-semibold">
                                  Kunci: {s.kunci_jawaban}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Saran Pedagogis */}
                    {assessAIResult.saran_pedagogis && (
                      <div>
                        <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Rekomendasi Pedagogis
                        </h5>
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-xl p-3">
                          {assessAIResult.saran_pedagogis}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Buku Nilai Utama */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Buku Nilai Siswa</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Pilih asesmen aktif di bawah untuk memasukkan nilai murid.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={activeAssessId}
                    onChange={(e) => setActiveAssessId(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none bg-white font-semibold text-slate-800 w-48 sm:w-60"
                  >
                    <option value="">-- Pilih Asesmen --</option>
                    {assessments.map((a) => (
                      <option key={a.id} value={a.id}>{a.nama_asesmen} ({a.tipe_asesmen})</option>
                    ))}
                  </select>
                  {activeAssessId && (
                    <button
                      onClick={() => handleDeleteAssessment(activeAssessId)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl border border-rose-100 transition cursor-pointer text-xs"
                      title="Hapus Asesmen"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              {!activeAssessId ? (
                <div className="text-center text-slate-400 italic py-16 text-xs">
                  😴 Pilih salah satu agenda asesmen untuk memuat tabel nilai murid.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* CSV Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[10px] font-bold text-slate-600">
                    <span>Impor / Ekspor Excel:</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportGradesCSV}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition shadow-sm cursor-pointer"
                      >
                        📥 Ekspor CSV
                      </button>
                      <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg transition shadow-sm cursor-pointer">
                        📤 Impor CSV
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleImportGradesCSV}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96 pr-1">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 text-[10px] text-slate-400 font-bold uppercase">
                          <th className="py-2.5 px-2 w-10 text-center">Absen</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3 w-32">Nilai Awal</th>
                          <th className="py-2.5 px-3 w-32">Nilai Remedial</th>
                          <th className="py-2.5 px-2 w-20 text-center">Akhir</th>
                          <th className="py-2.5 px-2 w-20 text-center">Status</th>
                          <th className="py-2.5 px-2 w-24 text-center">AI Raport</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentGradesPager.pagedItems.map((g, idx) => {
                          const isFailed = Number(g.nilai_akhir || g.nilai_awal || 0) < assessKkm;
                          return (
                            <tr key={g.student_id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition text-xs font-semibold text-slate-700">
                              <td className="py-2 px-2 text-center text-slate-400">{g.nomor_absen || idx + 1}</td>
                              <td className="py-2 px-3 text-slate-800">{g.nama_siswa}</td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  value={g.nilai_awal !== null && g.nilai_awal !== undefined ? g.nilai_awal : ""}
                                  onChange={(e) => updateGradeField(g.student_id, "nilai_awal", e.target.value === "" ? "" : Number(e.target.value))}
                                  placeholder="0"
                                  className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 text-center"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  disabled={g.nilai_awal >= assessKkm}
                                  value={g.nilai_remedial !== null && g.nilai_remedial !== undefined ? g.nilai_remedial : ""}
                                  onChange={(e) => updateGradeField(g.student_id, "nilai_remedial", e.target.value === "" ? "" : Number(e.target.value))}
                                  placeholder={g.nilai_awal >= assessKkm ? "Lulus KKM" : "0"}
                                  className={`w-20 px-2 py-1 border rounded-lg text-xs text-center ${
                                    g.nilai_awal >= assessKkm ? "bg-slate-100 border-slate-200 text-slate-400" : "bg-white border-slate-200 text-slate-800"
                                  }`}
                                />
                              </td>
                              <td className="py-2 px-2 text-center font-bold text-slate-900">{g.nilai_akhir !== null && g.nilai_akhir !== undefined ? g.nilai_akhir : (g.nilai_awal || 0)}</td>
                              <td className="py-2 px-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                  isFailed ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                }`}>
                                  {isFailed ? "Remedial" : "Lulus"}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRaporStudent({
                                      id: g.student_id,
                                      nama_siswa: g.nama_siswa,
                                      nomor_absen: g.nomor_absen || idx + 1,
                                      nilai: g.nilai_akhir || g.nilai_awal || 0,
                                    });
                                    setShowRaportWriter(true);
                                  }}
                                  className="px-2 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold transition cursor-pointer"
                                  title="Generate AI Raport Description"
                                >
                                  ✨ AI
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {studentGradesPager.total > 0 && (
                    <Pagination
                      page={studentGradesPager.page}
                      pageSize={studentGradesPager.pageSize}
                      total={studentGradesPager.total}
                      totalPages={studentGradesPager.totalPages}
                      onPageChange={(p) => studentGradesPager.reset(p)}
                      onPageSizeChange={(s) => {
                        studentGradesPager.setPageSize(s);
                        studentGradesPager.reset(1);
                      }}
                      loading={false}
                    />
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        // Generate raport for all students
                        if (studentGrades.length > 0) {
                          alert("Fitur batch raport akan segera hadir! Untuk saat ini, silakan generate satu per satu.");
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer"
                    >
                      ✨ Generate Semua Raport
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveGrades}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow shadow-indigo-100 cursor-pointer"
                    >
                      Simpan Buku Nilai
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Raport Writer Modal */}
        {showRaportWriter && selectedRaporStudent && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between rounded-t-3xl">
                <div>
                  <h3 className="font-bold text-slate-800">✨ AI Raport Writer</h3>
                  <p className="text-[10px] text-slate-500">Generate deskripsi rapor untuk {selectedRaporStudent.nama_siswa}</p>
                </div>
                <button
                  onClick={() => {
                    setShowRaportWriter(false);
                    setSelectedRaporStudent(null);
                  }}
                  className="w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center justify-center text-slate-500 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <RaportWriter
                  student={selectedRaporStudent}
                  subjectId={selectedSubjectId}
                  assessmentId={activeAssessId}
                  nilai={selectedRaporStudent.nilai}
                  onGenerated={(desc: string) => {
                    console.log("Generated raport description:", desc);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const updateGradeField = (studentId: string, field: string, value: any) => {
    setStudentGrades(prev => prev.map(sg => {
      if (sg.student_id === studentId) {
        return { ...sg, [field]: value };
      }
      return sg;
    }));
  };

  const handleExportGradesCSV = () => {
    if (studentGrades.length === 0) return;
    const school = schools.find(s => s.id === selectedSchoolId);
    const schoolName = school?.nama_sekolah || "Sekolah GuruPro";
    const cls = classes.find(c => c.id === selectedClassId);
    const className = cls?.nama_kelas || "Semua Kelas";
    const assess = assessments.find(a => a.id === activeAssessId);
    const assessName = assess?.nama_asesmen || "Asesmen";
    const dateStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const headerBlock = 
      "sep=,\n" +
      "=== GURUPRO PREMIUM ===\n" +
      `Tipe Dokumen: Ekspor Buku Nilai Siswa\n` +
      `Sekolah: ${schoolName}\n` +
      `Kelas: ${className}\n` +
      `Asesmen: ${assessName}\n` +
      `Tanggal Unduh: ${dateStr}\n` +
      "Petunjuk Pengisian:\n" +
      "1. Anda hanya diperbolehkan mengubah kolom 'Nilai Awal' dan 'Nilai Remedial'.\n" +
      "2. Jangan mengubah data 'Nama Siswa' atau 'NISN' agar sistem dapat mencocokkan data.\n" +
      "=======================\n\n";

    const headers = "No Absen,Nama Siswa,NISN,Nilai Awal,Nilai Remedial\n";
    const rows = studentGrades.map(g => `${g.nomor_absen || ""},${g.nama_siswa},${g.nisn || ""},${g.nilai_awal !== null && g.nilai_awal !== undefined ? g.nilai_awal : ""},${g.nilai_remedial !== null && g.nilai_remedial !== undefined ? g.nilai_remedial : ""}`).join("\n");
    
    const blob = new Blob([headerBlock + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const assessNameStr = assessName.replace(/[^a-zA-Z0-9]/g, "_");
    link.setAttribute("download", `nilai_${assessNameStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportGradesCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
      const newGrades = [...studentGrades];
      
      // Find the header row dynamically
      let headerIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes("nama") && (line.includes("absen") || line.includes("nisn") || line.includes("nilai"))) {
          headerIdx = i;
          break;
        }
      }
      const startIdx = headerIdx !== -1 ? headerIdx + 1 : 1;

      for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (line.toLowerCase().startsWith("sep=")) continue;

        // Clean split (detect separator dynamically)
        const separator = line.includes(";") ? ";" : ",";
        const parts = line.split(separator).map(p => p.trim().replace(/^["']|["']$/g, ""));
        
        if (parts.length >= 4) {
          const name = parts[1];
          const valAwalStr = parts[3];
          const valRemStr = parts[4];
          
          if (
            !name || 
            name.toLowerCase().includes("petunjuk") || 
            name.toLowerCase().includes("tipe dokumen") || 
            name.toLowerCase().includes("gurupro") ||
            name.toLowerCase().includes("sekolah:") ||
            name.toLowerCase().includes("kelas:")
          ) {
            continue;
          }

          const valAwal = valAwalStr === "" ? 0 : Number(valAwalStr);
          const valRem = valRemStr === "" || valRemStr === undefined ? null : Number(valRemStr);
          
          const idx = newGrades.findIndex(g => g.nama_siswa.toLowerCase() === name.toLowerCase());
          if (idx !== -1) {
            newGrades[idx] = {
              ...newGrades[idx],
              nilai_awal: isNaN(valAwal) ? 0 : valAwal,
              nilai_remedial: valRem !== null && isNaN(valRem) ? null : valRem
            };
          }
        }
      }
      setStudentGrades(newGrades);
      showSuccess("Data nilai dari CSV berhasil dimuat ke tabel!");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // --- TAMS renderKalenderModule ---
  const renderKalenderModule = () => {
    const isOperator = currentUser?.role === "operator" || currentUser?.role === "admin";
    return (
      <div className="space-y-6 animate-fadeIn">
        <div>
          <h3 className="text-lg font-bold text-slate-900">📅 Kalender Akademik Sekolah</h3>
          <p className="text-xs text-slate-500 mt-1">Kelola agenda kegiatan sekolah, libur nasional, rapat evaluasi, dan pekan ujian.</p>
        </div>

        {!selectedSchoolId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
            ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk memuat Kalender Akademik.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Operator Form */}
            {isOperator && (
              <div className="lg:col-span-1 bg-slate-50 border border-slate-200/60 rounded-3xl p-5 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">➕ Rancang Agenda</h4>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Kegiatan</label>
                  <input
                    type="text"
                    value={calEventName}
                    onChange={(e) => setCalEventName(e.target.value)}
                    placeholder="Contoh: Ujian Akhir Semester"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Mulai</label>
                    <input
                      type="date"
                      value={calStart}
                      onChange={(e) => setCalStart(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Selesai</label>
                    <input
                      type="date"
                      value={calEnd}
                      onChange={(e) => setCalEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Keterangan / Deskripsi</label>
                  <textarea
                    rows={3}
                    value={calKeterangan}
                    onChange={(e) => setCalKeterangan(e.target.value)}
                    placeholder="Tulis rincian lokasi atau teknis pelaksanaan..."
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs bg-white text-slate-800 font-medium resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveCalendarEvent}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer text-center"
                >
                  {calActiveId ? "Simpan Perubahan" : "Tambah Agenda"}
                </button>
              </div>
            )}

            {/* Calendar Events List */}
            <div className={`${isOperator ? "lg:col-span-2" : "lg:col-span-3"} bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4`}>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Agenda Kegiatan Terjadwal</h4>
              {academicEvents.length === 0 ? (
                <div className="text-center text-slate-400 italic py-16 text-xs">
                  😴 Belum ada agenda sekolah terjadwal di kalender akademik.
                </div>
              ) : (
                <div className="space-y-3">
                  {academicEvents.map((evt) => (
                    <div key={evt.id} className="flex justify-between items-start bg-slate-50 hover:bg-slate-100/70 border border-slate-100 p-4 rounded-2xl transition">
                      <div className="space-y-1">
                        <span className="text-xs font-black text-slate-800">{evt.event_name}</span>
                        <div className="text-[10px] text-indigo-600 font-bold flex items-center gap-1.5">
                          <span>📅</span>
                          <span>
                            {new Date(evt.tanggal_mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            {" - "}
                            {new Date(evt.tanggal_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        {evt.keterangan && (
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed pt-1">{evt.keterangan}</p>
                        )}
                      </div>
                      {isOperator && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCalActiveId(evt.id);
                              setCalEventName(evt.event_name);
                              setCalStart(evt.tanggal_mulai.split("T")[0]);
                              setCalEnd(evt.tanggal_selesai.split("T")[0]);
                              setCalKeterangan(evt.keterangan || "");
                            }}
                            className="p-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-55 transition cursor-pointer"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCalendarEvent(evt.id)}
                            className="p-1.5 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-105 transition cursor-pointer"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- TAMS renderSupervisiAnalitikModule ---
  const renderSupervisiAnalitikModule = () => {
    const isAdminOrPengawas = currentUser?.role === "admin" || currentUser?.role === "pengawas";
    const kkmSuccessRate = analyticsData ? calculateKKMSuccessRate() : 0;

    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">🛡️ TAMS Supervisi &amp; Analitik Sekolah</h3>
            <p className="text-xs text-slate-500 mt-1">Pantau indeks kepatuhan jurnal, rata-rata nilai KKM, dan data analitik sekolah binaan.</p>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto gap-0.5">
            <button
              onClick={() => setActiveSupervisionTab("nilai")}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                activeSupervisionTab === "nilai" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📊 Analitik Akademik
            </button>
            <button
              onClick={() => {
                setActiveSupervisionTab("jurnal_doc");
                fetchSupervisions();
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                activeSupervisionTab === "jurnal_doc" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📓 Jurnal Guru
            </button>
            <button
              onClick={() => {
                setActiveSupervisionTab("rpp_doc");
                if (selectedSchoolId) {
                  fetchSupervisionDocs(selectedSchoolId);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                activeSupervisionTab === "rpp_doc" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📚 RPP &amp; Silabus Guru
            </button>
            {isAdminOrPengawas && (
              <button
                onClick={() => {
                  setActiveSupervisionTab("audit");
                  fetchAuditLogs();
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition cursor-pointer ${
                  activeSupervisionTab === "audit" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📝 Jejak Audit (Logs)
              </button>
            )}
          </div>
        </div>

        {!selectedSchoolId ? (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 text-center text-amber-800 text-xs font-medium">
            ⚠️ Silakan pilih sekolah melalui menu di baris atas (Top Bar) terlebih dahulu untuk memuat data supervisi &amp; analitik.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tab 1: Analitik Akademik */}
            {activeSupervisionTab === "nilai" && (
              <div className="space-y-6">
                {/* Visual Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Siswa</span>
                    <span className="text-2xl font-black text-slate-800 block mt-1">
                      {analyticsData?.summary?.total_students || 0}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Guru Aktif</span>
                    <span className="text-2xl font-black text-slate-800 block mt-1">
                      {analyticsData?.summary?.active_teachers || 0}
                    </span>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase block">Ketuntasan KKM</span>
                    <span className="text-2xl font-black text-emerald-700 block mt-1">
                      {kkmSuccessRate}%
                    </span>
                  </div>
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-5 shadow-sm">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase block">Indeks Jurnal</span>
                    <span className="text-2xl font-black text-indigo-700 block mt-1">
                      {calculateJournalCompleteness()}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Average Grades Chart Placeholder */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Performa Rata-rata Nilai Asesmen</h4>
                    {!analyticsData?.average_grades || analyticsData.average_grades.length === 0 ? (
                      <div className="text-center text-slate-400 italic py-10 text-xs">Belum ada data nilai terekam.</div>
                    ) : (
                      <div className="space-y-3.5">
                        {analyticsData.average_grades.map((g: any, i: number) => (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                              <span>{g.tipe_asesmen}</span>
                              <span>{g.avg_nilai} / 100</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${g.avg_nilai || 0}%` }}
                                className="bg-indigo-600 h-full rounded-full"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent Activities Timeline */}
                  <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Aktivitas Mengajar Guru Terbaru</h4>
                    {!analyticsData?.recent_activity || analyticsData.recent_activity.length === 0 ? (
                      <div className="text-center text-slate-400 italic py-10 text-xs">Belum ada riwayat jurnal kelas masuk.</div>
                    ) : (
                      <div className="space-y-3">
                        {analyticsData.recent_activity.map((act: any) => (
                          <div key={act.id} className="flex gap-3 border-l-2 border-slate-100 pl-4 py-1 relative">
                            <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full absolute -left-[6px] top-2" />
                            <div className="text-[10px] leading-relaxed font-semibold">
                              <span className="font-bold text-slate-800">{act.nama_guru}</span>
                              {" mengisi jurnal ajar di "}
                              <span className="font-bold text-slate-700">{act.nama_kelas}</span>
                              {" - "}
                              <span className="font-bold text-slate-700">{act.nama_mapel}</span>
                              <p className="text-[9px] text-slate-400 font-bold mt-0.5">Bahasan: {act.materi_pembelajaran}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Supervisi Jurnal */}
            {activeSupervisionTab === "jurnal_doc" && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Verifikasi Jurnal Ajar</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Ulas dan bubuhkan persetujuan stempel tanda tangan digital pada administrasi jurnal guru.</p>
                </div>

                <div className="overflow-x-auto">
                  {supervisionList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Belum ada tugas supervisi jurnal yang diajukan ke Anda.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                          <th className="py-2.5 px-3">Tanggal</th>
                          <th className="py-2.5 px-3">Nama Guru</th>
                          <th className="py-2.5 px-3">Kelas &amp; Mapel</th>
                          <th className="py-2.5 px-3">Materi Ajar</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                          <th className="py-2.5 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supervisionList.map((j) => (
                          <tr key={j.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition font-semibold text-slate-700">
                            <td className="py-3 px-3 text-slate-500 font-mono">
                              {new Date(j.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td className="py-3 px-3 text-slate-900 font-bold">{j.nama_guru}</td>
                            <td className="py-3 px-3 text-slate-500">{j.nama_kelas} - {j.nama_mapel}</td>
                            <td className="py-3 px-3 text-slate-700 max-w-xs truncate">{j.materi_pembelajaran}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                j.status === "Approved" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : j.status === "Revision" ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : "bg-blue-50 border-blue-200 text-blue-700"
                              }`}>
                                {j.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <div className="flex justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    handlePrintJournal(j);
                                  }}
                                  className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold transition shadow cursor-pointer"
                                  title="Cetak Jurnal"
                                >
                                  🖨️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveJournal(j);
                                    setSupervisionComment(j.ulasan?.catatan || "");
                                    setSupervisionRecom(j.ulasan?.rekomendasi || "");
                                  }}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition shadow cursor-pointer text-center"
                                >
                                  🔍 Ulas
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: RPP & Silabus Guru */}
            {activeSupervisionTab === "rpp_doc" && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Supervisi Dokumen RPP, Silabus &amp; Administrasi Guru</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Lihat dan tinjau seluruh kelengkapan dokumen administrasi ajar guru di sekolah binaan Anda.</p>
                </div>

                <div className="overflow-x-auto">
                  {supervisionDocsList.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      Belum ada dokumen administrasi (RPP/Silabus) yang diunggah oleh guru di sekolah ini.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                          <th className="py-2.5 px-3">Tanggal Unggah</th>
                          <th className="py-2.5 px-3">Nama Guru</th>
                          <th className="py-2.5 px-3">Tipe Dokumen</th>
                          <th className="py-2.5 px-3">Judul Dokumen</th>
                          <th className="py-2.5 px-3">Detail Kurikulum</th>
                          <th className="py-2.5 px-3 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supervisionDocsList.map((doc) => (
                          <tr key={doc.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition font-semibold text-slate-700">
                            <td className="py-3 px-3 text-slate-500 font-mono">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-bold text-slate-900 block">{doc.nama_guru}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{doc.email_guru}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[9px] font-black uppercase border border-slate-200">
                                {doc.tipe_dokumen}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-800 font-bold">{doc.judul_dokumen}</td>
                            <td className="py-3 px-3 text-slate-500 font-normal">
                              {doc.jenjang} {doc.fase && `(Fase ${doc.fase})`} • Kurikulum {doc.kurikulum || 'Merdeka'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedExplorerFile(doc);
                                  setOpenExplorerFolder("administrasi");
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition shadow cursor-pointer text-center"
                              >
                                🔍 Lihat Dokumen
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Jejak Audit (Logs) */}
            {activeSupervisionTab === "audit" && isAdminOrPengawas && (
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Jejak Langkah Log Audit TAMS</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Transparansi penuh data. Menampilkan 50 aktivitas mutasi sistem terbaru.</p>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] text-slate-400 font-bold uppercase">
                        <th className="py-2.5 px-3">Tanggal &amp; Waktu</th>
                        <th className="py-2.5 px-3">Pelaku</th>
                        <th className="py-2.5 px-3">Peran</th>
                        <th className="py-2.5 px-3">Aksi</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                        <th className="py-2.5 px-3 text-right">IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogsPager.pagedItems.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100/60 hover:bg-slate-50/50 transition font-medium text-slate-600">
                          <td className="py-2.5 px-3 font-mono text-[10px] text-slate-400">
                            {new Date(log.created_at).toLocaleString("id-ID")}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800">{log.nama_lengkap || "Sistem"}</span>
                            <p className="text-[9px] text-slate-400">{log.email || ""}</p>
                          </td>
                          <td className="py-2.5 px-3 uppercase text-[9px] font-black tracking-wide text-indigo-600">{log.role || "sistem"}</td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md font-bold text-[9px]">
                              {log.aksi}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate font-semibold">{log.deskripsi}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-400">{log.ip_address}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {auditLogsPager.total > 0 && (
                  <Pagination
                    page={auditLogsPager.page}
                    pageSize={auditLogsPager.pageSize}
                    total={auditLogsPager.total}
                    totalPages={auditLogsPager.totalPages}
                    onPageChange={(p) => auditLogsPager.reset(p)}
                    onPageSizeChange={(s) => {
                      auditLogsPager.setPageSize(s);
                      auditLogsPager.reset(1);
                    }}
                    loading={false}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const calculateKKMSuccessRate = () => {
    if (!analyticsData?.grades || analyticsData.grades.length === 0) return 100;
    const lulus = analyticsData.grades.find((g: any) => g.status_remedial === "Lulus")?.count || 0;
    const rem = analyticsData.grades.find((g: any) => g.status_remedial === "Butuh Remedial")?.count || 0;
    const total = Number(lulus) + Number(rem);
    if (total === 0) return 100;
    return Math.round((Number(lulus) / total) * 100);
  };

  const calculateJournalCompleteness = () => {
    if (!analyticsData?.journals || analyticsData.journals.length === 0) return 0;
    const approved = analyticsData.journals.find((j: any) => j.status === "Approved")?.count || 0;
    const submitted = analyticsData.journals.find((j: any) => j.status === "Submitted")?.count || 0;
    const total = analyticsData.journals.reduce((sum: number, j: any) => sum + Number(j.count), 0);
    if (total === 0) return 0;
    return Math.round(((Number(approved) + Number(submitted)) / total) * 100);
  };

  const renderAdministrasiModule = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Asisten Administrasi Kelas (Guru AI Asisten)</h3>
            <p className="text-xs text-slate-500 mt-1">Buat Silabus, RPP K13, atau Modul Ajar Kurikulum Merdeka instan menggunakan AI.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-1 bg-slate-50 border border-slate-200/60 rounded-3xl p-6 space-y-4">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Spesifikasi Dokumen</h4>
            
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipe Dokumen</label>
              <select 
                value={adminDocType}
                onChange={(e) => setAdminDocType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white font-bold text-slate-800"
              >
                <option value="rpp">📝 RPP (Rencana Pelaksanaan Pembelajaran)</option>
                <option value="modul">📘 Modul Ajar (Kurikulum Merdeka)</option>
                <option value="silabus">📊 Silabus Pembelajaran Semester</option>
                <option value="lkpd">📝 LKPD (Lembar Kerja Peserta Didik)</option>
                <option value="laporan_lkpd">📊 Laporan Evaluasi LKPD (Untuk Kepsek)</option>
                <option value="bahan_ajar">✨ Bahan Ajar AI (Slide, LKPD, Handout)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Mata Pelajaran</label>
                <input 
                  type="text" 
                  value={adminMapel}
                  onChange={(e) => setAdminMapel(e.target.value)}
                  placeholder="Fisika, Matematika..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Kelas</label>
                <input 
                  type="text" 
                  value={adminKelas}
                  onChange={(e) => setAdminKelas(e.target.value)}
                  placeholder="X (SMA)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Kurikulum</label>
              <select 
                value={adminKurikulum}
                onChange={(e) => setAdminKurikulum(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white"
              >
                <option value="merdeka">Kurikulum Merdeka</option>
                <option value="k13">K13 (Kurikulum 2013)</option>
                <option value="kbc">KBC (Madrasah)</option>
                <option value="hybrid">Hybrid (Gabungan)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Topik / Bahasan Utama</label>
              <input 
                type="text" 
                value={adminTopik}
                onChange={(e) => setAdminTopik(e.target.value)}
                placeholder="Hukum Newton tentang Gravitasi..."
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none bg-white font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">Tujuan Pembelajaran (Opsional)</label>
              <textarea 
                rows={3}
                value={adminTujuan}
                onChange={(e) => setAdminTujuan(e.target.value)}
                placeholder="Siswa dapat memahami relasi antar gaya gravitasi..."
                className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none bg-white"
              />
            </div>

            <button
              onClick={generateAdminDoc}
              disabled={isGeneratingDoc}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow cursor-pointer text-center flex items-center justify-center gap-1.5 disabled:opacity-50 font-sans"
            >
              {isGeneratingDoc ? "⏳ Menghubungi GuruPRO AI..." : "🚀 Generate Dokumen AI (1 Poin)"}
            </button>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dokumen Tersimpan</h5>
              {savedDocs.length === 0 ? (
                <p className="text-[10px] text-slate-400 italic">Belum ada dokumen yang disimpan.</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {savedDocs.map((doc) => (
                    <div key={doc.id} className="bg-white border border-slate-200 p-2 rounded-xl text-[11px] font-medium hover:border-slate-300 transition">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => openSavedDoc(doc)}
                          className={`text-left font-bold truncate flex-1 mr-2 cursor-pointer ${
                            isSubscriptionExpiredOver30Days()
                              ? "text-slate-400 line-through"
                              : "text-slate-700 hover:text-indigo-600"
                          }`}
                        >
                          {isSubscriptionExpiredOver30Days() && "🔒 "}{doc.judul_dokumen}
                        </button>
                        <button
                          onClick={() => deleteSavedDoc(doc.id)}
                          className="text-rose-500 hover:text-rose-700 px-1.5 cursor-pointer font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      {["rpp", "modul"].includes(doc.tipe_dokumen) && (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <ApprovalStatusBadge status={doc.approval_status as any} />
                            {doc.institution_id ? (
                              <SubmitApprovalButton
                                docId={doc.id}
                                status={doc.approval_status as any}
                                onSubmitted={() => { fetchSavedDocs(); showSuccess("Dokumen diajukan ke Kepsek untuk disetujui."); }}
                              />
                            ) : (
                              <span className="text-[10px] text-slate-400">
                                Belum ada Kepsek terkait — approval aktif setelah terhubung institusi
                              </span>
                            )}
                          </div>
                          {doc.approval_status === "revisi" && doc.approval_note && (
                            <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                              <span className="font-bold">Catatan Kepsek:</span> {doc.approval_note}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            {isGeneratingDoc ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 border-dashed rounded-3xl text-slate-500 gap-3">
                <span className="text-3xl animate-spin">⏳</span>
                <span className="text-xs font-bold">Mempersiapkan dokumen berkualitas... (Dapat memakan waktu 10-15 detik)</span>
              </div>
            ) : generatedDoc ? (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-sm font-bold text-slate-800">{generatedDoc.judul}</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={saveGeneratedDoc}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100 font-sans"
                    >
                      💾 Simpan ke Storage
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedDoc.konten);
                        showSuccess("Konten berhasil disalin!");
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📋 Salin Teks
                    </button>
                    <button
                      onClick={() => {
                        const printWindow = window.open("", "_blank");
                        if (printWindow) {
                          printWindow.document.write(generatePrintLayout(generatedDoc.judul, generatedDoc.konten));
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      🖨️ Cetak Laporan
                    </button>
                    <button
                      onClick={() => {
                        if (generatedDoc.docx_url) {
                          window.open(generatedDoc.docx_url, "_blank");
                        } else {
                          downloadDocxClient(generatedDoc.judul, generatedDoc.konten);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📘 Ekspor Word (.doc)
                    </button>
                    <button
                      onClick={() => {
                        if (generatedDoc.pdf_url) {
                          window.open(generatedDoc.pdf_url, "_blank");
                        } else {
                          downloadPdfClient(generatedDoc.judul, generatedDoc.konten);
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📕 Ekspor PDF
                    </button>
                    {generatedDoc.pptx_url && (
                      <a
                        href={generatedDoc.pptx_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100 transition flex items-center gap-1.5 font-bold cursor-pointer font-sans"
                      >
                        📊 Ekspor PPTX
                      </a>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 overflow-y-auto max-h-[500px] text-xs font-medium leading-relaxed text-slate-700 space-y-4 font-sans">
                  <RichMarkdown content={generatedDoc.konten || ''} />
                </div>
              </div>
            ) : viewingDoc ? (
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h4 className="text-sm font-bold text-slate-800">{viewingDoc.judul_dokumen}</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={updateSavedDoc}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100 font-sans"
                    >
                      💾 Simpan Perubahan
                    </button>
                    <button
                      onClick={() => {
                        if (isSubscriptionExpired()) {
                          showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menyalin atau mencetak berkas.");
                          return;
                        }
                        navigator.clipboard.writeText(viewingDoc.konten?.markdown || "");
                        showSuccess("Konten berhasil disalin!");
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📋 Salin Teks
                    </button>
                    <button
                      onClick={() => {
                        if (isSubscriptionExpired()) {
                          showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menyalin atau mencetak berkas.");
                          return;
                        }
                        const printWindow = window.open("", "_blank");
                        if (printWindow) {
                          printWindow.document.write(generatePrintLayout(viewingDoc.judul_dokumen, viewingDoc.konten?.markdown || ""));
                          printWindow.document.close();
                          printWindow.print();
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      🖨️ Cetak Laporan
                    </button>
                    <button
                      onClick={() => {
                        if (viewingDoc.konten?.docx_url) {
                          window.open(viewingDoc.konten.docx_url, "_blank");
                        } else {
                          downloadDocxClient(viewingDoc.judul_dokumen, viewingDoc.konten?.markdown || "");
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📘 Ekspor Word (.doc)
                    </button>
                    <button
                      onClick={() => {
                        if (viewingDoc.konten?.pdf_url) {
                          window.open(viewingDoc.konten.pdf_url, "_blank");
                        } else {
                          downloadPdfClient(viewingDoc.judul_dokumen, viewingDoc.konten?.markdown || "");
                        }
                      }}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📕 Ekspor PDF
                    </button>
                    {viewingDoc.konten?.pptx_url && (
                      <a
                        href={viewingDoc.konten.pptx_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100 transition flex items-center gap-1.5 font-bold cursor-pointer font-sans"
                      >
                        📊 Ekspor PPTX
                      </a>
                    )}
                    {viewingDoc.tipe_dokumen === 'rpp' && (
                      <button
                        onClick={() => {
                          const rppData = {
                            id: viewingDoc.id,
                            judul: viewingDoc.judul_dokumen,
                            mapel: viewingDoc.konten?.mapel || adminMapel,
                            kelas: viewingDoc.konten?.kelas || adminKelas,
                            class_id: viewingDoc.konten?.class_id || '',
                            subject_id: viewingDoc.konten?.subject_id || '',
                          };
                          const matchingSchedule = schedules.find(
                            (s: any) =>
                              s.subject_id === rppData.subject_id &&
                              s.class_id === rppData.class_id
                          );
                          window.dispatchEvent(
                            new CustomEvent('openSelesaiMengajar', {
                              detail: {
                                rpp: rppData,
                                schedule: matchingSchedule || null,
                              },
                            })
                          );
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        ✓ Selesai Mengajar
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={20}
                  value={viewingDoc.konten?.markdown || ""}
                  onChange={(e) => setViewingDoc({
                    ...viewingDoc,
                    konten: { ...viewingDoc.konten, markdown: e.target.value }
                  })}
                  className="w-full p-5 border border-slate-200 rounded-2xl text-xs font-mono bg-white outline-none focus:border-indigo-400 leading-relaxed text-slate-700"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 bg-slate-50 border border-slate-200 border-dashed rounded-3xl text-slate-400 gap-2">
                <span className="text-4xl">📄</span>
                <span className="text-xs font-semibold">Silakan buat dokumen AI baru atau pilih dokumen tersimpan di sebelah kiri.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handlePrintExplorerSoal = (file: any) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk mencetak atau mengunduh berkas.");
      return;
    }
    const list = file.konten?.soalList || [];
    const meta = file.konten?.meta || {};
    const sekolah = meta.namaSekolah || "GuruPRO";
    const mapel = meta.mapel || "-";
    const kelas = meta.kelas || "-";
    const jenjang = meta.jenjang || "-";
    const topik = meta.topik || "-";
    const kurikulum = meta.kurikulum || "Kurikulum Merdeka";
    const guru = meta.namaGuru || "-";
    const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];

    let soalHtml = "";
    list.forEach((s: any, idx: number) => {
      const opts = s.opsi || s.options || s.pilihan;
      let opsiHtml = "";
      if (opts && Array.isArray(opts)) {
        opsiHtml = opts.map((opt: string, oIdx: number) =>
          `<p class="opsi">${letters[oIdx] || ""}. ${opt}</p>`
        ).join("");
      } else if (s.tipe === "bs") {
        opsiHtml = `<p class="opsi"><strong>A.</strong> Benar &nbsp;&nbsp;&nbsp; <strong>B.</strong> Salah</p>`;
      }

      soalHtml += `
        <div class="soal-item">
          <div class="soal-header">
            <strong>${idx + 1}.</strong> <span class="tipe-badge">${s.tipe || "pg"}</span>
            ${s.tingkat ? `<span class="tipe-badge">${s.tingkat}</span>` : ""}
            ${s.kognitif ? `<span class="tipe-badge" style="background:#dbeafe;">${s.kognitif}</span>` : ""}
          </div>
          <div class="pertanyaan">${s.pertanyaan || s.soal || ""}</div>
          ${s.stimulus ? `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 10px;margin:6px 0;font-style:italic;font-size:10pt;"><strong>Stimulus:</strong> ${s.stimulus}</div>` : ""}
          ${s.gambar ? `<div style="margin:6px 0;text-align:center;font-style:italic;color:#666;font-size:9pt;">[Gambar: ${s.gambar}]</div>` : ""}
          ${s.gambarData ? `<div style="margin:6px 0;"><img src="${s.gambarData}" style="max-width:240px;height:auto;" /></div>` : ""}
          ${opsiHtml}
          ${s.kunci || s.jawaban ? `<div class="kunci-box"><strong>Kunci:</strong> ${s.kunci || s.jawaban}</div>` : ""}
          ${s.pembahasan ? `<div class="pembahasan"><strong>Pembahasan:</strong> ${s.pembahasan}</div>` : ""}
        </div>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${sekolah} - ${mapel}</title>
        <style>
          @page { margin: 25mm 20mm 20mm 30mm; size: A4; }
          * { box-sizing: border-box; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; margin: 0; padding: 0; }
          h1 { font-size: 16pt; text-align: center; margin: 0 0 4px; font-weight: bold; text-transform: uppercase; }
          h2 { font-size: 14pt; margin: 16px 0 10px; font-weight: bold; }
          p { margin: 6px 0; }
          table { width: 100%; border-collapse: collapse; margin: 8px 0; }
          th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11pt; vertical-align: top; }
          th { background: #f3f4f6; font-weight: bold; }
          .kop-section { margin-bottom: 16px; }
          .soal-item { page-break-inside: avoid; margin-bottom: 16px; }
          .soal-header { font-size: 12pt; margin-bottom: 4px; }
          .pertanyaan { margin-bottom: 8px; text-align: justify; }
          .opsi { margin-left: 24px; margin-bottom: 2px; }
          .tipe-badge { background: #e5e7eb; padding: 1px 6px; border-radius: 3px; font-size: 9pt; }
          .pembahasan { margin-top: 8px; padding: 8px; background: #f0fdf4; border-left: 3px solid #22c55e; font-size: 10pt; color: #166534; }
          .kunci-box { margin-top: 6px; padding: 6px; background: #fefce8; border-left: 3px solid #f59e0b; font-size: 10pt; }
          .page-footer { position: fixed; bottom: 15mm; right: 20mm; font-size: 9pt; color: #666; }
          @media print { .page-footer { display: block; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="kop-section">
          <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
            <tr>
              <td style="width:50px;"></td>
              <td style="text-align:center;vertical-align:middle;">
                <h1 style="margin:0;font-size:16pt;font-weight:bold;color:#000;text-transform:uppercase;">${sekolah}</h1>
                <p style="margin:2px 0;font-size:9pt;color:#555;">Alamat sekolah tidak tersedia</p>
              </td>
              <td style="width:50px;"></td>
            </tr>
          </table>
          <div style="border-bottom:2px solid #000;margin-bottom:10px;"></div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:14px;">
            <tr>
              <td style="width:130px;padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Mata Pelajaran</td>
              <td style="padding:2px 0;font-size:11pt;">: ${mapel}</td>
              <td style="width:130px;padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Jenis Asesmen</td>
              <td style="padding:2px 0;font-size:11pt;">: ${meta.jenisAsesmen || "Asesmen"}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Kelas / Jenjang</td>
              <td style="padding:2px 0;font-size:11pt;">: Kelas ${kelas} (${jenjang})</td>
              <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Kurikulum</td>
              <td style="padding:2px 0;font-size:11pt;">: ${kurikulum}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Topik</td>
              <td style="padding:2px 0;font-size:11pt;">: ${topik}</td>
              <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Tanggal</td>
              <td style="padding:2px 0;font-size:11pt;">: ${today}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px 2px 0;font-size:11pt;font-weight:bold;">Guru</td>
              <td style="padding:2px 0;font-size:11pt;">: ${guru}</td>
              <td></td>
              <td></td>
            </tr>
          </table>
        </div>

        <div class="soal-list">
          ${soalHtml}
        </div>
        <div class="page-footer">Halaman <span style="mso-field-code:' PAGE \\* MERGEFORMAT '"></span> dari <span style="mso-field-code:' NUMPAGES \\* MERGEFORMAT '"></span></div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCopyExplorerSoal = (file: any) => {
    if (isSubscriptionExpired()) {
      showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menyalin atau mengunduh berkas.");
      return;
    }
    const list = file.konten?.soalList || [];
    const meta = file.konten?.meta || {};
    
    let text = `=== NASKAH SOAL UJIAN ===\n`;
    text += `Mata Pelajaran : ${meta.mapel || "-"}\n`;
    text += `Kelas/Jenjang  : ${meta.kelas || "-"} / ${meta.jenjang || "-"}\n`;
    text += `Topik          : ${meta.topik || "-"}\n`;
    text += `Kurikulum      : ${meta.kurikulum || "Merdeka"}\n`;
    text += `=========================\n\n`;

    list.forEach((s: any, idx: number) => {
      text += `${idx + 1}. ${s.pertanyaan || s.soal || ""}\n`;
      const opts = s.options || s.pilihan;
      if (opts && Array.isArray(opts)) {
        const letters = ["A", "B", "C", "D", "E"];
        opts.forEach((opt: string, oIdx: number) => {
          text += `   ${letters[oIdx]}. ${opt}\n`;
        });
      }
      text += `   Kunci Jawaban: ${s.kunci || s.jawaban || "-"}\n\n`;
    });

    navigator.clipboard.writeText(text);
    showSuccess("Seluruh soal berhasil disalin ke clipboard!");
  };

  const renderTugasHarianModule = () => {
    const completedTasks = ceklisTasks.filter((t) => t.completed).length;
    const totalTasks = ceklisTasks.length;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const formatRelativeTime = (dateStr: string) => {
      if (!dateStr) return "";
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return "Baru saja";
      if (diffMins < 60) return `${diffMins} menit lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours} jam lalu`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays} hari lalu`;
      return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    };

    const statusIconMap: Record<string, string> = {
      Approved: "✅",
      Submitted: "📤",
      Draft: "📝",
    };

    const recentActivities = analyticsData?.recent_activity?.length > 0
      ? analyticsData.recent_activity.map((act: any) => ({
          icon: statusIconMap[act.status] || "📓",
          desc: act.materi_pembelajaran
            ? `${act.materi_pembelajaran} — ${act.nama_kelas}, ${act.nama_mapel}`
            : `Jurnal ${act.status?.toLowerCase() || "baru"} — ${act.nama_kelas}`,
          time: formatRelativeTime(act.tanggal),
        }))
      : [{ icon: "📭", desc: "Belum ada aktivitas tercatat", time: "" }];

    const totalStudents = analyticsData?.summary?.total_students ?? 0;
    const rppThisMonth = analyticsData?.summary?.rpp_this_month ?? 0;
    const avgGrade = analyticsData?.summary?.avg_grade ?? 0;
    const ungradedTasks = analyticsData?.summary?.ungraded_tasks ?? 0;

    const stats = [
      { icon: "👥", label: "Total Siswa", value: String(totalStudents), trend: "", trendUp: true, bgColor: "bg-blue-50", iconColor: "text-blue-600" },
      { icon: "📄", label: "RPP Bulan Ini", value: String(rppThisMonth), trend: "", trendUp: true, bgColor: "bg-green-50", iconColor: "text-green-600" },
      { icon: "📈", label: "Rata-rata Nilai", value: avgGrade > 0 ? String(avgGrade) : "—", trend: "", trendUp: true, bgColor: "bg-violet-50", iconColor: "text-violet-600" },
      { icon: "⏳", label: "Tugas Belum Dinilai", value: String(ungradedTasks), trend: "", trendUp: false, bgColor: "bg-amber-50", iconColor: "text-amber-600", badge: ungradedTasks > 0 },
    ];

    const quickActions = [
      { icon: "📚", label: "Buat RPP Baru", moduleKey: "administrasi", onClick: () => { setCurrentModule("administrasi"); setAdminDocType("rpp"); } },
      { icon: "📊", label: "Input Nilai", moduleKey: "nilai", onClick: () => { setCurrentModule("nilai"); } },
      { icon: "📝", label: "Buat Soal", moduleKey: "soal", onClick: () => { setCurrentModule("soal"); } },
      { icon: "📋", label: "Laporan Kelas", moduleKey: "sekolah", onClick: () => { setCurrentModule("sekolah"); setTabSekolah("presensi"); } },
      { icon: "✨", label: "Bahan Ajar AI", moduleKey: "administrasi", onClick: () => { router.push("/dashboard/bahan-ajar"); } },
    ].filter((a) => (a.moduleKey ? !hiddenSet.has(moduleFeatureKey(a.moduleKey)) : true));

    return (
      <div className="space-y-6 animate-fadeIn px-4 sm:px-6 py-6">
        {/* Bagian 1 — Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {greeting}, {currentUser?.nama_lengkap?.split(" ")[0] || "Guru"}! 👋
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Berikut ringkasan aktivitas mengajar Anda hari ini
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-violet-50 border border-violet-100 text-violet-700 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5">
              <span>⚡</span>
              <span>{currentUser?.quota_poin_available !== undefined ? `${currentUser.quota_poin_available} Poin` : currentUser?.token_limit !== undefined ? `${currentUser.token_limit} Poin` : "0 Poin"}</span>
            </div>
            {currentUser?.status_langganan && currentUser.status_langganan !== 'free' && currentUser.subscription_end ? (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-3 py-1.5 rounded-xl text-xs whitespace-nowrap">
                ⏱ {getSubscriptionCountdown()}
              </div>
            ) : null}
          </div>
        </div>

        {/* Bagian 1b — Indikator Streak Harian (Sprint 1.3) */}
        <StreakIndicator />

        {/* Bagian 1c — Morning Briefing Card (Sprint 2.2) */}
        <MorningBriefingCard />

        {/* Bagian 2 — Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center text-lg`}>
                  {stat.icon}
                </div>
                {stat.badge && (
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              {stat.trend && (
                <p className={`text-xs font-medium mt-1 ${stat.trendUp ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.trendUp ? '↑' : '↓'} {stat.trend} vs bulan lalu
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Bagian 3 — Quick Actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Aksi Cepat</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:-translate-y-0.5 hover:shadow-card-hover transition-all duration-200 cursor-pointer group"
              >
                <div className="text-2xl mb-2">{action.icon}</div>
                <p className="text-sm font-semibold text-gray-800 group-hover:text-violet-600 transition-colors">{action.label}</p>
                <span className="text-xs text-violet-600 font-medium mt-2 inline-block">Mulai →</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bagian 3.5 — Jadwal Hari Ini dengan Tombol Selesai Mengajar */}
        {(() => {
          const today = new Date();
          const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const hariIni = dayNames[today.getDay()];
          const todaySchedules = schedules.filter((s: any) => s.hari === hariIni);

          if (todaySchedules.length === 0) {
            return (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="text-center">
                  <div className="text-4xl mb-3">📅</div>
                  <h3 className="text-sm font-bold text-slate-700">
                    Tidak ada jadwal mengajar hari ini ({hariIni})
                  </h3>
                </div>
              </div>
            );
          }

          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">📅 Jadwal Hari Ini ({hariIni})</h2>
                <span className="text-xs bg-violet-50 text-violet-700 font-bold px-2 py-0.5 rounded-full">
                  {todaySchedules.length} jadwal
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {todaySchedules.map((sch: any) => {
                  const isCompleted = completedSessionIds.has(sch.id);
                  const isInProgress = typeof window !== 'undefined'
                    ? localStorage.getItem(`teaching_session_${sch.id}`) === 'active'
                    : false;

                  // Pulse if: in-progress + time >= jam_selesai - 5 minutes
                  const shouldPulse = (() => {
                    if (!isInProgress) return false;
                    const now = new Date();
                    const [eh, em] = sch.jam_selesai.split(':').map(Number);
                    const deadline = new Date(now);
                    deadline.setHours(eh, em, 0, 0);
                    deadline.setMinutes(deadline.getMinutes() - 5);
                    return now >= deadline;
                  })();

                  const scheduleInfo: ScheduleInfo = {
                    id: sch.id,
                    class_id: sch.class_id,
                    subject_id: sch.subject_id,
                    school_id: sch.school_id,
                    class_name: sch.nama_kelas,
                    subject_name: sch.nama_mapel,
                    jam_mulai: sch.jam_mulai,
                    jam_selesai: sch.jam_selesai,
                    school_name: sch.nama_sekolah,
                  };

                  // Card button clickable from 5 minutes before jam_mulai
                  const now = new Date();
                  const [mh, mm] = sch.jam_mulai.split(':').map(Number);
                  const [eh, em] = sch.jam_selesai.split(':').map(Number);
                  const startWindow = new Date(now);
                  startWindow.setHours(mh, mm, 0, 0);
                  startWindow.setMinutes(startWindow.getMinutes() - 5);
                  const endDeadline = new Date(now);
                  endDeadline.setHours(eh, em, 0, 0);
                  const canClickCard = now >= startWindow;
                  const isExpired = now > endDeadline && !isCompleted && !isInProgress;

                  const cardBg = isCompleted
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : isInProgress
                    ? 'border-amber-300 bg-amber-50/30'
                    : isExpired
                    ? 'border-rose-300 bg-rose-50/50'
                    : 'border-gray-200 hover:border-violet-300 hover:shadow-md';
                  const pulseBorder = shouldPulse || isExpired ? ' animate-pulse-glow-orange' : '';

                  return (
                    <div
                      key={sch.id}
                      className={`bg-white border rounded-xl p-4 transition-all${cardBg}${pulseBorder}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="font-bold text-gray-900">{sch.nama_mapel}</div>
                          <div className="text-sm text-gray-500">Kelas {sch.nama_kelas}</div>
                          <div className="text-xs text-gray-400 mt-1">
                            ⏱️ {sch.jam_mulai} - {sch.jam_selesai}
                          </div>
                        </div>
                        {isCompleted && (
                          <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded-lg">
                            ✓ Selesai
                          </span>
                        )}
                        {isInProgress && !isCompleted && (
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-lg">
                            🔄 Sedang Mengajar
                          </span>
                        )}
                        {isExpired && !isInProgress && !isCompleted && (
                          <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-lg animate-pulse">
                            ⚠️ Waktu Habis
                          </span>
                        )}
                      </div>
                      {/* Card action */}
                      {isCompleted ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            Jurnal tersimpan
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('openSelesaiMengajar', {
                              detail: { scheduleId: sch.id, schedule: scheduleInfo }
                            }));
                          }}
                          disabled={!canClickCard && !isInProgress && !isExpired}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                            isExpired
                              ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md hover:shadow-lg animate-pulse'
                              : isInProgress
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md hover:shadow-lg'
                              : canClickCard
                              ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                          title={
                            isExpired
                              ? 'Waktu habis — selesaikan sekarang!'
                              : isInProgress
                              ? 'Lanjutkan Mengajar'
                              : canClickCard
                              ? 'Mulai Mengajar'
                              : `Buka 5 menit sebelum ${sch.jam_mulai}`
                          }
                        >
                          <IconClock size={14} />
                          <span>
                            {isExpired
                              ? '⚠️ Selesaikan Sekarang'
                              : isInProgress
                              ? 'Lanjutkan'
                              : canClickCard
                              ? 'Mulai Mengajar'
                              : `Buka ${sch.jam_mulai}`}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Bagian 4 — Aktivitas Terbaru + Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">Aktivitas Terbaru</h2>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {recentActivities.map((activity: any, i: number) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-lg">{activity.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{activity.desc}</p>
                    <p className="text-xs text-gray-400">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCurrentModule("supervisi_analitik")}
              className="text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors cursor-pointer"
            >
              Lihat Semua →
            </button>
          </div>

          {/* Checklist (existing) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Ceklis Harian</h3>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                {progressPercent}%
              </span>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {ceklisTasks.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Belum ada tugas</p>
                ) : (
                  ceklisTasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-2 py-1.5 group">
                      <label className="flex items-center gap-2 min-w-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTask(task.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                        />
                        <span className={`text-xs truncate ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {task.text}
                        </span>
                      </label>
                      <button onClick={() => removeTask(task.id)} className="text-gray-300 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition cursor-pointer">
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <input
                  type="text"
                  value={newCeklisTask}
                  onChange={(e) => setNewCeklisTask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
                  placeholder="Tambah tugas..."
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-violet-500 focus:outline-none"
                />
                <button onClick={addTask} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition cursor-pointer">
                  Tambah
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSchedulerModule = () => {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-fadeIn no-print">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-3xl p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg shadow-indigo-100">
          <div>
            <h2 className="text-xl font-black font-sans tracking-tight">⏰ Pengingat &amp; Jadwal Dinamis</h2>
            <p className="text-xs text-indigo-100 font-medium mt-1">Jadwalkan aktivitas mengajar Anda secara dinamis dan terima notifikasi real-time tepat waktu.</p>
          </div>
          <div className="bg-white/20 px-4 py-2 rounded-2xl text-xs font-bold font-sans">
            🔔 Browser Push: {typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" ? "✅ AKTIF" : "❌ NONAKTIF"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Add Schedule */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4 h-fit">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
              <span>📅</span> Buat Pengingat Baru
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nama Aktivitas / Kegiatan</label>
                <input
                  type="text"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                  placeholder="Contoh: Rapat Ujian / KBM Kelas XI..."
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Tanggal &amp; Waktu Kegiatan</label>
                <input
                  type="datetime-local"
                  value={schedDateTime}
                  onChange={(e) => setSchedDateTime(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-white font-medium text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <button
                onClick={addSchedulerItem}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>➕</span>
                <span>Jadwalkan Pengingat</span>
              </button>
            </div>

            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 text-[11px] text-indigo-800 space-y-2 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-xs text-indigo-950">
                <span>💡</span> Informasi Notifikasi
              </div>
              <p>GuruPRO memantau jadwal aktifitas Anda di latar belakang secara real-time. Pastikan Anda mengizinkan hak akses notifikasi browser agar pengingat dapat muncul di sudut layar laptop / HP Anda.</p>
            </div>
          </div>

          {/* Column 2 & 3: List & History */}
          <div className="lg:col-span-2 space-y-6">
            {/* List Active Reminders */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <span>⏳</span> Daftar Kegiatan Terjadwal ({schedulers.length})
              </h3>

              {schedulers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-semibold text-xs">Belum ada pengingat terjadwal. Silakan buat di kolom sebelah kiri.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-sans">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="pb-3">Kegiatan</th>
                        <th className="pb-3">Waktu</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {schedulers.map((item) => {
                        const dateStr = new Date(item.dateTime).toLocaleString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        });
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/30 transition">
                            <td className="py-3.5 font-bold text-slate-800 flex items-center gap-2">
                              <span>⏰</span>
                              <span>{item.title}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 font-medium">{dateStr}</td>
                            <td className="py-3.5">
                              {item.notified ? (
                                <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg font-bold text-[10px] border border-emerald-100">
                                  ✅ Terkirim
                                </span>
                              ) : (
                                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg font-bold text-[10px] border border-amber-100 animate-pulse">
                                  ⏳ Menunggu
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-right">
                              <button
                                onClick={() => deleteSchedulerItem(item.id)}
                                className="text-red-500 hover:text-red-700 font-bold hover:underline transition cursor-pointer"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* In-app notification center logs */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <span>📝</span> Riwayat Log Notifikasi Sistem
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 font-semibold text-xs">Belum ada riwayat notifikasi.</div>
                ) : (
                  notificationsPager.pagedItems.map((notif) => (
                    <div key={notif.id} className="pt-3 flex justify-between items-start gap-4 text-left">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs">🔔</span>
                          <span className="font-bold text-slate-800 text-xs">{notif.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed pl-5">{notif.body}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">{notif.date}</span>
                    </div>
                  ))
                )}
              </div>
              {notificationsPager.total > 0 && (
                <div className="border-t border-slate-100 mt-1">
                  <Pagination
                    page={notificationsPager.page}
                    pageSize={notificationsPager.pageSize}
                    total={notificationsPager.total}
                    totalPages={notificationsPager.totalPages}
                    onPageChange={(p) => notificationsPager.reset(p)}
                    onPageSizeChange={(s) => {
                      notificationsPager.setPageSize(s);
                      notificationsPager.reset(1);
                    }}
                    loading={false}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStorageSayaModule = () => {
    if (isSubscriptionExpired()) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-100 rounded-3xl text-center space-y-4 max-w-lg mx-auto mt-10 shadow-lg shadow-slate-100/50">
          <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 text-3xl">
            🔒
          </div>
          <h3 className="text-lg font-bold text-slate-850 font-sans">Penyimpanan Terkunci</h3>
          <p className="text-xs text-slate-500 leading-normal font-medium font-sans">
            Masa aktif paket berlangganan Anda telah berakhir. Seluruh data administrasi, bank soal, jurnal, dan nilai Anda tersimpan dengan aman di server kami. Silakan perbarui langganan Anda untuk membuka akses penyimpanan dan data dokumen.
          </p>
          <button
            onClick={() => window.location.href = "/profile?tab=billing"}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
          >
            Perbarui Langganan Sekarang
          </button>
        </div>
      );
    }
    const rppCount = allExplorerDocs.filter((d) => ["rpp", "modul", "silabus", "lkpd", "laporan_lkpd", "bahan_ajar"].includes(d.tipe_dokumen)).length;
    const soalCount = allExplorerDocs.filter((d) => d.tipe_dokumen === "soal").length;
    const journalCount = allExplorerJournals.length;
    const assessmentCount = allExplorerAssessments.length;
    const dokumenBuktiCount = allExplorerDokumenBukti.length;

    let displayedFiles: any[] = [];
    if (openExplorerFolder === "administrasi") {
      displayedFiles = allExplorerDocs.filter(
        (d) =>
          ["rpp", "modul", "silabus", "lkpd", "laporan_lkpd", "bahan_ajar"].includes(d.tipe_dokumen) &&
          (d.judul_dokumen || "").toLowerCase().includes(explorerSearch.toLowerCase())
      );
    } else if (openExplorerFolder === "soal") {
      displayedFiles = allExplorerDocs.filter(
        (d) =>
          d.tipe_dokumen === "soal" &&
          (d.judul_dokumen || "").toLowerCase().includes(explorerSearch.toLowerCase())
      );
    } else if (openExplorerFolder === "jurnal") {
      displayedFiles = allExplorerJournals.filter((j) => {
        const title = `Jurnal - ${j.nama_mapel} Kelas ${j.nama_kelas} (${j.tanggal})`;
        return title.toLowerCase().includes(explorerSearch.toLowerCase());
      });
    } else if (openExplorerFolder === "nilai") {
      displayedFiles = allExplorerAssessments.filter((a) => {
        const title = `${a.nama_asesmen} - Kelas ${a.nama_kelas} (${a.nama_mapel})`;
        return title.toLowerCase().includes(explorerSearch.toLowerCase());
      });
    } else if (openExplorerFolder === "file_saya") {
      displayedFiles = allExplorerDokumenBukti.filter((d) => {
        const title = d.judul;
        return title.toLowerCase().includes(explorerSearch.toLowerCase());
      });
    }

    const handleDeleteExplorerFile = async (file: any) => {
      if (!confirm("Apakah Anda yakin ingin menghapus berkas ini secara permanen dari database?")) return;
      try {
        let url = "";
        if (openExplorerFolder === "administrasi" || openExplorerFolder === "soal") {
          url = `/api/administrasi?id=${file.id}`;
        } else if (openExplorerFolder === "jurnal") {
          url = `/api/journals?id=${file.id}`;
        } else if (openExplorerFolder === "nilai") {
          url = `/api/assessments?id=${file.id}`;
        } else if (openExplorerFolder === "file_saya") {
          url = `/api/dokumen-bukti?id=${file.id}`;
        }

        const response = await apiFetch(url, { method: "DELETE" });
        if (response.ok) {
          showSuccess("Berkas berhasil dihapus secara permanen!");
          fetchExplorerData();
          if (selectedExplorerFile?.id === file.id) {
            setSelectedExplorerFile(null);
          }
        } else {
          showError("Gagal menghapus berkas.");
        }
      } catch (err: any) {
        showError("Koneksi bermasalah.");
      }
    };

    return (
      <div className="space-y-6 animate-fadeIn font-sans">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <span className="cursor-pointer hover:text-indigo-600" onClick={() => { setOpenExplorerFolder("root"); setExplorerSearch(""); }}>📂 Storage Saya</span>
              {openExplorerFolder !== "root" && (
                <>
                  <span>/</span>
                  <span className="text-slate-700 capitalize">
                    {openExplorerFolder === "administrasi" ? "Administrasi & RPP" : 
                     openExplorerFolder === "soal" ? "Bank Soal Ujian" : 
                     openExplorerFolder === "jurnal" ? "Jurnal Mengajar" : 
                     openExplorerFolder === "file_saya" ? "File Saya" : "Buku Nilai & Asesmen"}
                  </span>
                </>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">File Explorer</h3>
            <p className="text-xs text-slate-500 mt-0.5">Semua data dan berkas Anda tersusun rapi secara terstruktur.</p>
          </div>

          {openExplorerFolder !== "root" && (
            <button
              onClick={() => { setOpenExplorerFolder("root"); setExplorerSearch(""); }}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer font-sans"
            >
              ← Kembali ke Root
            </button>
          )}
        </div>

        {isLoadingExplorer ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-slate-400">Memuat berkas...</p>
          </div>
        ) : openExplorerFolder === "root" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
            <div 
              onClick={() => setOpenExplorerFolder("administrasi")}
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-indigo-400 rounded-3xl p-6 text-left transition duration-300 shadow-sm hover:shadow-[0_8px_30px_rgb(99,102,241,0.04)] cursor-pointer group flex flex-col justify-between h-[180px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl group-hover:scale-110 transition duration-300">
                📁
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">Administrasi &amp; RPP</h4>
                <p className="text-[10px] text-slate-400 font-medium">RPP, Modul, Silabus</p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>{rppCount} Berkas</span>
                <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition">Buka →</span>
              </div>
            </div>

            <div 
              onClick={() => setOpenExplorerFolder("soal")}
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-indigo-400 rounded-3xl p-6 text-left transition duration-300 shadow-sm hover:shadow-[0_8px_30px_rgb(99,102,241,0.04)] cursor-pointer group flex flex-col justify-between h-[180px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl group-hover:scale-110 transition duration-300">
                📁
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">Bank Soal Ujian</h4>
                <p className="text-[10px] text-slate-400 font-medium">Naskah Soal &amp; Kunci</p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>{soalCount} Berkas</span>
                <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition">Buka →</span>
              </div>
            </div>

            <div 
              onClick={() => setOpenExplorerFolder("jurnal")}
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-indigo-400 rounded-3xl p-6 text-left transition duration-300 shadow-sm hover:shadow-[0_8px_30px_rgb(99,102,241,0.04)] cursor-pointer group flex flex-col justify-between h-[180px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl group-hover:scale-110 transition duration-300">
                📁
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">Jurnal Mengajar</h4>
                <p className="text-[10px] text-slate-400 font-medium">Laporan Agenda KBM</p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>{journalCount} Berkas</span>
                <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition">Buka →</span>
              </div>
            </div>

            <div 
              onClick={() => setOpenExplorerFolder("nilai")}
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-indigo-400 rounded-3xl p-6 text-left transition duration-300 shadow-sm hover:shadow-[0_8px_30px_rgb(99,102,241,0.04)] cursor-pointer group flex flex-col justify-between h-[180px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl group-hover:scale-110 transition duration-300">
                📁
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">Buku Nilai &amp; Asesmen</h4>
                <p className="text-[10px] text-slate-400 font-medium">Buku Nilai &amp; KKM Siswa</p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>{assessmentCount} Berkas</span>
                <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition">Buka →</span>
              </div>
            </div>

            <div 
              onClick={() => setOpenExplorerFolder("file_saya")}
              className="bg-white hover:bg-slate-50 border border-slate-200/80 hover:border-indigo-400 rounded-3xl p-6 text-left transition duration-300 shadow-sm hover:shadow-[0_8px_30px_rgb(99,102,241,0.04)] cursor-pointer group flex flex-col justify-between h-[180px]"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl group-hover:scale-110 transition duration-300">
                📁
              </div>
              <div className="space-y-1 mt-4">
                <h4 className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition">File Saya</h4>
                <p className="text-[10px] text-slate-400 font-medium">File Upload</p>
              </div>
              <div className="border-t border-slate-100 pt-3 mt-3 flex justify-between items-center text-[10px] text-slate-400 font-bold">
                <span>{dokumenBuktiCount} Berkas</span>
                <span className="text-indigo-500 opacity-0 group-hover:opacity-100 transition">Buka →</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex max-w-sm">
              <input 
                type="text"
                value={explorerSearch}
                onChange={(e) => setExplorerSearch(e.target.value)}
                placeholder="Cari nama berkas..."
                className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none bg-white font-medium text-slate-800 placeholder-slate-400"
              />
            </div>

            {displayedFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-50 border border-slate-200 border-dashed rounded-3xl text-slate-400 gap-2">
                <span className="text-3xl">📄</span>
                <span className="text-xs font-bold">Tidak ada berkas yang ditemukan.</span>
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-400 font-extrabold uppercase border-b border-slate-200">
                        <th className="px-6 py-4">Nama Berkas</th>
                        <th className="px-6 py-4">Tanggal / Waktu</th>
                        <th className="px-6 py-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                      {displayedFiles.map((file) => {
                        let title = "";
                        let dateText = "";
                        
                        if (openExplorerFolder === "administrasi" || openExplorerFolder === "soal") {
                          title = file.judul_dokumen;
                          dateText = file.tanggal_kegiatan || new Date(file.created_at).toLocaleDateString("id-ID");
                        } else if (openExplorerFolder === "jurnal") {
                          title = `Jurnal - ${file.nama_mapel} Kelas ${file.nama_kelas}`;
                          dateText = file.tanggal;
                        } else if (openExplorerFolder === "nilai") {
                          title = `${file.nama_asesmen} - Kelas ${file.nama_kelas} (${file.nama_mapel})`;
                          dateText = new Date(file.created_at).toLocaleDateString("id-ID");
                        } else if (openExplorerFolder === "file_saya") {
                          title = file.judul;
                          dateText = file.tanggal_dokumen ? new Date(file.tanggal_dokumen).toLocaleDateString("id-ID") : new Date(file.created_at).toLocaleDateString("id-ID");
                        }

                        return (
                          <tr key={file.id} className="hover:bg-slate-50/50 transition">
                            <td className={`px-6 py-4 font-bold flex items-center gap-2 ${
                              isSubscriptionExpiredOver30Days() ? "text-slate-400 line-through" : "text-slate-800"
                            }`}>
                              <span>{isSubscriptionExpiredOver30Days() ? "🔒" : "📄"}</span>
                              <span className="truncate max-w-md">{title}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-400">{dateText}</td>
                            <td className="px-6 py-4 text-right space-x-2 shrink-0">
                              <button
                                onClick={() => {
                                  if (isSubscriptionExpiredOver30Days()) {
                                    showError("Dokumen ini telah diarsipkan karena masa aktif langganan Anda berakhir lebih dari 30 hari yang lalu. Perpanjang paket premium untuk mengakses kembali berkas Anda.");
                                    return;
                                  }
                                  setSelectedExplorerFile(file);
                                }}
                                className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-[10px] transition cursor-pointer font-sans"
                              >
                                Lihat Berkas
                              </button>
                              <button
                                onClick={() => handleDeleteExplorerFile(file)}
                                className="px-3 py-1.5 bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 rounded-lg font-bold text-[10px] transition cursor-pointer font-sans"
                              >
                                Hapus
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const isQuotaError = !!(
    errorMsg && (
      errorMsg.includes("429") || 
      errorMsg.includes("quota") || 
      errorMsg.includes("Quota") || 
      errorMsg.includes("limit") || 
      errorMsg.includes("Requests") || 
      errorMsg.includes("rate-limits")
    )
  );

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-24 lg:pb-6 flex flex-col gap-6 text-slate-800 print:bg-white print:p-0 print:gap-0 font-sans">

      {showOnboarding && (
        <OnboardingWizard onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      )}

      {/* CSS Cetak Khusus */}
      <style jsx global>{`
        @media print {
          aside, button, .no-print, header, nav, .reorder-panel {
            display: none !important;
          }
          main {
            display: block !important;
            background: white !important;
            padding: 0 !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-card {
            page-break-inside: avoid;
            border: none !important;
            border-bottom: 1px dashed #ccc !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 1.5rem 0 !important;
          }
        }
      `}</style>

      {/* Dynamic Accent Color Stylesheet */}
      {brandingConfig?.accent_color && (
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --primary-accent: ${brandingConfig.accent_color};
          }
          .text-indigo-600 { color: ${brandingConfig.accent_color} !important; }
          .text-indigo-650 { color: ${brandingConfig.accent_color} !important; }
          .text-indigo-700 { color: ${brandingConfig.accent_color} !important; }
          .bg-indigo-550 { background-color: ${brandingConfig.accent_color} !important; }
          .bg-indigo-600 { background-color: ${brandingConfig.accent_color} !important; }
          .bg-indigo-650 { background-color: ${brandingConfig.accent_color} !important; }
          .bg-indigo-700 { background-color: ${brandingConfig.accent_color}dd !important; }
          .hover\\:bg-indigo-700:hover { background-color: ${brandingConfig.accent_color}ee !important; }
          .hover\\:text-indigo-600:hover { color: ${brandingConfig.accent_color} !important; }
          .border-indigo-150 { border-color: ${brandingConfig.accent_color}30 !important; }
          .border-indigo-200 { border-color: ${brandingConfig.accent_color}50 !important; }
          .border-indigo-300 { border-color: ${brandingConfig.accent_color}80 !important; }
          .ring-indigo-150 { --tw-ring-color: ${brandingConfig.accent_color}50 !important; }
          .ring-indigo-300 { --tw-ring-color: ${brandingConfig.accent_color}80 !important; }
        ` }} />
      )}

      {/* SUBSCRIPTION REMINDER BANNERS */}
      {currentUser && (
        <div className="no-print space-y-3">
          {/* Expired PRO Banner */}
          {isSubscriptionExpired() && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-5 py-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 text-lg shrink-0">🚨</div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 font-sans">Masa Langganan PRO Anda Telah Habis</h4>
                  <p className="text-xs text-rose-600/90 mt-0.5">Akses premium ke pembuatan soal AI dan RPP terhenti. Lakukan perpanjangan sekarang untuk memulihkan akses.</p>
                </div>
              </div>
              <button
                onClick={handlePerpanjangClick}
                className="px-4.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl shadow-md transition whitespace-nowrap cursor-pointer shrink-0"
              >
                ⚡ Perpanjang Sekarang
              </button>
            </div>
          )}

          {/* Expiring Soon Banner (<= 7 days remaining) */}
          {!isSubscriptionExpired() && isSubscriptionExpiringSoon() && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-5 py-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 text-lg shrink-0">⏳</div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 font-sans">Masa Langganan PRO Berakhir Segera</h4>
                  <p className="text-xs text-amber-600/90 mt-0.5">
                    Sisa waktu aktif Anda: <strong className="font-mono text-amber-800">{getSubscriptionCountdown()}</strong>. Hindari gangguan KBM dengan memperpanjang paket Anda.
                  </p>
                </div>
              </div>
              <button
                onClick={handlePerpanjangClick}
                className="px-4.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md transition whitespace-nowrap cursor-pointer shrink-0"
              >
                ⚡ Perpanjang Sekarang
              </button>
            </div>
          )}

          {/* Free Trial Banner */}
          {(!currentUser.status_langganan || currentUser.status_langganan === 'free') && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50/50 border border-indigo-100 text-indigo-900 px-5 py-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg shrink-0">⚡</div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 font-sans">Akun Anda berstatus Uji Coba Gratis (Free Trial)</h4>
                  <p className="text-xs text-indigo-600/90 mt-0.5">Upgrade ke GuruPRO AI Premium untuk menghilangkan batas kuota pembuatan soal AI dan mengakses modul ajar tanpa batas.</p>
                </div>
              </div>
              <button
                onClick={handlePerpanjangClick}
                className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition whitespace-nowrap cursor-pointer shrink-0 animate-bounce"
              >
                👑 Upgrade ke PRO
              </button>
            </div>
          )}
        </div>
      )}

      {/* Toast Notifications */}
      {successMsg && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl animate-bounce">
          ✅ {successMsg}
        </div>
      )}
      {errorMsg && !isQuotaError && (
        <div className="fixed top-6 right-6 z-50 bg-rose-600 text-white font-bold text-sm px-6 py-3.5 rounded-2xl shadow-xl animate-pulse">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* QUOTA LIMIT ERROR MODAL (ERROR 429) */}
      {errorMsg && isQuotaError && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg p-6 shadow-2xl animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-xl mb-4">
              🚨
            </div>
            <h3 className="text-base font-bold text-slate-900">Batas Kuota Gemini API Terlampaui (Error 429)</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Google AI Studio membatasi request untuk pengguna kunci API tingkat gratis (<strong>Free Tier</strong>). Pesan kesalahan dari server:
            </p>
            <div className="mt-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-mono text-rose-700 break-words leading-normal max-h-32 overflow-y-auto">
              {errorMsg}
            </div>
            
            <h4 className="text-xs font-bold text-slate-800 mt-4 font-semibold">Penyebab &amp; Solusi:</h4>
            <div className="mt-2 space-y-3 text-xs text-slate-600">
              <div className="flex gap-2">
                <span className="font-bold text-indigo-600">1.</span>
                <p>
                  <strong>Batas Kecepatan Per Menit (Rate Limit RPM):</strong> Kunci API gratis dibatasi sekitar 15 request per menit. 
                  <br /><span className="text-slate-400">Solusi:</span> Silakan <strong>tunggu 30-60 detik</strong> lalu klik tombol buat soal kembali.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-indigo-600">2.</span>
                <p>
                  <strong>Kuota Harian Habis (Daily Quota):</strong> Model <code>gemini-2.5-flash</code> pada tingkat gratis dibatasi hanya <strong>20 request per hari</strong>. Jika kuota harian habis, Anda harus menunggu hingga hari berikutnya atau beralih ke berbayar.
                  <br /><span className="text-slate-400">Solusi Premium:</span> Aktifkan penagihan (<strong>Pay-as-you-go</strong>) di Google AI Studio. Biayanya sangat murah (hanya sekitar Rp 1,50 per 1.000 poin input).
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-grow py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                🌐 Buka Google AI Studio
              </a>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {currentModule === 'soal' && (
        <div className="flex flex-col lg:flex-row gap-6 items-stretch flex-grow w-full min-h-0 lg:min-h-[calc(100vh-8rem)]">
          {/* Panel Kiri - Form Config */}
          <div className={`w-full lg:w-1/3 ${mobileTab === 'config' ? 'block' : 'hidden lg:block'} no-print shrink-0`}>
            <Sidebar 
              onGenerate={handleGenerate} 
              isLoading={isLoading} 
              schools={schools}
            />
          </div>

      {/* Panel Kanan - Dashboard Preview */}
      <div className={`flex-1 ${mobileTab === 'preview' ? 'block' : 'hidden lg:block'} print:block`}>
        <div className="bg-white/70 backdrop-blur-md rounded-[32px] border border-slate-200/60 shadow-[0_8px_32px_rgba(31,38,135,0.03)] p-6 lg:p-8 flex flex-col print:border-none print:shadow-none print:p-0 print:container min-h-full transition-all duration-300">
        
        {/* KOP SOAL UJIAN (Hanya Tampil Saat Cetak / Print) */}
        {/* KOP SOAL UJIAN (Hanya Tampil Saat Cetak / Print) */}
        {soalList.length > 0 && (() => {
          const selectedSchoolObj = schools.find((s) => s.nama_sekolah === metaInfo.namaSekolah);
          return (
            <div className="hidden print:block border-b-4 border-double border-slate-900 pb-4 mb-6">
              <div className="flex items-center gap-4 border-b border-slate-300 pb-3 mb-3">
                {selectedSchoolObj?.logo && (
                  <Image src={selectedSchoolObj.logo} alt="Logo Sekolah" width={64} height={64} className="object-contain" />
                )}
                <div className="flex-1 text-center font-serif text-black">
                  <h2 className="text-[9px] font-bold tracking-widest uppercase">YAYASAN / DINAS PENDIDIKAN</h2>
                  <h1 className="text-base font-black tracking-wide uppercase">{metaInfo.namaSekolah || "INSTITUSI GURU PRO"}</h1>
                  <p className="text-[10px] text-slate-700 leading-relaxed">
                    {selectedSchoolObj?.alamat || "Alamat sekolah belum diatur secara lengkap."}
                    {selectedSchoolObj?.npsn && ` | NPSN: ${selectedSchoolObj.npsn}`}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-start text-xs font-serif text-black pt-2">
                <div>
                  <h3 className="text-xs font-bold tracking-wide uppercase">ASESMEN SUMATIF HASIL BELAJAR</h3>
                  <p className="text-[9px] text-gray-500">Dibuat otomatis via AI GuruPRO</p>
                  {selectedSchoolObj?.nama_kepala_sekolah && (
                    <p className="text-[9px] text-gray-700 mt-1">Kepala Sekolah: {selectedSchoolObj.nama_kepala_sekolah}</p>
                  )}
                </div>
                <div className="text-right">
                  <table className="text-left text-[10px] ml-auto">
                    <tbody>
                      <tr><td className="pr-2 font-semibold">Mata Pelajaran</td><td>: {metaInfo.mapel || "Umum"}</td></tr>
                      <tr><td className="pr-2 font-semibold">Kelas/Jenjang</td><td>: {metaInfo.kelas ? `Kelas ${metaInfo.kelas}` : "-"} ({metaInfo.jenjang || "-"})</td></tr>
                      <tr><td className="pr-2 font-semibold">Guru Pengampu</td><td>: {metaInfo.namaGuru || "Pendidik GuruPRO"}</td></tr>
                      <tr><td className="pr-2 font-semibold">Nama Siswa</td><td>: ___________________________</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {metaInfo.topik && (
                <div className="text-center mt-3 font-semibold text-xs border-t border-slate-200 pt-2 font-serif text-black">
                  Materi Utama: {metaInfo.topik}
                </div>
              )}
            </div>
          );
        })()}

        {/* LOADING STATE */}
        {isLoading && (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <div className="relative w-20 h-20 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin"></div>
            </div>
            <h3 className="text-lg font-bold text-slate-800 animate-bounce">Merumuskan Soal Terbaik...</h3>
            <p className="text-slate-500 text-sm mt-2 text-center max-w-sm font-semibold text-indigo-600">
              {loadingProgress}
            </p>
            <p className="text-slate-400 text-xs mt-1 text-center max-w-xs leading-relaxed">
              GuruPRO AI sedang memproses topik, menyesuaikan tingkat kesulitan kognitif, dan menyusun butir soal berkualitas tinggi.
            </p>
          </div>
        )}

        {/* EMPTY STATE */}
        {!isLoading && soalList.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6 border border-slate-100 shadow-inner">
              <span className="text-4xl">✨</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Selamat datang di {brandingConfig?.app_name || "GuruPRO"}</h2>
            <p className="text-slate-500 mt-2 max-w-md text-sm leading-relaxed">
              Mulai administrasi pendidikan Anda dengan mudah. Isi formulir konfigurasi di panel sebelah kiri untuk membuat soal ujian otomatis berbasis AI.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full max-w-2xl">
              <div className="p-5 border border-slate-150 rounded-[24px] bg-slate-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-left">
                <span className="text-xl">🛠️</span>
                <h4 className="font-bold text-xs text-slate-800 mt-2">Dukungan Multi-Kurikulum</h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Merdeka, KBC, K13, hingga Hybrid.</p>
              </div>
              <div className="p-5 border border-slate-150 rounded-[24px] bg-slate-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-left">
                <span className="text-xl">🧠</span>
                <h4 className="font-bold text-xs text-slate-800 mt-2">Taksonomi Bloom & HOTS</h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Sesuaikan tingkat berpikir dari C1 hingga C6 secara mudah.</p>
              </div>
              <div className="p-5 border border-slate-150 rounded-[24px] bg-slate-50/40 hover:bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 transform hover:-translate-y-0.5 cursor-pointer text-left">
                <span className="text-xl">📄</span>
                <h4 className="font-bold text-xs text-slate-800 mt-2">Siap Cetak & Ekspor</h4>
                <p className="text-[10px] text-slate-500 mt-1 leading-normal">Tata letak rapi, ramah kertas, dan siap salin ke editor Anda.</p>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS STATE */}
        {!isLoading && soalList.length > 0 && (
          <div className="flex-1 flex flex-col">
            
            {/* TABS NAVIGATION (Premium style) */}
            <div className="flex flex-wrap gap-2 mb-6 no-print bg-slate-50/50 p-1.5 rounded-3xl border border-slate-150/50">
              {[
                { id: "soal", label: "📄 Soal Ujian", color: "indigo" },
                { id: "kunci", label: "🔑 Kunci & Pembahasan", color: "emerald" },
                { id: "kisikisi", label: "📋 Kisi-kisi Ujian", color: "blue" },
                { id: "kuis", label: "🎮 Uji Coba Kuis", color: "amber" },
                { id: "analisis", label: "📊 Analisis & Statistik", color: "rose" },
                { id: "promptgambar", label: "🎨 Prompt Gambar AI", color: "purple" },
                { id: "history", label: "🕐 Riwayat", color: "slate" }
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2.5 text-xs font-bold rounded-2xl transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/15"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Aksi Cepat Dashboard (Print/Copy) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6 no-print">
              <div>
                <h2 className="text-lg font-bold text-slate-900 uppercase">
                  {activeTab === 'soal' && 'Lembar Soal Ujian'}
                  {activeTab === 'kunci' && 'Kunci Jawaban & Pembahasan'}
                  {activeTab === 'kisikisi' && 'Matriks Kisi-kisi Ujian'}
                  {activeTab === 'kuis' && 'Simulator Kuis Interaktif'}
                  {activeTab === 'analisis' && 'Analisis Asesmen & Statistik'}
                  {activeTab === 'promptgambar' && 'Generasi Prompt Gambar Visual'}
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">GuruPRO Dashboard v2.5</p>
              </div>
              
              <div className="flex flex-wrap gap-2 self-start md:self-auto">
                {activeTab === 'kunci' && (
                  <button 
                    onClick={() => setShowKunciAll(!showKunciAll)} 
                    className={`px-4 py-2 text-xs font-semibold rounded-xl border-2 transition flex items-center gap-1.5 ${showKunciAll ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'}`}
                  >
                    👁️ {showKunciAll ? 'Sembunyikan Semua Kunci' : 'Tampilkan Semua Kunci'}
                  </button>
                )}
                
                {['soal', 'kunci', 'kisikisi', 'analisis'].includes(activeTab) && (
                  <>
                    <button 
                      onClick={handleSaveSoalToStorage}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100"
                    >
                      💾 Simpan ke Storage
                    </button>
                    <button 
                      onClick={() => triggerExportWithReviewCheck(copyToClipboard)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      📋 Salin Teks
                    </button>
                    <button 
                      onClick={() => triggerExportWithReviewCheck(downloadWord)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      📝 Ekspor Word (.doc)
                    </button>
                    <button 
                      onClick={() => triggerExportWithReviewCheck(downloadPdf)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      📄 Ekspor PDF
                    </button>
                    <button
                      onClick={() => setIsImportSoalModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      📥 Import Soal
                    </button>
                    <button
                      onClick={() => triggerExportWithReviewCheck(exportToJSON)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      ⚙️ Ekspor JSON
                    </button>
                    <button 
                      onClick={() => triggerExportWithReviewCheck(exportToCBT)}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100 transition flex items-center gap-1.5 font-bold cursor-pointer"
                    >
                      🎓 Ekspor CBT
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* CUSTOM REORDERING PANEL (Only for Soal tab) */}
            {activeTab === "soal" && (
              <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 no-print">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-600">⚙️ Atur Posisi Soal:</span>
                  <button 
                    onClick={shuffleQuestions}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                  >
                    🎲 Acak Urutan Soal
                  </button>
                  <button 
                    onClick={() => setShowTypeSorter(!showTypeSorter)}
                    className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                  >
                    📊 Urutkan Berdasarkan Tipe
                  </button>
                </div>

                {showTypeSorter && (
                  <div className="w-full mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-fadeIn">
                    <p className="text-xs font-bold text-slate-700 mb-3">Atur Urutan Tipe Soal:</p>
                    <div className="flex flex-col gap-2 max-w-md">
                      {typeOrder.map((t, idx) => {
                        const count = soalList.filter(s => s.tipe === t).length;
                        if (count === 0) return null;
                        return (
                          <div key={t} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-xs font-semibold text-slate-800 capitalize">
                              {typeLabelsMap[t] || t} ({count} soal)
                            </span>
                            <div className="flex gap-1">
                              <button 
                                disabled={idx === 0} 
                                onClick={() => moveType(idx, 'up')}
                                className="w-6 h-6 rounded bg-white border border-slate-200 text-xs hover:bg-slate-50 disabled:opacity-40"
                              >
                                ⬆️
                              </button>
                              <button 
                                disabled={idx === typeOrder.length - 1} 
                                onClick={() => moveType(idx, 'down')}
                                className="w-6 h-6 rounded bg-white border border-slate-200 text-xs hover:bg-slate-50 disabled:opacity-40"
                              >
                                ⬇️
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button 
                      onClick={applyTypeSorting}
                      className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100"
                    >
                      Terapkan Urutan Tipe Soal
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENTS */}
            
            {/* 1. SOAL TAB */}
            {activeTab === "soal" && (
              <div className="space-y-6 flex-1">
                {/* Progress Peninjauan Banner */}
                <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 transition-all no-print ${
                  isAllReviewed 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 shadow-sm shadow-emerald-50/50' 
                    : 'bg-amber-50/80 border-amber-200 text-amber-800 shadow-sm shadow-amber-50/50'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{isAllReviewed ? '🎉' : '⚠️'}</span>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm">
                        {isAllReviewed ? 'Semua Soal Sudah Ditinjau!' : 'Tinjau Hasil Pembuatan Soal AI'}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 leading-normal font-medium">
                        {isAllReviewed 
                          ? 'Terima kasih telah meneliti kualitas soal. Seluruh soal aman untuk diekspor.' 
                          : 'AI dapat melakukan kesalahan. Silakan baca dan tandai diperiksa pada tiap soal sebelum diekspor.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end shrink-0">
                    <div className="flex-1 sm:w-28 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                      <div className={`h-full rounded-full transition-all duration-300 ${isAllReviewed ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${(totalReviewed / soalList.length) * 100}%` }}></div>
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap">{totalReviewed} / {soalList.length} Diperiksa</span>
                  </div>
                </div>
                {soalList.map((soal, index) => {
                  const typeColors: { [key: string]: string } = {
                    pg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    isian: 'bg-blue-50 text-blue-700 border-blue-100',
                    essay: 'bg-purple-50 text-purple-700 border-purple-100',
                    "pg-kompleks": 'bg-amber-50 text-amber-700 border-amber-100',
                    bs: 'bg-pink-50 text-pink-700 border-pink-100',
                    jodoh: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                    urutan: 'bg-teal-50 text-teal-700 border-teal-100',
                    tabel: 'bg-rose-50 text-rose-700 border-rose-100',
                    "sebab-akibat": 'bg-cyan-50 text-cyan-700 border-cyan-100'
                  };

                  const difficultyColors: { [key: string]: string } = {
                    mudah: 'bg-green-100 text-green-700',
                    sedang: 'bg-blue-100 text-blue-700',
                    sulit: 'bg-rose-100 text-rose-700'
                  };

                  const isRegenerating = regeneratingIndexes[index] || false;
                  const isReviewed = soal.id ? (reviewedQuestions[soal.id] || false) : false;

                  return (
                    <div 
                      key={soal.nomor || index} 
                      id={`card-soal-${index}`}
                      className={`p-6 border rounded-3xl transition-all duration-300 print-card relative ${
                        isReviewed 
                          ? 'border-slate-100 bg-slate-50/20 shadow-[0_2px_8px_rgba(0,0,0,0.01)]' 
                          : 'border-amber-300 bg-amber-50/10 shadow-[0_4px_12px_rgba(245,158,11,0.03)]'
                      }`}
                    >
                      {/* Meta */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 no-print">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-800">Pertanyaan {index + 1}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${typeColors[soal.tipe] || 'bg-slate-50 text-slate-700'}`}>
                            {typeLabelsMap[soal.tipe] || soal.tipe}
                          </span>
                          {soal.gambarData && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 border border-purple-200 text-purple-700" title="Sudah ada ilustrasi">
                              🎨 Gambar
                            </span>
                          )}
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all duration-200 ${
                            isReviewed 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : 'bg-amber-100 border-amber-200 text-amber-700 animate-pulse'
                          }`}>
                            {isReviewed ? '✓ Diperiksa' : '⚠️ Belum Diperiksa'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${difficultyColors[soal.tingkat] || 'bg-slate-100'}`}>
                            {soal.tingkat}
                          </span>
                          <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {soal.kognitif}
                          </span>
                        </div>
                      </div>

                      {/* Pertanyaan */}
                      <div className="text-slate-800 font-semibold leading-relaxed mb-4 text-base print:text-black print:text-sm">
                        {index + 1}. {soal.pertanyaan} <span className="text-xs font-normal italic text-slate-400 print:text-slate-500">(Tipe: {typeLabelsMap[soal.tipe] || soal.tipe})</span>
                      </div>

                      {/* AI Illustration Generation Card */}
                      {soal.gambar && soal.gambar.trim() && !/^(tidak ada|none|null|no image|tanpa gambar|-)$/i.test(soal.gambar.trim()) && (
                        <div className="mt-2 mb-4 bg-purple-50/60 border border-purple-100 rounded-2xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-purple-700"><i className="fa-solid fa-image mr-1"></i>Ilustrasi Deskripsi:</span>
                            <button 
                              disabled={generatingImageIndexes[index]}
                              onClick={() => handleGenerateImage(index, soal.gambar)}
                              className="text-[10px] font-bold px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition flex items-center gap-1.5 no-print disabled:opacity-50"
                            >
                              {generatingImageIndexes[index] ? (
                                <>⏳ Generating...</>
                              ) : (
                                <><i className="fa-solid fa-wand-magic-sparkles"></i> Generate Gambar</>
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-purple-800 leading-normal italic">"{soal.gambar}"</p>
                          {soal.gambarData && (
                            <div className="mt-3">
                              <Image src={soal.gambarData} alt="Generated" width={0} height={0} sizes="100vw" className="max-w-xs rounded-xl shadow-md border border-slate-200 w-full h-auto" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Opsi / Pilihan */}
                      {renderOpsiInList(soal)}

                      {/* CARD CONTROLS (Edit/Delete/Regen/Move) */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
                        <div className="flex items-center gap-3 justify-between sm:justify-start w-full sm:w-auto">
                          {/* Up/Down shifting */}
                          <div className="flex gap-1.5">
                            <button 
                              disabled={index === 0} 
                              onClick={() => moveQuestion(index, 'up')}
                              className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 transition flex items-center justify-center text-xs shadow-sm cursor-pointer"
                              title="Geser ke atas"
                            >
                              ⬆️
                            </button>
                            <button 
                              disabled={index === soalList.length - 1} 
                              onClick={() => moveQuestion(index, 'down')}
                              className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 transition flex items-center justify-center text-xs shadow-sm cursor-pointer"
                              title="Geser ke bawah"
                            >
                              ⬇️
                            </button>
                          </div>

                          {/* Verification Check Button */}
                          <button
                            type="button"
                            onClick={() => soal.id && setReviewedQuestions(prev => ({ ...prev, [soal.id]: !prev[soal.id] }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm border cursor-pointer ${
                              isReviewed
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:scale-105'
                            }`}
                          >
                            {isReviewed ? '✔️ Terverifikasi' : '🔍 Tandai Diperiksa'}
                          </button>
                        </div>

                        {/* Interactive Edit actions */}
                        <div className="flex gap-2 self-end sm:self-auto">
                          <button 
                            disabled={isRegenerating}
                            onClick={() => handleRegenerateSingle(index)}
                            className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 hover:bg-amber-100 transition flex items-center justify-center shadow-sm disabled:opacity-50 cursor-pointer"
                            title="Regenerasi soal dengan AI"
                          >
                            {isRegenerating ? "⏳" : "🔄"}
                          </button>
                          <button
                            onClick={() => openEditModal(index)}
                            className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 hover:bg-blue-100 transition flex items-center justify-center shadow-sm cursor-pointer"
                            title="Ubah"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={() => duplicateQuestion(index)}
                            className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 text-purple-600 hover:bg-purple-100 transition flex items-center justify-center shadow-sm cursor-pointer"
                            title="Duplikat"
                          >
                            👥
                          </button>
                          <button 
                            onClick={() => deleteQuestion(index)}
                            className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 transition flex items-center justify-center shadow-sm cursor-pointer"
                            title="Hapus"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. KUNCI & PEMBAHASAN TAB */}
            {activeTab === "kunci" && (
              <div className="space-y-6 flex-1">
                {soalList.map((soal, index) => {
                  const showKunci = showKunciAll || revealedKunci[index];
                  return (
                    <div key={index} className="p-6 border border-slate-100 rounded-2xl bg-slate-50/20 shadow-[0_2px_8px_rgba(0,0,0,0.01)] print-card">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-bold text-slate-800">Pertanyaan {index + 1}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200 uppercase">{typeLabelsMap[soal.tipe] || soal.tipe}</span>
                      </div>
                      
                      <p className="text-slate-700 text-sm font-medium mb-4">{soal.pertanyaan}</p>
                      
                      <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
                        <button 
                          onClick={() => toggleKunci(index)}
                          className="self-start text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 focus:outline-none no-print"
                        >
                          🔑 {showKunci ? 'Sembunyikan Kunci & Pembahasan' : 'Lihat Kunci & Pembahasan'}
                        </button>

                        {(showKunci || typeof window !== 'undefined' && window.matchMedia('print').matches) && (
                          <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 animate-fadeIn">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Kunci Jawaban</span>
                            <div className="mt-2 text-sm text-slate-800 font-bold leading-relaxed">
                              {soal.tipe === 'jodoh' 
                                ? renderJodohAnswers(soal.kunci)
                                : Array.isArray(soal.kunci) 
                                  ? soal.kunci.join(", ") 
                                  : String(soal.kunci)}
                            </div>
                            
                            {soal.pembahasan && (
                              <div className="mt-3 pt-3 border-t border-emerald-100/50">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Pembahasan:</span>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{soal.pembahasan}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. KISI-KISI TAB */}
            {activeTab === "kisikisi" && (
              <div className="flex flex-col flex-1">
                {/* Export Header */}
                <div className="flex justify-end mb-3 no-print">
                  <button
                    onClick={() => setIsKisikisiExportModalOpen(true)}
                    disabled={soalList.length === 0}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    📋 Export Kisi-kisi
                  </button>
                </div>
                <div className="overflow-x-auto flex-1 border border-slate-200 rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse bg-white text-xs text-slate-700 print:text-black">
                  <thead className="bg-indigo-50 text-indigo-900 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold border-r border-slate-200" style={{ width: "100px" }}>Bagian / Tipe</th>
                      <th className="p-3 font-bold border-r border-slate-200 text-center" style={{ width: "40px" }}>No</th>
                      <th className="p-3 font-bold border-r border-slate-200">Materi Pokok / Elemen</th>
                      <th className="p-3 font-bold border-r border-slate-200">Capaian Pembelajaran (CP)</th>
                      <th className="p-3 font-bold border-r border-slate-200">Indikator Soal</th>
                      <th className="p-3 font-bold border-r border-slate-200 text-center" style={{ width: "50px" }}>Level</th>
                      <th className="p-3 font-bold border-r border-slate-200 text-center" style={{ width: "60px" }}>Kesulitan</th>
                      <th className="p-3 font-bold border-r border-slate-200 text-center" style={{ width: "55px" }}>Kunci</th>
                      <th className="p-3 font-bold text-center" style={{ width: "40px" }}>Skor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soalList.map((s, idx) => {
                      let kunciSingkat = "-";
                      if (s.tipe === "pg" || s.tipe === "bs" || s.tipe === "sebab-akibat") {
                        kunciSingkat = String(s.kunci || "").substring(0, 5).toUpperCase();
                      } else if (Array.isArray(s.kunci)) {
                        kunciSingkat = s.kunci.join(", ").substring(0, 10);
                      } else {
                        kunciSingkat = String(s.kunci || "-").substring(0, 15);
                      }

                      return (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50 transition">
                          <td className="p-3 font-semibold border-r border-slate-200 capitalize bg-slate-50/50">{typeLabelsMap[s.tipe] || s.tipe}</td>
                          <td className="p-3 text-center border-r border-slate-200 font-semibold">{idx + 1}</td>
                          <td className="p-3 border-r border-slate-200 leading-normal">{s.elemen || "-"}</td>
                          <td className="p-3 border-r border-slate-200 leading-normal">
                            {s.cp && <div className="mb-1"><span className="font-semibold text-indigo-600">CP:</span> {s.cp}</div>}
                            {s.tp && <div><span className="font-semibold text-emerald-600">TP:</span> {s.tp}</div>}
                          </td>
                          <td className="p-3 border-r border-slate-200 leading-normal">{s.indikator || "-"}</td>
                          <td className="p-3 text-center border-r border-slate-200"><span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 font-semibold rounded">{s.kognitif || "-"}</span></td>
                          <td className="p-3 text-center border-r border-slate-200 capitalize">{s.tingkat || "-"}</td>
                          <td className="p-3 text-center border-r border-slate-200 font-bold text-emerald-700">{kunciSingkat}</td>
                          <td className="p-3 text-center font-bold text-slate-800">{s.skor || 1}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            )}

            {/* 4. KUIS INTERAKTIF TAB */}
            {activeTab === "kuis" && (
              <div className="flex-1 flex flex-col no-print">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 mb-6 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-indigo-900 text-sm">Simulator Kuis GuruPRO</h3>
                    <p className="text-slate-500 text-xs mt-1">Uji coba interaktif butir soal pilihan ganda.</p>
                  </div>
                  <div className="bg-white border border-indigo-200 rounded-xl px-4 py-2.5 shadow-sm text-center">
                    <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Score</span>
                    <span className="text-xl font-black text-indigo-600" id="quiz-score">{quizScore} / {soalList.filter(s => s.tipe === 'pg').length}</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {soalList.map((soal, index) => {
                    if (soal.tipe !== 'pg') return null;
                    
                    const checkedLetter = quizCheckedAnswers[index];
                    const isAnswered = checkedLetter !== undefined;
                    let correctLetter = String(soal.kunci).trim().toUpperCase();
                    if (correctLetter.length > 1) {
                      const match = correctLetter.match(/^([A-H])/i);
                      correctLetter = match ? match[1].toUpperCase() : correctLetter.charAt(0);
                    }

                    return (
                      <div key={index} className="p-6 border border-slate-100 rounded-2xl bg-white shadow-sm flex flex-col" id={`quiz-${index}`}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs font-bold text-slate-400">PERTANYAAN {index + 1}</span>
                        </div>
                        <p className="text-slate-800 font-semibold text-sm mb-4">{soal.pertanyaan}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {soal.opsi && soal.opsi.map((pil: string, pIdx: number) => {
                            const char = String.fromCharCode(65 + pIdx);
                            const isSelected = checkedLetter === char;
                            const isCorrect = char === correctLetter;
                            
                            let btnStyle = "bg-white border-slate-200 hover:border-slate-300 text-slate-700";
                            let iconStyle = "bg-slate-100 text-slate-500";

                            if (isAnswered) {
                              if (isCorrect) {
                                btnStyle = "bg-emerald-50 border-emerald-300 text-emerald-800 font-medium";
                                iconStyle = "bg-emerald-600 text-white";
                              } else if (isSelected) {
                                btnStyle = "bg-rose-50 border-rose-300 text-rose-800 font-medium";
                                iconStyle = "bg-rose-600 text-white";
                              } else {
                                btnStyle = "bg-white border-slate-200 text-slate-400 opacity-60";
                              }
                            }

                            return (
                              <button
                                key={pIdx}
                                type="button"
                                disabled={isAnswered}
                                onClick={() => handleSelectQuizOption(index, char, soal.kunci)}
                                className={`text-left p-3.5 rounded-xl border text-xs transition-all flex items-center gap-3 ${btnStyle}`}
                              >
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${iconStyle}`}>
                                  {char}
                                </span>
                                <span className="flex-1">{pil}</span>
                              </button>
                            );
                          })}
                        </div>
                        
                        {isAnswered && soal.pembahasan && (
                          <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/60 text-xs text-slate-600 leading-relaxed animate-fadeIn">
                            <span className="font-bold text-slate-700 block mb-1">💡 Penjelasan Kunci Jawaban:</span>
                            {soal.pembahasan}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {soalList.filter(s => s.tipe === 'pg').length === 0 && (
                    <div className="text-center text-slate-400 py-12">
                      🎮 Kuis simulator saat ini hanya mendukung butir soal bertipe Pilihan Ganda (pg).
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. ANALISIS & STATISTIK TAB */}
            {activeTab === "analisis" && (
              <div className="flex-1 flex flex-col space-y-8 print:text-black">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl text-center shadow-inner">
                    <span className="text-3xl font-black text-indigo-700 block">{total}</span>
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mt-2">Total Soal</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl text-center shadow-inner">
                    <span className="text-3xl font-black text-emerald-700 block">{lotsCount}</span>
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest block mt-2">LOTS (C1-C3)</span>
                  </div>
                  <div className="bg-orange-50 border border-orange-100 p-5 rounded-2xl text-center shadow-inner">
                    <span className="text-3xl font-black text-orange-700 block">{hotsCount}</span>
                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mt-2">HOTS (C4-C6)</span>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 p-5 rounded-2xl text-center shadow-inner">
                    <span className="text-3xl font-black text-purple-700 block">{Object.keys(tipeCount).length}</span>
                    <span className="text-[10px] font-bold text-purple-500 uppercase tracking-widest block mt-2">Jenis Tipe</span>
                  </div>
                </div>

                {/* Bloom cognitive level distribution */}
                <div className="border border-slate-200 rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm mb-6 flex items-center gap-2">🧠 Distribusi Level Kognitif - Bloom</h3>
                  
                  <div className="space-y-4">
                    {Object.entries(kognitifCount).map(([level, count]) => {
                      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                      return (
                        <div key={level} className="flex flex-col md:flex-row md:items-center gap-3">
                          <span className="w-32 text-xs font-semibold text-slate-700 leading-normal">{kognitifLabels[level as keyof typeof kognitifCount]}</span>
                          <span className="w-10 text-xs font-bold text-slate-900 text-center shrink-0">{count} soal</span>
                          <span className="w-12 text-xs text-slate-500 text-right shrink-0">{pct}%</span>
                          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden shrink-0">
                            <div className={`h-full ${kognitifColors[level as keyof typeof kognitifColors]} rounded-full`} style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="border-t border-slate-100 pt-6 mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <span className="w-3.5 h-3.5 bg-emerald-400 rounded-full inline-block mr-2 align-middle"></span>
                        <span className="text-xs text-slate-600 align-middle">LOTS: <strong className="text-slate-800">{lotsPct}%</strong></span>
                      </div>
                      <div>
                        <span className="w-3.5 h-3.5 bg-orange-500 rounded-full inline-block mr-2 align-middle"></span>
                        <span className="text-xs text-slate-600 align-middle">HOTS: <strong className="text-slate-800">{hotsPct}%</strong></span>
                      </div>
                    </div>
                    <div className="w-full md:w-64 h-3.5 bg-slate-100 rounded-full flex overflow-hidden">
                      <div className="bg-emerald-400 h-full" style={{ width: `${lotsPct}%` }}></div>
                      <div className="bg-orange-500 h-full" style={{ width: `${hotsPct}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Difficulty levels */}
                <div className="border border-slate-200 rounded-3xl bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm mb-6 flex items-center gap-2">📊 Tingkat Kesukaran Soal</h3>
                  
                  <div className="space-y-4">
                    {[
                      { label: "Mudah", count: tingkatCount.mudah, pct: mudahPct, color: "bg-emerald-400" },
                      { label: "Sedang", count: tingkatCount.sedang, pct: sedangPct, color: "bg-blue-400" },
                      { label: "Sulit", count: tingkatCount.sulit, pct: sulitPct, color: "bg-rose-400" }
                    ].map((item) => (
                      <div key={item.label} className="flex flex-col md:flex-row md:items-center gap-3">
                        <span className="w-24 text-xs font-semibold text-slate-700 leading-normal">{item.label}</span>
                        <span className="w-10 text-xs font-bold text-slate-900 text-center shrink-0">{item.count} soal</span>
                        <span className="w-12 text-xs text-slate-500 text-right shrink-0">{item.pct}%</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden shrink-0">
                          <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Item Analysis Panel - Psychometric Analysis */}
                <ItemAnalysisPanel soalList={soalList} />
              </div>
            )}

            {/* 6. HISTORY TAB */}
            {activeTab === "history" && (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center no-print">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 max-w-md">
                  <div className="text-5xl mb-4">🕐</div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Riwayat Perubahan Soal</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    Lihat semua perubahan yang pernah dilakukan pada soal Anda.
                  </p>
                  <div className="flex flex-col gap-2">
                    <div className="bg-white rounded-xl p-3 border border-slate-100">
                      <p className="text-xs text-slate-500">Total Perubahan</p>
                      <p className="text-2xl font-black text-indigo-600">{soalHistory.length}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsHistoryPanelOpen(true)}
                    className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition shadow-md cursor-pointer"
                  >
                    📋 Lihat Riwayat Lengkap
                  </button>
                </div>
              </div>
            )}

            {/* 7. PROMPT GAMBAR TAB */}
            {activeTab === "promptgambar" && (
              <div className="flex-1 flex flex-col space-y-6 no-print">
                {soalList.map((soal, index) => {
                  if (!soal.gambar || !soal.gambar.trim() || /^(tidak ada|none|null|no image|tanpa gambar|-)$/i.test(soal.gambar.trim())) return null;
                  
                  const promptStyle = `3D illustration style, vibrant classroom educational layout, professional digital art, high detail, school presentation vector style`;
                  const finalPrompt = `Create a ${soal.gambar}. ${promptStyle}`;

                  return (
                    <div key={index} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <h4 className="font-bold text-indigo-700 text-sm"><i className="fa-solid fa-image mr-1"></i>Gambar Soal Nomor {index + 1}</h4>
                          <p className="text-xs text-slate-500 mt-1 leading-normal">
                            Pertanyaan: <span className="italic">"{soal.pertanyaan.substring(0, 100)}..."</span>
                          </p>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(finalPrompt);
                            showSuccess("Prompt berhasil disalin!");
                          }}
                          className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold hover:bg-indigo-100 transition no-print"
                        >
                          📋 Copy Prompt
                        </button>
                      </div>

                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 mb-3 text-xs">
                        <span className="font-bold text-indigo-900 block mb-1">Deskripsi Elemen Gambar:</span>
                        <p className="text-slate-700 leading-normal">{soal.gambar}</p>
                      </div>
                      
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs">
                        <span className="font-bold text-slate-600 block mb-1">Prompt Siap Pakai (Text-to-Image AI):</span>
                        <pre className="text-slate-800 whitespace-pre-wrap font-mono leading-relaxed bg-white border border-slate-200/60 p-2.5 rounded-lg">{finalPrompt}</pre>
                      </div>
                    </div>
                  );
                })}
                {soalList.filter(s => s.gambar && s.gambar.trim() && !/^(tidak ada|none|null|no image|tanpa gambar|-)$/i.test(s.gambar.trim())).length === 0 && (
                  <div className="text-center text-slate-400 py-12">
                    🎨 Belum ada soal yang menyematkan instruksi deskripsi ilustrasi visual/gambar.
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
        </div>
      )}

      {/* Mobile home menu grid — only on tugas_harian module */}
      {currentModule === 'tugas_harian' && (
        <div className="md:hidden px-4 pt-2 pb-4">
          <MobileHomeMenu currentModule={currentModule} />
        </div>
      )}

      {currentModule !== 'soal' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 sm:p-8 flex-grow w-full min-h-[50vh] no-print">
          {currentModule === 'administrasi' && renderAdministrasiModule()}
          {currentModule === 'jurnal' && renderJurnalModule()}
          {currentModule === 'keuangan' && renderKeuanganModule()}
          {/* Profil dipindah ke halaman /profile */}
          {currentModule === 'sekolah' && renderSekolahModule()}
          {currentModule === 'nilai' && renderBukuNilaiModule()}
          {currentModule === 'kalender' && renderKalenderModule()}
          {currentModule === 'supervisi_analitik' && renderSupervisiAnalitikModule()}
          {currentModule === 'tugas_harian' && renderTugasHarianModule()}
          {currentModule === 'storage_saya' && renderStorageSayaModule()}
          {currentModule === 'scheduler' && renderSchedulerModule()}
        </div>
      )}

      {/* TAHUN AJARAN MODAL */}
      {showTahunAjaranModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">📅 Tambah Tahun Ajaran</h3>
              <button onClick={() => setShowTahunAjaranModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {/* Quick Setup */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
                <p className="text-[10px] font-bold text-indigo-700 mb-2">💡 Quick Setup:</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => {
                    const y = new Date().getFullYear();
                    setTahunAjaranForm({ nama: y + '/' + (y + 1), tanggalMulai: y + '-07-15', tanggalSelesai: (y + 1) + '-06-30' });
                  }} className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">{new Date().getFullYear()}/{new Date().getFullYear() + 1}</button>
                  <button onClick={() => {
                    const y = new Date().getFullYear();
                    setTahunAjaranForm({ nama: (y + 1) + '/' + (y + 2), tanggalMulai: (y + 1) + '-07-15', tanggalSelesai: (y + 2) + '-06-30' });
                  }} className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">{new Date().getFullYear() + 1}/{new Date().getFullYear() + 2}</button>
                  <button onClick={() => {
                    const y = new Date().getFullYear();
                    setTahunAjaranForm({ nama: (y - 1) + '/' + y, tanggalMulai: (y - 1) + '-07-15', tanggalSelesai: y + '-06-30' });
                  }} className="px-2 py-1 bg-white border border-indigo-200 rounded-lg text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100">{new Date().getFullYear() - 1}/{new Date().getFullYear()}</button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Nama Tahun Ajaran *</label>
                <input type="text" value={tahunAjaranForm.nama}
                  onChange={(e) => setTahunAjaranForm(prev => ({ ...prev, nama: e.target.value }))}
                  placeholder="2024/2025"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Tanggal Mulai *</label>
                  <input type="date" value={tahunAjaranForm.tanggalMulai}
                    onChange={(e) => setTahunAjaranForm(prev => ({ ...prev, tanggalMulai: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Tanggal Selesai *</label>
                  <input type="date" value={tahunAjaranForm.tanggalSelesai}
                    onChange={(e) => setTahunAjaranForm(prev => ({ ...prev, tanggalSelesai: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white" />
                </div>
              </div>
              <p className="text-[9px] text-slate-400 -mt-2">Format: Mulai 15 Juli, Selesai 30 Juni tahun berikutnya</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setShowTahunAjaranModal(false)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition">Batal</button>
              <button onClick={createTahunAjaran} disabled={!tahunAjaranForm.nama}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE TAHUN AJARAN MODAL */}
      {deleteModalTa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">🗑️ Hapus Tahun Ajaran</h3>
              <button onClick={() => { setDeleteModalTa(null); setDeleteTaError(''); }} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Apakah Anda yakin ingin menghapus tahun ajaran <strong>{deleteModalTa.nama}</strong>?
              </p>
              <p className="text-[11px] text-red-600 font-bold">
                Tindakan ini tidak dapat dibatalkan.
              </p>

              {deleteTaError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-xs">
                  {deleteTaError}
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">Masukkan password Anda untuk konfirmasi</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  placeholder="Password Anda"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-400 focus:outline-none bg-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => { setDeleteModalTa(null); setDeletePassword(''); setDeleteTaError(''); }}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition">Batal</button>
              <button onClick={handleDeleteTahunAjaran} disabled={deletingTa || !deletePassword}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition disabled:opacity-50">
                {deletingTa ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {isEditModalOpen && editingSoal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-scaleIn">
            
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
              <h3 className="text-base font-bold text-slate-800">✏️ Edit Butir Soal Nomor {editingSoal.nomor}</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm text-slate-700">
              
              {/* Pertanyaan */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Pertanyaan</label>
                <textarea
                  rows={3}
                  value={editingSoal.pertanyaan || ""}
                  onChange={(e) => setEditingSoal({ ...editingSoal, pertanyaan: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-400 outline-none text-slate-800 text-sm font-semibold"
                />
              </div>

              {/* Gambar Ilustrasi Section */}
              <div className="border border-dashed border-slate-300 rounded-xl p-4 bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-600">Ilustrasi Gambar</label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!editingSoal.gambar) {
                        showError("Deskripsi gambar belum ada. Silakan isi prompt gambar terlebih dahulu.");
                        return;
                      }
                      setIsGeneratingForEditModal(true);
                      handleGenerateImage(editingIndex ?? 0, editingSoal.gambar);
                    }}
                    disabled={generatingImageIndexes[editingIndex ?? 0] || !editingSoal.gambar}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                  >
                    {generatingImageIndexes[editingIndex ?? 0] ? (
                      <>
                        <span className="animate-spin">⏳</span> Membuat...
                      </>
                    ) : (
                      <>
                        <span>🎨</span> Generate AI
                      </>
                    )}
                  </button>
                </div>
                {/* Prompt Gambar Input */}
                <input
                  type="text"
                  value={editingSoal.gambar || ""}
                  onChange={(e) => setEditingSoal({ ...editingSoal, gambar: e.target.value })}
                  placeholder="Masukkan deskripsi/prompt untuk gambar ilustrasi..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-purple-300 outline-none mb-2"
                />
                {/* Display Generated Image */}
                {editingSoal.gambarData && (
                  <div className="mt-2 relative">
                    <img
                      src={editingSoal.gambarData}
                      alt="Ilustrasi"
                      className="max-w-full h-auto rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingSoal({ ...editingSoal, gambarData: undefined })}
                      className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full text-xs font-bold hover:bg-rose-600 transition"
                      title="Hapus gambar"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {!editingSoal.gambarData && !generatingImageIndexes[editingIndex ?? 0] && (
                  <p className="text-xs text-slate-400 text-center py-2">Belum ada ilustrasi. Masukkan prompt dan klik Generate AI.</p>
                )}
              </div>

              {/* Options Editor depending on type */}
              {editingSoal.opsi && (
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-2">Pilihan Jawaban / Opsi</label>
                  
                  {/* Array options (pg, pg-kompleks, bs, urutan) */}
                  {Array.isArray(editingSoal.opsi) && (
                    <div className="space-y-2">
                      {editingSoal.opsi.map((o: string, oIdx: number) => (
                        <div key={oIdx} className="flex gap-2 items-center">
                          <span className="text-xs font-bold text-slate-500 w-6 shrink-0">{String.fromCharCode(65 + oIdx)}.</span>
                          <input 
                            type="text"
                            value={o}
                            onChange={(e) => {
                              const newOpsi = [...editingSoal.opsi];
                              newOpsi[oIdx] = e.target.value;
                              setEditingSoal({ ...editingSoal, opsi: newOpsi });
                            }}
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none"
                          />
                          <button 
                            type="button" 
                            onClick={() => {
                              const newOpsi = editingSoal.opsi.filter((_: any, idx: number) => idx !== oIdx);
                              setEditingSoal({ ...editingSoal, opsi: newOpsi });
                            }}
                            className="text-xs text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 w-8 h-8 rounded-xl shrink-0 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button 
                        type="button"
                        onClick={() => {
                          const newOpsi = [...editingSoal.opsi, ""];
                          setEditingSoal({ ...editingSoal, opsi: newOpsi });
                        }}
                        className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                      >
                        ➕ Tambah Opsi
                      </button>
                    </div>
                  )}

                  {/* Jodoh columns */}
                  {editingSoal.tipe === 'jodoh' && editingSoal.opsi.kiri && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Kolom Kiri (satu per baris):</label>
                        <textarea 
                          rows={4}
                          value={editingSoal.opsi.kiri.join("\n")}
                          onChange={(e) => {
                            const lines = e.target.value.split("\n");
                            setEditingSoal({ ...editingSoal, opsi: { ...editingSoal.opsi, kiri: lines } });
                          }}
                          className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Kolom Kanan (satu per baris):</label>
                        <textarea 
                          rows={4}
                          value={editingSoal.opsi.kanan.join("\n")}
                          onChange={(e) => {
                            const lines = e.target.value.split("\n");
                            setEditingSoal({ ...editingSoal, opsi: { ...editingSoal.opsi, kanan: lines } });
                          }}
                          className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Sebab Akibat */}
                  {editingSoal.tipe === 'sebab-akibat' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Pernyataan:</label>
                        <input 
                          type="text" 
                          value={editingSoal.opsi.pernyataan || ""} 
                          onChange={(e) => setEditingSoal({ ...editingSoal, opsi: { ...editingSoal.opsi, pernyataan: e.target.value } })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Alasan:</label>
                        <input 
                          type="text" 
                          value={editingSoal.opsi.alasan || ""} 
                          onChange={(e) => setEditingSoal({ ...editingSoal, opsi: { ...editingSoal.opsi, alasan: e.target.value } })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tabel JSON representation */}
                  {editingSoal.tipe === 'tabel' && (
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">Struktur Tabel (JSON):</label>
                      <textarea 
                        rows={6}
                        value={JSON.stringify(editingSoal.opsi, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value);
                            setEditingSoal({ ...editingSoal, opsi: parsed });
                          } catch (err) {
                            // Let them keep typing without throwing
                          }
                        }}
                        className="w-full p-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-300 outline-none font-mono bg-slate-50"
                      />
                    </div>
                  )}

                </div>
              )}

              {/* Kunci Jawaban */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Kunci Jawaban</label>
                {editingSoal.tipe === 'pg' && Array.isArray(editingSoal.opsi) ? (
                  <select 
                    value={String(editingSoal.kunci).trim().toUpperCase()}
                    onChange={(e) => setEditingSoal({ ...editingSoal, kunci: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  >
                    {editingSoal.opsi.map((_: any, oIdx: number) => {
                      const char = String.fromCharCode(65 + oIdx);
                      return <option key={oIdx} value={char}>Opsi {char}</option>;
                    })}
                  </select>
                ) : editingSoal.tipe === 'bs' ? (
                  <select 
                    value={String(editingSoal.kunci)}
                    onChange={(e) => setEditingSoal({ ...editingSoal, kunci: e.target.value })}
                    className="w-full px-3 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                  >
                    <option value="Benar">Benar</option>
                    <option value="Salah">Salah</option>
                  </select>
                ) : (
                  <input 
                    type="text"
                    value={typeof editingSoal.kunci === 'object' ? JSON.stringify(editingSoal.kunci) : String(editingSoal.kunci || "")}
                    onChange={(e) => {
                      let val: any = e.target.value;
                      if (editingSoal.tipe === 'pg-kompleks') {
                        // Allow typing comma separated answers e.g. "A, C"
                        val = e.target.value.split(',').map(s => s.trim().toUpperCase());
                      }
                      setEditingSoal({ ...editingSoal, kunci: val });
                    }}
                    className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:border-indigo-400 outline-none"
                    placeholder="Masukkan kunci jawaban"
                  />
                )}
              </div>

              {/* Pembahasan */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Pembahasan</label>
                <textarea 
                  rows={3} 
                  value={editingSoal.pembahasan || ""}
                  onChange={(e) => setEditingSoal({ ...editingSoal, pembahasan: e.target.value })}
                  className="w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl focus:border-indigo-400 outline-none text-slate-800 text-sm font-semibold"
                />
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Elemen / Materi Pokok</label>
                  <input type="text" value={editingSoal.elemen || ""} onChange={(e) => setEditingSoal({ ...editingSoal, elemen: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Kesulitan</label>
                  <select value={editingSoal.tingkat} onChange={(e) => setEditingSoal({ ...editingSoal, tingkat: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none">
                    <option value="mudah">Mudah</option>
                    <option value="sedang">Sedang</option>
                    <option value="sulit">Sulit</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Capaian Pembelajaran (CP)</label>
                  <input type="text" value={editingSoal.cp || ""} onChange={(e) => setEditingSoal({ ...editingSoal, cp: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Tujuan Pembelajaran (TP)</label>
                  <input type="text" value={editingSoal.tp || ""} onChange={(e) => setEditingSoal({ ...editingSoal, tp: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Bloom Taxonomy (C1-C6)</label>
                  <input type="text" value={editingSoal.kognitif || ""} onChange={(e) => setEditingSoal({ ...editingSoal, kognitif: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" />
                </div>
                <div>
                  <label className="font-bold text-slate-600 block mb-1">Skor Poin</label>
                  <input type="number" value={editingSoal.skor || 1} onChange={(e) => setEditingSoal({ ...editingSoal, skor: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none" />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={saveEditedSoal}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer"
              >
                Simpan Perubahan
              </button>
            </div>

          </div>
        </div>
      )}

      {/* EXPLORER FILE DETAIL MODAL */}
      {selectedExplorerFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-scaleIn font-sans">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-3xl">
              <div className="space-y-0.5">
                <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider block w-fit">
                  {openExplorerFolder === "administrasi" ? "Dokumen Administrasi" : 
                   openExplorerFolder === "soal" ? "Naskah Bank Soal" : 
                   openExplorerFolder === "jurnal" ? "Jurnal Mengajar KBM" : 
                   openExplorerFolder === "file_saya" ? "File Saya" : "Asesmen & Buku Nilai"}
                </span>
                <h3 className="text-sm font-black text-slate-800 tracking-tight">
                  {openExplorerFolder === "jurnal" ? `Jurnal - ${selectedExplorerFile.nama_mapel} Kelas ${selectedExplorerFile.nama_kelas}` : 
                   openExplorerFolder === "nilai" ? `${selectedExplorerFile.nama_asesmen} - Kelas ${selectedExplorerFile.nama_kelas}` : 
                   openExplorerFolder === "file_saya" ? selectedExplorerFile.judul : selectedExplorerFile.judul_dokumen}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedExplorerFile(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-slate-700">
              
              {openExplorerFolder === "administrasi" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs text-slate-400 font-bold">Judul Berkas:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const response = await apiFetch("/api/administrasi", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: selectedExplorerFile.id,
                                tipe_dokumen: selectedExplorerFile.tipe_dokumen,
                                judul_dokumen: selectedExplorerFile.judul_dokumen,
                                konten: selectedExplorerFile.konten,
                                tanggal_kegiatan: selectedExplorerFile.tanggal_kegiatan
                              })
                            });
                            if (response.ok) {
                              showSuccess("Dokumen berhasil disimpan!");
                              fetchExplorerData();
                            } else {
                              showError("Gagal menyimpan perubahan.");
                            }
                          } catch (e) {
                            showError("Masalah koneksi.");
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-100 font-sans"
                      >
                        💾 Simpan Perubahan
                      </button>
                      <button
                        onClick={() => {
                          if (isSubscriptionExpired()) {
                            showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menyalin atau mencetak berkas.");
                            return;
                          }
                          navigator.clipboard.writeText(selectedExplorerFile.konten?.markdown || "");
                          showSuccess("Konten dokumen berhasil disalin ke clipboard!");
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📋 Salin Teks
                      </button>
                      <button
                        onClick={() => {
                          if (isSubscriptionExpired()) {
                            showError("Masa aktif langganan Anda telah berakhir. Perpanjang paket Anda untuk menyalin atau mencetak berkas.");
                            return;
                          }
                          const school = schools.find(s => s.id === selectedSchoolId);
                          let signaturesHtml = "";
                          if (school) {
                            if (school.show_ttd_kepala !== false) {
                              signaturesHtml += `
                                <div style="width: 45%; margin-bottom: 20px; text-align: left;">
                                  <p>Mengetahui,</p>
                                  <p style="font-weight: bold; margin-bottom: 50px;">Kepala Sekolah</p>
                                  <p style="text-decoration: underline; font-weight: bold; margin: 0;">( ${school.nama_kepala_sekolah || "___________________________"} )</p>
                                  <p style="margin: 0; color: #555;">NIP: ${school.nip_kepala_sekolah || "..........................................."}</p>
                                </div>
                              `;
                            }
                            signaturesHtml += `
                              <div style="width: 45%; margin-bottom: 20px; text-align: right;">
                                <p>&nbsp;</p>
                                <p style="font-weight: bold; margin-bottom: 50px; text-align: right;">Guru Mata Pelajaran</p>
                                <p style="text-decoration: underline; font-weight: bold; margin: 0; text-align: right;">( ${currentUser?.nama_lengkap || "___________________________"} )</p>
                                <p style="margin: 0; color: #555; text-align: right;">NIP: ${currentUser?.nip || "..........................................."}</p>
                              </div>
                            `;
                            if (school.show_ttd_pengawas !== false) {
                              signaturesHtml += `
                                <div style="width: 45%; margin-bottom: 20px; text-align: left;">
                                  <p>Menyetujui,</p>
                                  <p style="font-weight: bold; margin-bottom: 50px;">Pengawas Sekolah Pembina</p>
                                  <p style="text-decoration: underline; font-weight: bold; margin: 0;">( ${school.nama_pengawas || "___________________________"} )</p>
                                  <p style="margin: 0; color: #555;">NIP: ${school.nip_pengawas || "..........................................."}</p>
                                </div>
                              `;
                            }
                            if (school.show_ttd_wali !== false) {
                              const clsWali = classes.find(c => c.id === selectedClassId);
                              const waliNama = clsWali?.wali_kelas || school.nama_wali_kelas || "___________________________";
                              const waliNip = clsWali?.wali_kelas_nip || school.nip_wali_kelas || "...........................................";
                              signaturesHtml += `
                                <div style="width: 45%; margin-bottom: 20px; text-align: right;">
                                  <p>&nbsp;</p>
                                  <p style="font-weight: bold; margin-bottom: 50px; text-align: right;">Wali Kelas</p>
                                  <p style="text-decoration: underline; font-weight: bold; margin: 0; text-align: right;">( ${waliNama} )</p>
                                  <p style="margin: 0; color: #555; text-align: right;">NIP: ${waliNip}</p>
                                </div>
                              `;
                            }
                          } else {
                            signaturesHtml += `
                              <div style="width: 45%; margin-bottom: 20px; text-align: left;">
                                <p>&nbsp;</p>
                                <p style="font-weight: bold; margin-bottom: 50px;">Guru Mata Pelajaran</p>
                                <p style="text-decoration: underline; font-weight: bold; margin: 0;">( ${currentUser?.nama_lengkap || "___________________________"} )</p>
                              </div>
                            `;
                          }
                          const printWindow = window.open("", "_blank");
                          if (printWindow) {
                            printWindow.document.write(generatePrintLayout(selectedExplorerFile.judul_dokumen, selectedExplorerFile.konten?.markdown || ""));
                            printWindow.document.close();
                            printWindow.print();
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        🖨️ Cetak Laporan
                      </button>
                      <button
                        onClick={() => {
                          if (selectedExplorerFile.konten?.docx_url) {
                            window.open(selectedExplorerFile.konten.docx_url, "_blank");
                          } else {
                            downloadDocxClient(selectedExplorerFile.judul_dokumen, selectedExplorerFile.konten?.markdown || "");
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📘 Ekspor Word (.doc)
                      </button>
                      <button
                        onClick={() => {
                          if (selectedExplorerFile.konten?.pdf_url) {
                            window.open(selectedExplorerFile.konten.pdf_url, "_blank");
                          } else {
                            downloadPdfClient(selectedExplorerFile.judul_dokumen, selectedExplorerFile.konten?.markdown || "");
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📕 Ekspor PDF
                      </button>
                      {selectedExplorerFile.konten?.pptx_url && (
                        <a
                          href={selectedExplorerFile.konten.pptx_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 hover:bg-amber-100 transition flex items-center gap-1.5 font-bold cursor-pointer font-sans"
                        >
                          📊 Ekspor PPTX
                        </a>
                      )}
                    </div>
                  </div>

                  <input 
                    type="text"
                    value={selectedExplorerFile.judul_dokumen}
                    onChange={(e) => setSelectedExplorerFile({
                      ...selectedExplorerFile,
                      judul_dokumen: e.target.value
                    })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:outline-none font-bold text-slate-800"
                    placeholder="Judul Dokumen..."
                  />

                  <textarea
                    rows={15}
                    value={selectedExplorerFile.konten?.markdown || ""}
                    onChange={(e) => setSelectedExplorerFile({
                      ...selectedExplorerFile,
                      konten: { ...selectedExplorerFile.konten, markdown: e.target.value }
                    })}
                    className="w-full p-5 border border-slate-200 rounded-2xl text-xs font-mono bg-white outline-none focus:border-indigo-400 leading-relaxed text-slate-700"
                  />
                </div>
              )}

              {openExplorerFolder === "soal" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs text-slate-400 font-bold">Informasi Soal Ujian:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleCopyExplorerSoal(selectedExplorerFile)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📋 Salin ke Clipboard
                      </button>
                      <button
                        onClick={() => handlePrintExplorerSoal(selectedExplorerFile)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        🖨️ Cetak Soal
                      </button>
                      <button
                        onClick={() => downloadExplorerSoalWord(selectedExplorerFile)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📘 Ekspor Word (.doc)
                      </button>
                      <button
                        onClick={() => downloadExplorerSoalPdf(selectedExplorerFile)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📕 Ekspor PDF
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Mata Pelajaran:</span>
                      <span>{selectedExplorerFile.konten?.meta?.mapel || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Kelas:</span>
                      <span>Kelas {selectedExplorerFile.konten?.meta?.kelas || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Kurikulum:</span>
                      <span className="capitalize">{selectedExplorerFile.konten?.meta?.kurikulum || "Merdeka"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Topik Pembahasan:</span>
                      <span>{selectedExplorerFile.konten?.meta?.topik || "-"}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Butir Soal ({selectedExplorerFile.konten?.soalList?.length || 0})</h4>
                    <div className="space-y-4">
                      {(selectedExplorerFile.konten?.soalList || []).map((s: any, idx: number) => {
                        const opts = s.options || s.pilihan;
                        return (
                          <div key={idx} className="p-4 bg-white border border-slate-200/80 rounded-2xl space-y-3">
                            <div className="flex justify-between items-start gap-3">
                              <span className="font-bold text-slate-800">{idx + 1}. {s.pertanyaan || s.soal}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0">
                                {s.tipe || s.type || "PG"}
                              </span>
                            </div>

                            {opts && Array.isArray(opts) && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4">
                                {opts.map((opt: string, oIdx: number) => {
                                  const letters = ["A", "B", "C", "D", "E"];
                                  return (
                                    <div key={oIdx} className="text-xs text-slate-600 flex gap-2">
                                      <span className="font-bold text-slate-400">{letters[oIdx]}.</span>
                                      <span>{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="text-[11px] font-bold text-indigo-600 bg-indigo-50/50 w-fit px-3 py-1 rounded-xl">
                              Kunci Jawaban: {String(s.kunci || s.jawaban)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {openExplorerFolder === "jurnal" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs text-slate-400 font-bold">Agenda Jurnal Mengajar:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handlePrintJournal(selectedExplorerFile)}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        🖨️ Cetak Jurnal
                      </button>
                      <button
                        onClick={() => {
                          if (selectedExplorerFile.custom_values?.docx_url) {
                            window.open(selectedExplorerFile.custom_values.docx_url, "_blank");
                          } else {
                            const title = `Jurnal Mengajar - ${selectedExplorerFile.nama_mapel} Kelas ${selectedExplorerFile.nama_kelas}`;
                            const md = `# JURNAL MENGAJAR KBM\n\n- **Sekolah**: ${selectedExplorerFile.nama_sekolah || "-"}\n- **Mata Pelajaran**: ${selectedExplorerFile.nama_mapel || "-"}\n- **Kelas**: ${selectedExplorerFile.nama_kelas || "-"}\n- **Guru**: ${currentUser?.nama_lengkap || "-"}\n- **Tanggal**: ${selectedExplorerFile.tanggal_kegiatan || "-"}\n\n### CATATAN KEGIATAN:\n${selectedExplorerFile.catatan || "Tidak ada catatan."}`;
                            downloadDocxClient(title, md);
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📘 Ekspor Word (.doc)
                      </button>
                      <button
                        onClick={() => {
                          if (selectedExplorerFile.custom_values?.pdf_url) {
                            window.open(selectedExplorerFile.custom_values.pdf_url, "_blank");
                          } else {
                            const title = `Jurnal Mengajar - ${selectedExplorerFile.nama_mapel} Kelas ${selectedExplorerFile.nama_kelas}`;
                            const md = `# JURNAL MENGAJAR KBM\n\n- **Sekolah**: ${selectedExplorerFile.nama_sekolah || "-"}\n- **Mata Pelajaran**: ${selectedExplorerFile.nama_mapel || "-"}\n- **Kelas**: ${selectedExplorerFile.nama_kelas || "-"}\n- **Guru**: ${currentUser?.nama_lengkap || "-"}\n- **Tanggal**: ${selectedExplorerFile.tanggal_kegiatan || "-"}\n\n### CATATAN KEGIATAN:\n${selectedExplorerFile.catatan || "Tidak ada catatan."}`;
                            downloadPdfClient(title, md);
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📕 Ekspor PDF
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Detail Kelas &amp; Jadwal</h4>
                      <table className="w-full text-xs font-semibold text-slate-600 space-y-2">
                        <tbody>
                          <tr>
                            <td className="text-slate-400 py-1" style={{ width: "35%" }}>Sekolah / Instansi</td>
                            <td className="text-slate-800 py-1 font-bold">{selectedExplorerFile.nama_sekolah || "-"}</td>
                          </tr>
                          <tr>
                            <td className="text-slate-400 py-1">Tanggal Kegiatan</td>
                            <td className="text-slate-800 py-1 font-bold">{selectedExplorerFile.tanggal}</td>
                          </tr>
                          <tr>
                            <td className="text-slate-400 py-1">Mata Pelajaran</td>
                            <td className="text-slate-800 py-1 font-bold">{selectedExplorerFile.nama_mapel}</td>
                          </tr>
                          <tr>
                            <td className="text-slate-400 py-1">Kelas</td>
                            <td className="text-slate-800 py-1 font-bold">Kelas {selectedExplorerFile.nama_kelas}</td>
                          </tr>
                          <tr>
                            <td className="text-slate-400 py-1">Guru Pengajar</td>
                            <td className="text-slate-800 py-1 font-bold">{selectedExplorerFile.nama_guru}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Status Supervisi &amp; Persetujuan</h4>
                        <div className="flex items-center gap-2 mt-3">
                          <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase ${
                            selectedExplorerFile.status === "Approved" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : 
                            selectedExplorerFile.status === "Revision" ? "bg-amber-50 border border-amber-200 text-amber-700" : 
                            "bg-slate-50 border border-slate-200 text-slate-500"
                          }`}>
                            {selectedExplorerFile.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">Supervisor: {selectedExplorerFile.nama_supervisor || "-"}</span>
                        </div>
                        {selectedExplorerFile.ulasan?.catatan && (
                          <div className="mt-3 p-3 bg-white border border-slate-100 rounded-2xl text-[11px] font-medium leading-relaxed text-slate-600">
                            <span className="font-bold text-slate-700 block mb-0.5">Ulasan/Catatan:</span>
                            {selectedExplorerFile.ulasan.catatan}
                          </div>
                        )}
                      </div>

                      {selectedExplorerFile.status === "Approved" && (
                        <div className="relative border-2 border-dashed border-emerald-600 text-emerald-600 rounded-xl px-3 py-1.5 font-black uppercase text-[8px] tracking-widest rotate-[-3deg] select-none pointer-events-none bg-white shadow-sm flex flex-col items-center justify-center shrink-0 w-fit self-end mt-4">
                          <span className="text-[6px] opacity-75">GURUPRO OFFICIAL STAMP</span>
                          <span className="text-[10px] my-0.5 font-extrabold">⭐ APPROVED ⭐</span>
                          <span className="text-[6px] opacity-75 font-mono">BY {selectedExplorerFile.nama_supervisor || "SUPERVISOR"}</span>
                          <span className="text-[6px] font-mono opacity-60 mt-0.5">
                            {selectedExplorerFile.ulasan?.created_at ? new Date(selectedExplorerFile.ulasan.created_at).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200/85 rounded-3xl p-5 space-y-4 shadow-sm">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">Konten Jurnal</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Materi Pembelajaran:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">{selectedExplorerFile.materi_pembelajaran}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Tujuan Pembelajaran:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">{selectedExplorerFile.tujuan_pembelajaran}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-slate-400 font-bold block mb-1">Aktivitas Pembelajaran:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100 whitespace-pre-wrap">{selectedExplorerFile.aktivitas_pembelajaran}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Media Pembelajaran:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">{selectedExplorerFile.media_pembelajaran || "-"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Asesmen Pembelajaran:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">{selectedExplorerFile.asesmen_pembelajaran || "-"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Refleksi Guru:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">{selectedExplorerFile.refleksi_guru || "-"}</p>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold block mb-1">Tindak Lanjut Pembelajaran:</span>
                        <p className="text-slate-800 font-semibold bg-slate-50 p-3 rounded-2xl border border-slate-100">{selectedExplorerFile.tindak_lanjut || "-"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200/60 rounded-3xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Rekap Kehadiran Siswa</h4>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div className="bg-white border border-slate-100 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 font-bold block">Hadir</span>
                        <span className="text-base font-extrabold text-emerald-600">{selectedExplorerFile.hadir_count || 0}</span>
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 font-bold block">Sakit</span>
                        <span className="text-base font-extrabold text-blue-500">{selectedExplorerFile.sakit_count || 0}</span>
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 font-bold block">Izin</span>
                        <span className="text-base font-extrabold text-amber-500">{selectedExplorerFile.izin_count || 0}</span>
                      </div>
                      <div className="bg-white border border-slate-100 rounded-2xl p-3">
                        <span className="text-[10px] text-slate-400 font-bold block">Alfa</span>
                        <span className="text-base font-extrabold text-red-500">{selectedExplorerFile.alfa_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {openExplorerFolder === "nilai" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs text-slate-400 font-bold">Agenda Rekap Asesmen:</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          const title = `Rekap Nilai - ${selectedExplorerFile.nama_asesmen} Kelas ${selectedExplorerFile.nama_kelas}`;
                          const md = generateGradesMarkdown(selectedExplorerFile, explorerGrades);
                          const printWindow = window.open("", "_blank");
                          if (printWindow) {
                            printWindow.document.write(generatePrintLayout(title, md));
                            printWindow.document.close();
                            printWindow.print();
                          }
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        🖨️ Cetak Laporan
                      </button>
                      <button
                        onClick={() => {
                          const title = `Rekap Nilai - ${selectedExplorerFile.nama_asesmen} Kelas ${selectedExplorerFile.nama_kelas}`;
                          const md = generateGradesMarkdown(selectedExplorerFile, explorerGrades);
                          downloadDocxClient(title, md);
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border-2 border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📘 Ekspor Word (.doc)
                      </button>
                      <button
                        onClick={() => {
                          const title = `Rekap Nilai - ${selectedExplorerFile.nama_asesmen} Kelas ${selectedExplorerFile.nama_kelas}`;
                          const md = generateGradesMarkdown(selectedExplorerFile, explorerGrades);
                          downloadPdfClient(title, md);
                        }}
                        className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                      >
                        📕 Ekspor PDF
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200/60 rounded-2xl text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Tipe Asesmen:</span>
                      <span className="capitalize">{selectedExplorerFile.tipe_asesmen || "-"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Target KKM Kelulusan:</span>
                      <span className="text-rose-600 font-extrabold">{selectedExplorerFile.kkm || 70} Poin</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Mata Pelajaran / Kelas:</span>
                      <span>{selectedExplorerFile.nama_mapel} / Kelas {selectedExplorerFile.nama_kelas}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Sekolah / Instansi:</span>
                      <span>{selectedExplorerFile.nama_sekolah || "-"}</span>
                    </div>
                  </div>

                  {isLoadingGrades ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-[10px] font-bold text-slate-400">Memuat rekap nilai siswa...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {(() => {
                        const KKM = selectedExplorerFile.kkm || 70;
                        const avg = explorerGrades.length > 0 ? Math.round((explorerGrades.reduce((sum, g) => sum + (g.nilai_akhir || 0), 0) / explorerGrades.length) * 10) / 10 : 0;
                        const passed = explorerGrades.filter(g => (g.nilai_akhir || 0) >= KKM).length;
                        const passedPercent = explorerGrades.length > 0 ? Math.round((passed / explorerGrades.length) * 100) : 0;
                        const remedialCount = explorerGrades.length - passed;
                        
                        return (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center gap-4">
                              <span className="text-2xl">📈</span>
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Rata-rata Nilai Kelas</span>
                                <span className="text-lg font-black text-slate-800">{avg} Poin</span>
                              </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center gap-4">
                              <span className="text-2xl">🎓</span>
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Persentase Kelulusan KKM</span>
                                <span className="text-lg font-black text-emerald-600">{passedPercent}% ({passed} Murid)</span>
                              </div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 flex items-center gap-4">
                              <span className="text-2xl">⏳</span>
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Jumlah Siswa Remedial</span>
                                <span className="text-lg font-black text-rose-600">{remedialCount} Murid</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="border border-slate-200/80 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto max-h-[350px]">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] text-slate-400 font-extrabold uppercase border-b border-slate-200">
                                <th className="px-4 py-3" style={{ width: "8%" }}>No</th>
                                <th className="px-4 py-3">Nama Siswa</th>
                                <th className="px-4 py-3">NISN</th>
                                <th className="px-4 py-3 text-center">Nilai Awal</th>
                                <th className="px-4 py-3 text-center">Nilai Remedial</th>
                                <th className="px-4 py-3 text-center">Nilai Akhir</th>
                                <th className="px-4 py-3 text-right">Kelulusan (KKM)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                              {explorerGrades.map((g, idx) => {
                                const isPassed = (g.nilai_akhir || 0) >= (selectedExplorerFile.kkm || 70);
                                return (
                                  <tr key={idx} className="hover:bg-slate-50/50 transition">
                                    <td className="px-4 py-3 text-slate-400">{g.nomor_absen || idx + 1}</td>
                                    <td className="px-4 py-3 text-slate-800 font-bold">{g.nama_siswa}</td>
                                    <td className="px-4 py-3 text-slate-400">{g.nisn || "-"}</td>
                                    <td className="px-4 py-3 text-center font-medium text-slate-500">{g.nilai_awal !== null ? g.nilai_awal : "-"}</td>
                                    <td className="px-4 py-3 text-center font-medium text-slate-500">{g.nilai_remedial !== null ? g.nilai_remedial : "-"}</td>
                                    <td className="px-4 py-3 text-center font-bold text-slate-800">{g.nilai_akhir !== null ? g.nilai_akhir : "-"}</td>
                                    <td className="px-4 py-3 text-right">
                                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                        isPassed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                                      }`}>
                                        {isPassed ? "Lulus" : "Remedial"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {openExplorerFolder === "file_saya" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
                  {/* Left Column: Real Live Preview */}
                  <div className="lg:col-span-2 flex flex-col items-center justify-center bg-slate-50 border border-slate-200/60 rounded-3xl p-4 min-h-[350px] lg:min-h-[500px]">
                    {selectedExplorerFile.file_tipe?.toLowerCase() === "pdf" ? (
                      <iframe
                        src={selectedExplorerFile.file_url}
                        className="w-full h-[500px] rounded-2xl border border-slate-200/80 shadow-sm"
                        title={selectedExplorerFile.judul}
                      />
                    ) : ["jpg", "jpeg", "png", "webp", "gif"].includes(selectedExplorerFile.file_tipe?.toLowerCase() || "") ? (
                      <img
                        src={selectedExplorerFile.file_url}
                        alt={selectedExplorerFile.judul}
                        className="max-w-full max-h-[500px] object-contain rounded-2xl shadow-sm border border-slate-200/50"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                        <span className="text-6xl">📄</span>
                        <span className="text-xs font-bold">Pratinjau tidak tersedia untuk tipe berkas ini.</span>
                        <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 tracking-wider">
                          {selectedExplorerFile.file_tipe || "FILE"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Metadata Details */}
                  <div className="space-y-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3.5 text-xs font-bold text-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">Judul Dokumen</span>
                          <span className="text-slate-800 text-sm font-black leading-snug">{selectedExplorerFile.judul}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">Nama File Fisik</span>
                          <span className="text-slate-600 font-mono break-all">{selectedExplorerFile.file_nama}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">Kategori Dokumen</span>
                          <span className="text-indigo-600 capitalize bg-indigo-50/50 border border-indigo-100/50 px-2 py-0.5 rounded-md w-fit block mt-0.5">
                            {selectedExplorerFile.kategori?.replace("_", " ")}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">Format &amp; Ukuran Berkas</span>
                          <span className="text-slate-600">
                            {selectedExplorerFile.file_tipe?.toUpperCase()} • {selectedExplorerFile.file_ukuran ? `${(selectedExplorerFile.file_ukuran / 1024 / 1024).toFixed(2)} MB` : "-"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px] uppercase tracking-wider mb-0.5">Tanggal Diunggah</span>
                          <span className="text-slate-600">
                            {selectedExplorerFile.tanggal_dokumen ? new Date(selectedExplorerFile.tanggal_dokumen).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : new Date(selectedExplorerFile.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <a
                        href={selectedExplorerFile.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>📥</span> Unduh / Buka di Tab Baru
                      </a>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50 rounded-b-3xl">
              <button 
                type="button"
                onClick={() => setSelectedExplorerFile(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer font-sans"
              >
                Tutup Berkas
              </button>
            </div>

          </div>
        </div>
      )}

      {/* WARNING EXPORT CONFIRMATION MODAL */}
      {pendingExportAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-scaleIn">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-xl mb-4">
              ⚠️
            </div>
            <h3 className="text-base font-bold text-slate-900">Beberapa Soal Belum Ditinjau</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Sebagai pendidik, sangat penting untuk memeriksa kelayakan dan kebenaran butir soal buatan AI sebelum diujikan kepada siswa. AI memiliki potensi membuat kesalahan konsep atau penulisan.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  const firstUnreviewedIdx = soalList.findIndex((s) => !s.id || !reviewedQuestions[s.id]);
                  setPendingExportAction(null);
                  if (firstUnreviewedIdx !== -1) {
                    setTimeout(() => {
                      const element = document.getElementById(`card-soal-${firstUnreviewedIdx}`);
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        element.classList.add('ring-4', 'ring-amber-400');
                        setTimeout(() => element.classList.remove('ring-4', 'ring-amber-400'), 2000);
                      }
                    }, 100);
                  }
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-100 cursor-pointer text-center"
              >
                🔍 Tinjau Soal Belum Diperiksa
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingExportAction) pendingExportAction();
                  setPendingExportAction(null);
                }}
                className="w-full py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition cursor-pointer text-center"
              >
                ⚠️ Lewati & Tetap Ekspor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-8px_30px_rgb(0,0,0,0.04)] px-4 py-2.5 flex justify-around items-center lg:hidden z-40 no-print">
        <button
          onClick={() => setMobileTab('config')}
          className={`flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all duration-200 ${
            mobileTab === 'config'
              ? 'text-indigo-600 font-bold scale-105'
              : 'text-slate-500 font-medium hover:text-slate-800'
          }`}
        >
          <span className="text-xl">⚙️</span>
          <span className="text-[11px] tracking-tight">Konfigurasi</span>
        </button>

        <button
          onClick={() => setMobileTab('preview')}
          className={`relative flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all duration-200 ${
            mobileTab === 'preview'
              ? 'text-indigo-600 font-bold scale-105'
              : 'text-slate-500 font-medium hover:text-slate-800'
          }`}
        >
          <span className="text-xl">📄</span>
          <span className="text-[11px] tracking-tight">Lembar Soal</span>
          {soalList.length > 0 && (
            <span className="absolute top-0.5 right-3 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold animate-pulse">
              {soalList.length}
            </span>
          )}
        </button>
      </div>

      {/* GuruPRO AI Floating Action Button - Selesaikan Mengajar */}
      <FloatingActionButton />

      {/* Selesai Mengajar Modal for RPP */}
      <SelesaiMengajarModal
        isOpen={rppSelesaiModal.isOpen && !!rppSelesaiModal.rpp}
        onClose={() => setRppSelesaiModal({ isOpen: false, rpp: null, schedule: null })}
        preselectedSchedule={rppSelesaiModal.schedule}
        rppId={rppSelesaiModal.rpp?.id}
        onComplete={() => {
          setRppSelesaiModal({ isOpen: false, rpp: null, schedule: null });
          setCompletedSessionIds((prev) => {
            const newSet = new Set(prev);
            if (rppSelesaiModal.schedule?.id) {
              newSet.add(rppSelesaiModal.schedule.id);
            }
            return newSet;
          });
        }}
      />

      {/* School Selector Modal for Multi-School Teachers */}
      {showSchoolSelectorModal && schools.length > 1 && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/50 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-5 animate-fadeIn">
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-black text-slate-800 flex items-center justify-center gap-2">
                <span>🏫</span> Pilih Sekolah yang Dikelola
              </h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Anda mengajar di beberapa sekolah. Silakan pilih sekolah aktif untuk memuat RPP, Jurnal Kelas, dan Nilai Anda hari ini:
              </p>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {schools.map((school) => (
                <button
                  key={school.id}
                  onClick={() => handleSelectSchoolFromModal(school.id)}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center gap-3.5 group cursor-pointer ${
                    selectedSchoolId === school.id
                      ? "bg-indigo-50 border-indigo-200 shadow-sm"
                      : "bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50/50"
                  }`}
                >
                  <div className="w-10 h-10 bg-indigo-100/60 rounded-xl flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform font-bold text-indigo-600">
                    {school.logo ? (
                      <img src={school.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      "🏫"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-extrabold text-xs text-slate-800 truncate">{school.nama_sekolah}</h4>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5 truncate">
                      NPSN: {school.npsn || "-"} • {school.alamat || "Alamat belum diset"}
                    </p>
                  </div>
                  <div className="text-slate-300 group-hover:text-indigo-600 transition-colors text-xs font-bold shrink-0">
                    ➡️
                  </div>
                </button>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSchoolSelectorModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                Gunakan Pilihan Terakhir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KISI-KISI EXPORT MODAL */}
      <KisikisiExportModal
        isOpen={isKisikisiExportModalOpen}
        onClose={() => setIsKisikisiExportModalOpen(false)}
        soalList={soalList}
        metaInfo={enrichExportMeta()}
        onExportPdf={downloadKisikisiPdf}
        onExportWord={downloadKisikisiWord}
      />

      {/* IMPORT SOAL MODAL */}
      <ImportSoalModal
        isOpen={isImportSoalModalOpen}
        onClose={() => setIsImportSoalModalOpen(false)}
        onImport={handleImportSoal}
        existingCount={soalList.length}
      />

      {/* HISTORY PANEL */}
      <HistoryPanel
        isOpen={isHistoryPanelOpen}
        onClose={() => setIsHistoryPanelOpen(false)}
        history={soalHistory}
        onRestore={handleRestoreFromHistory}
        onClearHistory={clearHistory}
      />

      {/* TOKEN HABIS MODAL */}
      <PoinHabisModal
        open={showTokenModal}
        shortfall={tokenShortfall}
        onClose={() => setShowTokenModal(false)}
        onBuyTopUp={() => window.location.href = '/profile?tab=billing'}
        onUpgrade={() => window.location.href = '/profile?tab=billing'}
      />

      {/* Mobile bottom nav */}
      <MobileBottomNav />

    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Memuat Dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
