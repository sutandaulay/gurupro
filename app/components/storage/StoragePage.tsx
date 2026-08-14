"use client";
import { apiFetch } from "@/lib/api-client";

import React, { useState, useEffect, useCallback } from "react";
import { useTeacherStore } from "@/lib/stores";
import {
  IconFolder,
  IconFolderPlus,
  IconFile,
  IconUpload,
  IconTrash,
  IconPencil,
  IconDotsVertical,
  IconChevronRight,
  IconHome,
  IconSearch,
  IconRefresh,
  IconEye,
  IconDownload,
  IconX,
  IconLock,
  IconLockOpen,
  IconShare,
  IconMail,
  IconBrandWhatsapp,
  IconShieldLock,
} from "@tabler/icons-react";
import ApprovalStatusBadge from "@/components/approval/ApprovalStatusBadge";

interface Folder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  pin: string | null;
  created_at: string;
  updated_at: string;
}

interface FileItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  r2_key: string;
  r2_url: string;
  size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
  is_system?: boolean;
  konten?: any;
  custom_values?: any;
  assessment_info?: any;
  approval_status?: string;
  approval_note?: string | null;
  tipe_dokumen?: string;
}

const VIRTUAL_FOLDERS = [
  { id: "system_silabus", name: "AI Silabus & Kurikulum", color: "text-indigo-500" },
  { id: "system_atp", name: "AI ATP (Alur Pembelajaran)", color: "text-sky-500" },
  { id: "system_prota", name: "AI Program Tahunan (Prota)", color: "text-purple-500" },
  { id: "system_prosem", name: "AI Program Semester (Prosem)", color: "text-violet-500" },
  { id: "system_rpp", name: "AI RPP & Modul Ajar", color: "text-pink-500" },
  { id: "system_lkpd", name: "AI LKPD & Evaluasi", color: "text-emerald-500" },
  { id: "system_bahan_ajar", name: "AI Bahan Ajar", color: "text-amber-500" },
  { id: "system_soal", name: "AI Bank Soal", color: "text-orange-500" },
  { id: "system_jurnal", name: "Jurnal Mengajar KBM", color: "text-teal-500" },
  { id: "system_nilai", name: "Buku Nilai & Asesmen", color: "text-yellow-600" },
  { id: "system_file_saya", name: "AI Bukti Dukung (Evidence)", color: "text-blue-500" },
  { id: "system_laporan_kinerja", name: "AI Laporan Kinerja", color: "text-rose-500" },
  { id: "system_raport", name: "AI Rapor Siswa", color: "text-cyan-500" },
];

type ToastType = "success" | "error";

export default function StoragePage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Brankas" },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const schools = useTeacherStore((s) => s.schools) || [];
  const activeSchoolId = useTeacherStore((s) => s.activeSchoolId) || "";
  const selectedSchoolId = activeSchoolId;

  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesData, setGradesData] = useState<any[]>([]);

  // Modals
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string; type: "folder" | "file" } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: Folder | FileItem;
    type: "folder" | "file";
  } | null>(null);

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Share
  const [showShareMenu, setShowShareMenu] = useState<{ file: FileItem } | null>(null);

  // Folder PIN
  const [showPinModal, setShowPinModal] = useState<{ folder: Folder } | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  const [showSetPinModal, setShowSetPinModal] = useState<{
    folder: Folder;
    mode: "set" | "change";
  } | null>(null);
  const [setPinValue, setSetPinValue] = useState("");
  const [settingPin, setSettingPin] = useState(false);

  const [showForgotPinModal, setShowForgotPinModal] = useState(false);
  const [forgotPinCode, setForgotPinCode] = useState("");
  const [forgotPinNewPin, setForgotPinNewPin] = useState("");
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resettingPin, setResettingPin] = useState(false);

  const [virtualCounts, setVirtualCounts] = useState<{[key: string]: number}>({});

  const loadVirtualCounts = useCallback(async () => {
    try {
      const semester = typeof window !== 'undefined' ? (localStorage.getItem('semester') || '') : '';
      const tahunAjaranId = typeof window !== 'undefined' ? (localStorage.getItem('tahunAjaranId') || '') : '';
      const params = new URLSearchParams();
      if (semester) params.set('semester', semester);
      if (tahunAjaranId) params.set('tahun_ajaran_id', tahunAjaranId);

      const schoolQuery = selectedSchoolId ? `?school_id=${selectedSchoolId}` : '';

      const journalsQuery = selectedSchoolId ? `?school_id=${selectedSchoolId}&limit=100` : '?limit=100';
      const [docsRes, journalsRes, assessmentsRes, fileSayaRes, laporanKinerjaRes, raportRes] = await Promise.all([
        apiFetch(`/api/administrasi${schoolQuery}`).then(r => r.ok ? r.json() : { data: [] }),
        apiFetch(`/api/journals${journalsQuery}`).then(r => r.ok ? r.json() : { data: [] }),
        apiFetch(`/api/assessments${schoolQuery}`).then(r => r.ok ? r.json() : { data: [] }),
        apiFetch(`/api/dokumen-bukti?${params.toString()}`).then(r => r.ok ? r.json() : { data: [] }),
        apiFetch(`/api/laporan-kinerja${schoolQuery}`).then(r => r.ok ? r.json() : { data: [] }),
        apiFetch(`/api/raport${schoolQuery}`).then(r => r.ok ? r.json() : { data: [] })
      ]);

      const docs = Array.isArray(docsRes) ? docsRes : (docsRes?.data ?? []);
      const journals = Array.isArray(journalsRes) ? journalsRes : (journalsRes?.data ?? []);
      const assessments = Array.isArray(assessmentsRes) ? assessmentsRes : (assessmentsRes?.data ?? []);
      const fileSaya = Array.isArray(fileSayaRes) ? fileSayaRes : (fileSayaRes?.data ?? []);
      const laporanKinerja = Array.isArray(laporanKinerjaRes) ? laporanKinerjaRes : (laporanKinerjaRes?.data ?? []);
      const raport = Array.isArray(raportRes) ? raportRes : (raportRes?.data ?? []);

      setVirtualCounts({
        system_silabus: docs.filter((d: any) => d.tipe_dokumen === "silabus").length,
        system_atp: docs.filter((d: any) => d.tipe_dokumen === "atp").length,
        system_prota: docs.filter((d: any) => d.tipe_dokumen === "prota").length,
        system_prosem: docs.filter((d: any) => d.tipe_dokumen === "prosem").length,
        system_rpp: docs.filter((d: any) => d.tipe_dokumen === "rpp" || d.tipe_dokumen === "modul").length,
        system_lkpd: docs.filter((d: any) => d.tipe_dokumen === "lkpd" || d.tipe_dokumen === "laporan_lkpd").length,
        system_bahan_ajar: docs.filter((d: any) => d.tipe_dokumen === "bahan_ajar").length,
        system_soal: docs.filter((d: any) => d.tipe_dokumen === "soal").length,
        system_jurnal: journals.length,
        system_nilai: assessments.length,
        system_file_saya: fileSaya.length,
        system_laporan_kinerja: laporanKinerja.length,
        system_raport: raport.length
      });
    } catch (err) {
      console.error("Gagal mengambil virtual counts:", err);
    }
  }, [selectedSchoolId]);

  useEffect(() => {
    loadVirtualCounts();
  }, [selectedSchoolId, loadVirtualCounts]);

  // Track unlocked folders in session
  const [unlockedFolders, setUnlockedFolders] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem("gurupro_unlocked_folders");
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const addUnlockedFolder = (id: string) => {
    const updated = [...new Set([...unlockedFolders, id])];
    setUnlockedFolders(updated);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("gurupro_unlocked_folders", JSON.stringify(updated));
    }
  };

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadData = useCallback(async (folderId: string | null) => {
    setIsLoading(true);
    try {
      if (folderId && folderId.startsWith("system_")) {
        setFolders([]);
        
        let url = "";
        let filterFn = (item: any) => true;

        if (folderId === "system_silabus") {
          url = "/api/administrasi?tipe=silabus";
        } else if (folderId === "system_atp") {
          url = "/api/administrasi?tipe=atp";
        } else if (folderId === "system_prota") {
          url = "/api/administrasi?tipe=prota";
        } else if (folderId === "system_prosem") {
          url = "/api/administrasi?tipe=prosem";
        } else if (folderId === "system_rpp") {
          url = "/api/administrasi";
          filterFn = (d: any) => d.tipe_dokumen === "rpp" || d.tipe_dokumen === "modul";
        } else if (folderId === "system_lkpd") {
          url = "/api/administrasi";
          filterFn = (d: any) => d.tipe_dokumen === "lkpd" || d.tipe_dokumen === "laporan_lkpd";
        } else if (folderId === "system_bahan_ajar") {
          url = "/api/administrasi?tipe=bahan_ajar";
        } else if (folderId === "system_soal") {
          url = "/api/administrasi?tipe=soal";
        } else if (folderId === "system_jurnal") {
          url = "/api/journals?limit=100";
        } else if (folderId === "system_nilai") {
          url = "/api/assessments";
        } else if (folderId === "system_file_saya") {
          const params = new URLSearchParams();
          const semester = typeof window !== 'undefined' ? (localStorage.getItem('semester') || '') : '';
          const tahunAjaranId = typeof window !== 'undefined' ? (localStorage.getItem('tahunAjaranId') || '') : '';
          if (semester) params.set('semester', semester);
          if (tahunAjaranId) params.set('tahun_ajaran_id', tahunAjaranId);
          url = `/api/dokumen-bukti?${params.toString()}`;
        } else if (folderId === "system_laporan_kinerja") {
          url = "/api/laporan-kinerja";
        } else if (folderId === "system_raport") {
          url = "/api/raport";
        }

        // Apply school selection filter where appropriate
        if (folderId !== "system_file_saya" && selectedSchoolId) {
          const sep = url.includes("?") ? "&" : "?";
          url += `${sep}school_id=${selectedSchoolId}`;
        }

        const res = await apiFetch(url);
        if (res.ok) {
          const rawData = await res.json();
          const items = Array.isArray(rawData) ? rawData : (rawData?.data ?? []);
          const filtered = items.filter(filterFn);

          const mapped: FileItem[] = filtered.map((item: any) => {
            if (folderId.startsWith("system_silabus") || folderId === "system_atp" || folderId === "system_prota" || folderId === "system_prosem" || folderId === "system_rpp" || folderId === "system_lkpd" || folderId === "system_bahan_ajar" || folderId === "system_soal") {
              const kontenObj = typeof item.konten === "string" ? JSON.parse(item.konten) : item.konten;
              const docUrl = kontenObj?.pdf_url || kontenObj?.docx_url || "";
              const sizeVal = (kontenObj?.markdown || kontenObj?.html || "").length || 2048;
              return {
                id: item.id,
                user_id: item.user_id || "",
                folder_id: folderId,
                name: item.judul_dokumen || "Dokumen Tanpa Judul",
                r2_key: "",
                r2_url: docUrl,
                size: sizeVal,
                mime_type: kontenObj?.pdf_url ? "application/pdf" : kontenObj?.docx_url ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/octet-stream",
                created_at: item.created_at,
                updated_at: item.created_at,
                is_system: true,
                konten: kontenObj,
                approval_status: item.approval_status || null,
                approval_note: item.approval_note || null,
                tipe_dokumen: item.tipe_dokumen || null,
              } as any;
            } else if (folderId === "system_jurnal") {
              const customValuesObj = typeof item.custom_values === "string" ? JSON.parse(item.custom_values) : item.custom_values;
              const docUrl = customValuesObj?.pdf_url || customValuesObj?.docx_url || "";
              const sizeVal = (customValuesObj?.markdown || "").length || 2048;
              const tanggalFormatted = new Date(item.tanggal).toLocaleDateString("id-ID");
              return {
                id: item.id,
                user_id: item.teacher_id || "",
                folder_id: folderId,
                name: `Jurnal - ${item.nama_mapel || "Mata Pelajaran"} Kelas ${item.nama_kelas || "Kelas"} (${tanggalFormatted})`,
                r2_key: "",
                r2_url: docUrl,
                size: sizeVal,
                mime_type: customValuesObj?.pdf_url ? "application/pdf" : "application/octet-stream",
                created_at: item.created_at,
                updated_at: item.created_at,
                is_system: true,
                custom_values: customValuesObj,
              } as any;
            } else if (folderId === "system_nilai") {
              return {
                id: item.id,
                user_id: "",
                folder_id: folderId,
                name: `${item.nama_asesmen || "Asesmen"} - Kelas ${item.nama_kelas || "Kelas"} (${item.nama_mapel || ""})`,
                r2_key: "",
                r2_url: "",
                size: 1536,
                mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                created_at: item.created_at,
                updated_at: item.created_at,
                is_system: true,
                assessment_info: item,
              } as any;
            } else if (folderId === "system_file_saya") {
              return {
                id: item.id,
                user_id: item.user_id || "",
                folder_id: folderId,
                name: item.judul || "Bukti Dukung",
                r2_key: "",
                r2_url: item.file_url || "",
                size: item.size || item.file_size || 5120,
                mime_type: item.file_url?.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg",
                created_at: item.created_at,
                updated_at: item.created_at,
                is_system: true,
              } as any;
            } else if (folderId === "system_laporan_kinerja") {
              const contentLen = typeof item.konten === "string" ? item.konten.length : (item.konten?.markdown?.length || 4096);
              return {
                id: item.id,
                user_id: "",
                folder_id: folderId,
                name: `${item.judul || "Laporan Kinerja"} - Semester ${item.semester || "1"} (${item.status || "Draft"})`,
                r2_key: "",
                r2_url: `/api/laporan-kinerja/${item.id}/download`,
                size: contentLen,
                mime_type: "application/pdf",
                created_at: item.created_at,
                updated_at: item.created_at,
                is_system: true,
              } as any;
            } else if (folderId === "system_raport") {
              return {
                id: item.id,
                user_id: "",
                folder_id: folderId,
                name: `Rapor Siswa - ${item.nama_siswa} (Kelas ${item.nama_kelas} - ${item.periode})`,
                r2_key: "",
                r2_url: `/api/raport/download?id=${item.id}`,
                size: 8192,
                mime_type: "text/html",
                created_at: item.created_at,
                updated_at: item.created_at,
                is_system: true,
              } as any;
            }
            return item;
          });

          setFiles(mapped);
        } else {
          showToast("Gagal memuat berkas sistem", "error");
        }
      } else {
        const folderParams = folderId ? `?parent_id=${folderId}` : `?parent_id=null`;
        const fileParams = folderId ? `?folder_id=${folderId}` : `?folder_id=null`;

        const [foldersRes, filesRes] = await Promise.all([
          apiFetch(`/api/storage/folders${folderParams}`),
          apiFetch(`/api/storage/files${fileParams}`),
        ]);

        if (foldersRes.ok) {
          const fData = await foldersRes.json();
          if (folderId === null) {
            loadVirtualCounts();
            const virtualList = VIRTUAL_FOLDERS.map((vf) => ({
              id: vf.id,
              user_id: "",
              name: vf.name,
              parent_id: null,
              pin: null,
              created_at: "",
              updated_at: "",
              is_system: true,
              color: vf.color,
            }));
            setFolders([...virtualList, ...fData]);
          } else {
            setFolders(fData);
          }
        }
        if (filesRes.ok) {
          const fiData = await filesRes.json();
          setFiles(fiData?.data ?? (Array.isArray(fiData) ? fiData : []));
        }
      }
    } catch {
      showToast("Gagal memuat data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast, selectedSchoolId, loadVirtualCounts]);

  useEffect(() => {
    loadData(currentFolderId);
  }, [currentFolderId, loadData]);


  useEffect(() => {
    if (previewFile && previewFile.is_system && previewFile.folder_id === "system_nilai") {
      setGradesLoading(true);
      apiFetch(`/api/assessments/grades?assessment_id=${previewFile.id}`)
        .then(res => res.json())
        .then(data => {
          setGradesData(Array.isArray(data) ? data : []);
        })
        .catch(() => setGradesData([]))
        .finally(() => setGradesLoading(false));
    } else {
      setGradesData([]);
    }
  }, [previewFile]);

  const handleFolderClick = (folder: Folder) => {
    if (folder.pin && !unlockedFolders.includes(folder.id)) {
      setShowPinModal({ folder });
      setPinInput("");
      setPinError("");
    } else {
      navigateToFolder(folder.id, folder.name);
    }
  };

  const navigateToFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setSearchQuery("");
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = breadcrumbs[index];
    setCurrentFolderId(target.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setSearchQuery("");
  };


  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await apiFetch("/api/storage/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim(), parent_id: currentFolderId }),
      });
      if (res.ok) {
        showToast("Folder berhasil dibuat");
        setNewFolderName("");
        setShowCreateFolder(false);
        loadData(currentFolderId);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal membuat folder", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenaming(true);
    try {
      const endpoint =
        renameTarget.type === "folder"
          ? `/api/storage/folders?id=${renameTarget.id}`
          : `/api/storage/files?id=${renameTarget.id}`;
      const res = await apiFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        showToast(`${renameTarget.type === "folder" ? "Folder" : "File"} berhasil diubah namanya`);
        setShowRenameModal(false);
        setRenameTarget(null);
        loadData(currentFolderId);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal mengubah nama", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (target: Folder | FileItem, type: "folder" | "file") => {
    const label = type === "folder" ? "folder" : "file";
    if (!confirm(`Apakah Anda yakin ingin menghapus ${label} "${target.name}"?`)) return;

    try {
      let endpoint = "";
      let method = "DELETE";

      if ((target as any).is_system) {
        const folderId = (target as any).folder_id;
        if (!folderId) return;
        if (folderId.startsWith("system_silabus") || folderId === "system_atp" || folderId === "system_prota" || folderId === "system_prosem" || folderId === "system_rpp" || folderId === "system_lkpd" || folderId === "system_bahan_ajar" || folderId === "system_soal") {
          endpoint = `/api/administrasi?id=${target.id}`;
        } else if (folderId === "system_jurnal") {
          endpoint = `/api/journals?id=${target.id}`;
        } else if (folderId === "system_nilai") {
          endpoint = `/api/assessments?id=${target.id}`;
        } else if (folderId === "system_file_saya") {
          endpoint = `/api/dokumen-bukti?id=${target.id}`;
        } else if (folderId === "system_laporan_kinerja") {
          endpoint = `/api/laporan-kinerja/${target.id}`;
        } else {
          showToast("Berkas ini tidak dapat dihapus", "error");
          return;
        }
      } else {
        endpoint =
          type === "folder"
            ? `/api/storage/folders?id=${target.id}`
            : `/api/storage/files?id=${target.id}`;
      }

      const res = await apiFetch(endpoint, { method });
      if (res.ok) {
        showToast(`${label === "folder" ? "Folder" : "File"} berhasil dihapus`);
        setContextMenu(null);
        loadData(currentFolderId);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    }
  };

  // ── Share ──
  const getShareText = (file: FileItem) => {
    return `Saya membagikan file "${file.name}" kepada Anda:\n${file.r2_url}`;
  };

  const shareViaWhatsApp = (file: FileItem) => {
    const text = encodeURIComponent(getShareText(file));
    window.open(`https://wa.me/?text=${text}`, "_blank");
    setShowShareMenu(null);
  };

  const shareViaEmail = (file: FileItem) => {
    const subject = encodeURIComponent(`File: ${file.name}`);
    const body = encodeURIComponent(getShareText(file));
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    setShowShareMenu(null);
  };

  // ── PIN ──
  const handleVerifyPin = async () => {
    if (!showPinModal || !pinInput.trim()) return;
    setVerifyingPin(true);
    setPinError("");
    try {
      const res = await apiFetch("/api/storage/folders/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", folder_id: showPinModal.folder.id, pin: pinInput }),
      });
      if (res.ok) {
        addUnlockedFolder(showPinModal.folder.id);
        const folder = showPinModal.folder;
        setShowPinModal(null);
        setPinInput("");
        navigateToFolder(folder.id, folder.name);
      } else {
        const data = await res.json();
        setPinError(data.error || "PIN salah");
      }
    } catch {
      setPinError("Koneksi bermasalah");
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleSetPin = async () => {
    if (!showSetPinModal || !setPinValue.trim()) return;
    if (!/^\d{4,6}$/.test(setPinValue)) {
      showToast("PIN harus 4-6 digit angka", "error");
      return;
    }
    setSettingPin(true);
    try {
      const res = await apiFetch("/api/storage/folders/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set",
          folder_id: showSetPinModal.folder.id,
          pin: setPinValue,
        }),
      });
      if (res.ok) {
        showToast("PIN berhasil disimpan");
        setShowSetPinModal(null);
        setSetPinValue("");
        loadData(currentFolderId);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menyimpan PIN", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    } finally {
      setSettingPin(false);
    }
  };

  const handleRemovePin = async (folder: Folder) => {
    if (!confirm("Hapus PIN folder ini?")) return;
    try {
      const res = await apiFetch("/api/storage/folders/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", folder_id: folder.id }),
      });
      if (res.ok) {
        showToast("PIN berhasil dihapus");
        setContextMenu(null);
        loadData(currentFolderId);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus PIN", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    }
  };

  const handleForgotPinRequest = async () => {
    if (!showPinModal) return;
    setResettingPin(true);
    try {
      const res = await apiFetch("/api/storage/folders/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forgot", folder_id: showPinModal.folder.id }),
      });
      if (res.ok) {
        setResetCodeSent(true);
        setShowForgotPinModal(true);
        showToast("Kode reset sedang dikirim ke email Anda. Cek juga folder spam.", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal mengirim kode reset", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    } finally {
      setResettingPin(false);
    }
  };

  const handleResetPin = async () => {
    if (!showPinModal || !forgotPinCode.trim() || !forgotPinNewPin.trim()) return;
    if (!/^\d{4,6}$/.test(forgotPinNewPin)) {
      showToast("PIN baru harus 4-6 digit angka", "error");
      return;
    }
    setResettingPin(true);
    try {
      const res = await apiFetch("/api/storage/folders/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          folder_id: showPinModal.folder.id,
          code: forgotPinCode.trim(),
          new_pin: forgotPinNewPin.trim(),
        }),
      });
      if (res.ok) {
        showToast("PIN berhasil direset, silakan buka folder");
        setShowForgotPinModal(false);
        setShowPinModal(null);
        setForgotPinCode("");
        setForgotPinNewPin("");
        setResetCodeSent(false);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal mereset PIN", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    } finally {
      setResettingPin(false);
    }
  };

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const file = formData.get("file") as File;
    if (!file || file.size === 0) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast("Ukuran file maksimal 2MB", "error");
      return;
    }

    if (currentFolderId) formData.append("folder_id", currentFolderId);

    try {
      const res = await apiFetch("/api/storage/files", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        showToast("File berhasil diupload");
        setShowUploadModal(false);
        loadData(currentFolderId);
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal upload file", "error");
      }
    } catch {
      showToast("Koneksi bermasalah", "error");
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getFileIcon = (mime: string) => {
    if (mime.startsWith("image/")) return "🖼️";
    if (mime.includes("pdf")) return "📄";
    if (mime.includes("word") || mime.includes("document")) return "📝";
    if (mime.includes("sheet") || mime.includes("excel")) return "📊";
    if (mime.includes("presentation") || mime.includes("powerpoint")) return "📽️";
    if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return "🗜️";
    if (mime.includes("video")) return "🎬";
    if (mime.includes("audio")) return "🎵";
    return "📄";
  };

  const canPreview = (_mime: string) => true;

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openRename = (target: Folder | FileItem, type: "folder" | "file") => {
    setRenameTarget({ id: target.id, name: target.name, type });
    setRenameValue(target.name);
    setShowRenameModal(true);
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, target: Folder | FileItem, type: "folder" | "file") => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, target, type });
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const generatePrintLayout = (title: string, markdown: string) => {
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

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4; margin: 25mm 20mm 20mm 30mm; }
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; padding: 10px; }
          h1, h2, h3 { page-break-after: avoid; }
          p { margin: 0 0 8pt 0; text-align: justify; }
          table { page-break-inside: avoid; width: 100%; border-collapse: collapse; margin-top: 8pt; margin-bottom: 8pt; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background-color: #f1f5f9; font-weight: bold; }
          li { line-height: 1.6; margin-bottom: 4pt; }
        </style>
      </head>
      <body>
        ${kopSuratHtml}
        <div style="margin-top: 10pt;">
          ${bodyHtml}
        </div>
      </body>
      </html>
    `;
  };

  const downloadDocxClient = (title: string, markdown: string) => {
    const htmlContent = generatePrintLayout(title, markdown);
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Berkas Word (.doc) berhasil diunduh!", "success");
  };

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

  const downloadPdfClient = async (title: string, markdown: string) => {
    showToast("Mempersiapkan ekspor PDF...", "success");
    try {
      const html2pdf = await loadHtml2Pdf();
      const content = document.createElement('div');
      content.innerHTML = generatePrintLayout(title, markdown);
      
      const opt = {
        margin: [15, 15, 15, 15],
        filename: `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().from(content).set(opt).save();
      showToast("Berkas PDF berhasil diunduh!", "success");
    } catch (e: any) {
      console.error(e);
      showToast("Gagal mengekspor PDF: " + e.message, "error");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto font-sans">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-sm font-bold text-white transition-all animate-fade-in ${
            toast.type === "success" ? "bg-emerald-500" : "bg-red-500"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[90] w-48 bg-white border border-gray-200 rounded-xl shadow-xl py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "folder" && (
            <>
              <button
                onClick={() => {
                  handleFolderClick(contextMenu.target as Folder);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
              >
                <IconFolder size={16} stroke={1.5} /> Buka
              </button>
              {!(contextMenu.target as any).is_system && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  {(contextMenu.target as Folder).pin ? (
                    <>
                      <button
                        onClick={() => {
                          setShowSetPinModal({ folder: contextMenu.target as Folder, mode: "change" });
                          setSetPinValue("");
                          setContextMenu(null);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
                      >
                        <IconLock size={16} stroke={1.5} /> Ubah PIN
                      </button>
                      <button
                        onClick={() => handleRemovePin(contextMenu.target as Folder)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-amber-600 hover:bg-amber-50 text-left cursor-pointer"
                      >
                        <IconLockOpen size={16} stroke={1.5} /> Buka Kunci
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setShowSetPinModal({ folder: contextMenu.target as Folder, mode: "set" });
                        setSetPinValue("");
                        setContextMenu(null);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
                    >
                      <IconShieldLock size={16} stroke={1.5} /> Kunci Folder
                    </button>
                  )}
                </>
              )}
              <div className="border-t border-gray-100 my-1" />
            </>
          )}
          {!(contextMenu.target as any).is_system && (
            <button
              onClick={() => openRename(contextMenu.target, contextMenu.type)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
            >
              <IconPencil size={16} stroke={1.5} /> Ubah Nama
            </button>
          )}
          {(!(contextMenu.target as any).is_system || ((contextMenu.target as any).folder_id !== "system_raport")) && (
            <button
              onClick={() => {
                handleDelete(contextMenu.target, contextMenu.type);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left cursor-pointer"
            >
              <IconTrash size={16} stroke={1.5} /> Hapus
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 mb-1">
            <button
              onClick={() => {
                setCurrentFolderId(null);
                setBreadcrumbs([{ id: null, name: "Brankas" }]);
                setSearchQuery("");
              }}
              className="hover:text-violet-600 transition cursor-pointer"
            >
              <IconHome size={14} stroke={1.5} />
            </button>
            {breadcrumbs.length > 1 ? (
              breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <IconChevronRight size={12} stroke={1.5} />
                  {i === breadcrumbs.length - 1 ? (
                    <span className="text-gray-700">{crumb.name}</span>
                  ) : (
                    <button
                      onClick={() => navigateToBreadcrumb(i)}
                      className="hover:text-violet-600 transition cursor-pointer"
                    >
                      {crumb.name}
                    </button>
                  )}
                </React.Fragment>
              ))
            ) : null}
          </div>
          <h3 className="text-xl font-bold text-gray-900">Brankas</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {folders.length} folder &middot; {files.length} file
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(currentFolderId)}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition cursor-pointer"
            title="Refresh"
          >
            <IconRefresh size={18} stroke={1.5} />
          </button>
          {!(currentFolderId && currentFolderId.startsWith("system_")) && (
            <>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition cursor-pointer"
              >
                <IconFolderPlus size={18} stroke={1.5} />
                Folder Baru
              </button>
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition shadow-sm cursor-pointer"
              >
                <IconUpload size={18} stroke={1.5} />
                Upload
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <IconSearch
          size={18}
          stroke={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari folder atau file..."
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-gray-400">Memuat...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Folders */}
          {filteredFolders.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Folder</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onClick={() => handleFolderClick(folder)}
                    onContextMenu={(e) => handleContextMenu(e, folder, "folder")}
                    className={`group bg-white rounded-2xl p-4 border transition-all duration-200 cursor-pointer relative ${
                      (folder as any).is_system 
                        ? "hover:bg-slate-50 border-gray-200 hover:border-slate-300"
                        : "hover:bg-violet-50 border-gray-200 hover:border-violet-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        (folder as any).is_system 
                          ? `bg-slate-50 ${(folder as any).color || 'text-violet-600'}` 
                          : "bg-violet-100 text-violet-600"
                      }`}>
                        {folder.pin ? (
                          <IconLock size={20} stroke={1.5} />
                        ) : (
                          <IconFolder size={22} stroke={1.5} />
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContextMenu(e, folder, "folder");
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-white/60 transition cursor-pointer"
                      >
                        <IconDotsVertical size={16} stroke={1.5} className="text-gray-400" />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mt-3 truncate">
                      {folder.pin && <IconLock size={10} stroke={2} className="inline mr-1 text-amber-500 -mt-0.5" />}
                      {folder.name}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {(folder as any).is_system 
                        ? `${virtualCounts[folder.id] ?? 0} Berkas` 
                        : new Date(folder.created_at).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {filteredFiles.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">File</h4>
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="divide-y divide-gray-100">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.id}
                      onContextMenu={(e) => handleContextMenu(e, file, "file")}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition group"
                    >
                      <span className="text-xl">{getFileIcon(file.mime_type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400">
                          {formatSize(file.size)} &middot;{" "}
                          {new Date(file.created_at).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        {file.is_system && ["rpp", "modul"].includes(file.tipe_dokumen || "") && (
                          <div className="mt-1 space-y-1">
                            <ApprovalStatusBadge status={(file.approval_status || "draft") as any} />
                            {file.approval_status === "revisi" && file.approval_note && (
                              <p className="text-[10px] text-rose-600 bg-rose-50 border border-rose-100 rounded-md px-2 py-1">
                                <span className="font-bold">Catatan Kepsek:</span> {file.approval_note}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {canPreview(file.mime_type) && (
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                            title="Preview"
                          >
                            <IconEye size={16} stroke={1.5} />
                          </button>
                        )}
                        {(file.is_system ? !!file.r2_url : true) && (
                          <a
                            href={file.is_system ? file.r2_url : `/api/storage/files/download?id=${file.id}`}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            title="Download"
                            target={file.is_system ? "_blank" : undefined}
                            download={file.is_system ? undefined : true}
                          >
                            <IconDownload size={16} stroke={1.5} />
                          </a>
                        )}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowShareMenu(showShareMenu?.file?.id === file.id ? null : { file });
                            }}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                            title="Bagikan"
                          >
                            <IconShare size={16} stroke={1.5} />
                          </button>
                          {showShareMenu?.file?.id === file.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white border border-gray-200 rounded-xl shadow-xl py-1">
                                <button
                                  onClick={() => shareViaWhatsApp(file)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
                                >
                                  <IconBrandWhatsapp size={16} stroke={1.5} className="text-green-500" /> WhatsApp
                                </button>
                                <button
                                  onClick={() => shareViaEmail(file)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
                                >
                                  <IconMail size={16} stroke={1.5} className="text-blue-500" /> Email
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                        {!file.is_system && (
                          <button
                            onClick={() => openRename(file, "file")}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                            title="Ubah Nama"
                          >
                            <IconPencil size={16} stroke={1.5} />
                          </button>
                        )}
                        {(!file.is_system || file.folder_id !== "system_raport") && (
                          <button
                            onClick={() => handleDelete(file, "file")}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 cursor-pointer"
                            title="Hapus"
                          >
                            <IconTrash size={16} stroke={1.5} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {!currentFolderId && filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <IconFolder size={36} stroke={1} className="text-gray-300" />
              </div>
              <h4 className="text-base font-bold text-gray-700">Mulai dari sini</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Buat folder baru untuk menyimpan dokumen Anda.
              </p>
            </div>
          )}

          {currentFolderId && filteredFolders.length === 0 && filteredFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <IconFolder size={36} stroke={1} className="text-gray-300" />
              </div>
              <h4 className="text-base font-bold text-gray-700">Folder kosong</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                Upload file atau buat folder baru di sini.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Buat Folder Baru</h3>
              <button
                onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nama folder..."
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCreateFolder(false); setNewFolderName(""); }}
                className="px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-4 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {creatingFolder ? "Membuat..." : "Buat Folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Upload File</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-4 hover:border-violet-300 transition">
                <IconUpload size={32} stroke={1} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-500 mb-1">Pilih file untuk diupload</p>
                <p className="text-[10px] text-gray-400">Maksimal 2MB</p>
                <input
                  type="file"
                  name="file"
                  required
                  className="mt-3 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition cursor-pointer"
                >
                  Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                Ubah Nama {renameTarget.type === "folder" ? "Folder" : "File"}
              </h3>
              <button
                onClick={() => { setShowRenameModal(false); setRenameTarget(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowRenameModal(false); setRenameTarget(null); }}
                className="px-4 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleRename}
                disabled={renaming || !renameValue.trim()}
                className="px-4 py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
              >
                {renaming ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-b border-gray-100">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 truncate">{previewFile.name}</h3>
                
                {/* Export Buttons in the Top-Left of the Preview */}
                {previewFile.is_system && previewFile.folder_id === "system_nilai" ? (
                  gradesData.length > 0 && (
                    <button
                      onClick={() => {
                        const headers = "No Absen,Nama Siswa,NISN,Nilai Awal,Nilai Remedial,Nilai Akhir\n";
                        const rows = gradesData.map(g => `${g.nomor_absen || ""},${g.nama_siswa},${g.nisn || ""},${g.nilai_awal ?? ""},${g.nilai_remedial ?? ""},${g.nilai_akhir ?? ""}`).join("\n");
                        const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `BukuNilai_${previewFile.name.replace(/\s+/g, "_")}.csv`;
                        link.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                    >
                      <IconDownload size={14} stroke={1.5} /> Ekspor CSV
                    </button>
                  )
                ) : previewFile.is_system && ((previewFile.konten as any)?.markdown || (previewFile.custom_values as any)?.markdown) ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const md = (previewFile.konten as any)?.markdown || (previewFile.custom_values as any)?.markdown || "";
                        downloadDocxClient(previewFile.name, md);
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white border border-blue-200 hover:bg-blue-50 text-blue-700 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📘 Word
                    </button>
                    <button
                      onClick={() => {
                        const pdfUrl = (previewFile.konten as any)?.pdf_url || (previewFile.custom_values as any)?.pdf_url;
                        if (pdfUrl) {
                          window.open(pdfUrl, "_blank");
                        } else {
                          const md = (previewFile.konten as any)?.markdown || (previewFile.custom_values as any)?.markdown || "";
                          downloadPdfClient(previewFile.name, md);
                        }
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition flex items-center gap-1.5 cursor-pointer font-sans"
                    >
                      📕 PDF
                    </button>
                    {((previewFile.konten as any)?.pptx_url || (previewFile.custom_values as any)?.pptx_url) && (
                      <a
                        href={(previewFile.konten as any)?.pptx_url || (previewFile.custom_values as any)?.pptx_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition flex items-center gap-1.5 font-bold cursor-pointer font-sans"
                      >
                        📊 PPTX
                      </a>
                    )}
                  </div>
                ) : (previewFile.is_system ? !!previewFile.r2_url : true) && (
                  <a
                    href={previewFile.is_system ? previewFile.r2_url : `/api/storage/files/download?id=${previewFile.id}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                    target={previewFile.is_system ? "_blank" : undefined}
                    download={previewFile.is_system ? undefined : true}
                  >
                    <IconDownload size={14} stroke={1.5} /> Download
                  </a>
                )}
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer ml-auto shrink-0"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
              {previewFile.is_system && previewFile.folder_id === "system_nilai" ? (
                gradesLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-bold text-gray-400">Memuat Buku Nilai...</p>
                  </div>
                ) : gradesData.length === 0 ? (
                  <div className="text-center text-slate-400 italic py-16 text-xs">
                    Tidak ada data nilai siswa untuk asesmen ini.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto bg-white rounded-xl border border-gray-150 p-4 max-h-[65vh]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-bold uppercase">
                          <th className="py-2.5 px-3 w-12 text-center">Absen</th>
                          <th className="py-2.5 px-3">Nama Siswa</th>
                          <th className="py-2.5 px-3 text-center">Nilai Awal</th>
                          <th className="py-2.5 px-3 text-center">Nilai Remedial</th>
                          <th className="py-2.5 px-3 text-center">Nilai Akhir</th>
                          <th className="py-2.5 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        {gradesData.map((g, idx) => (
                          <tr key={`${g.student_id || 'no-id'}-${idx}`} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-center text-gray-400">{g.nomor_absen || idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800">{g.nama_siswa}</td>
                            <td className="py-2.5 px-3 text-center">{g.nilai_awal ?? "-"}</td>
                            <td className="py-2.5 px-3 text-center">{g.nilai_remedial ?? "-"}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-violet-700">{g.nilai_akhir ?? "-"}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                g.status_remedial === "lulus" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                              }`}>
                                {g.status_remedial === "lulus" ? "Lulus" : "Remedial"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : previewFile.is_system && (previewFile.konten as any)?.markdown ? (
                <iframe
                  srcDoc={generatePrintLayout(previewFile.name, (previewFile.konten as any).markdown)}
                  className="w-full h-[70vh] rounded-lg"
                  title={previewFile.name}
                />
              ) : previewFile.is_system && previewFile.folder_id === "system_raport" ? (
                <iframe
                  src={previewFile.r2_url}
                  className="w-full h-[70vh] rounded-lg"
                  title={previewFile.name}
                />
              ) : previewFile.mime_type.startsWith("image/") ? (
                <img
                  src={previewFile.is_system ? previewFile.r2_url : previewFile.r2_url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : previewFile.mime_type.includes("pdf") ? (
                <iframe
                  src={previewFile.is_system ? previewFile.r2_url : `/api/storage/files/download?id=${previewFile.id}`}
                  className="w-full h-[70vh] rounded-lg"
                  title={previewFile.name}
                />
              ) : (
                <div className="text-center">
                  <span className="text-5xl block mb-3">{getFileIcon(previewFile.mime_type)}</span>
                  <p className="text-sm font-bold text-gray-700">{previewFile.name}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatSize(previewFile.size)}
                  </p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-gray-100 text-slate-500 text-xs font-semibold">
              <span>Tipe: {previewFile.mime_type.split("/")[1]?.toUpperCase() || "DOKUMEN"}</span>
              <p className="text-xs text-gray-400 ml-auto">
                Ukuran: {formatSize(previewFile.size)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PIN Entry Modal ── */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Folder Terkunci</h3>
              <button
                onClick={() => { setShowPinModal(null); setPinInput(""); setPinError(""); }}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Folder <strong>&ldquo;{showPinModal.folder.name}&rdquo;</strong> dilindungi PIN. Masukkan PIN untuk membuka.
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyPin()}
              placeholder="Masukkan PIN (4-6 digit)"
              autoFocus
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3 text-center tracking-widest font-mono"
            />
            {pinError && (
              <p className="text-xs text-red-500 mb-3 text-center">{pinError}</p>
            )}
            <button
              onClick={handleVerifyPin}
              disabled={verifyingPin || !pinInput.trim()}
              className="w-full py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition disabled:opacity-50 cursor-pointer mb-2"
            >
              {verifyingPin ? "Memverifikasi..." : "Buka Folder"}
            </button>
            <button
              onClick={handleForgotPinRequest}
              disabled={resettingPin}
              className="w-full text-center text-xs font-semibold text-violet-600 hover:text-violet-700 cursor-pointer disabled:opacity-50"
            >
              {resettingPin ? "Mengirim..." : "Lupa PIN?"}
            </button>
          </div>
        </div>
      )}

      {/* ── Set / Change PIN Modal ── */}
      {showSetPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">
                {showSetPinModal.mode === "set" ? "Kunci Folder" : "Ubah PIN"}
              </h3>
              <button
                onClick={() => { setShowSetPinModal(null); setSetPinValue(""); }}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              {showSetPinModal.mode === "set"
                ? `Folder "${showSetPinModal.folder.name}" akan dikunci dengan PIN.`
                : `Ubah PIN untuk folder "${showSetPinModal.folder.name}".`}
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={setPinValue}
              onChange={(e) => setSetPinValue(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleSetPin()}
              placeholder="Masukkan PIN baru (4-6 digit)"
              autoFocus
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4 text-center tracking-widest font-mono"
            />
            <button
              onClick={handleSetPin}
              disabled={settingPin || !/^\d{4,6}$/.test(setPinValue)}
              className="w-full py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              {settingPin ? "Menyimpan..." : showSetPinModal.mode === "set" ? "Kunci Folder" : "Simpan PIN Baru"}
            </button>
          </div>
        </div>
      )}

      {/* ── Forgot PIN Modal ── */}
      {showForgotPinModal && showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Reset PIN</h3>
              <button
                onClick={() => { setShowForgotPinModal(false); setResetCodeSent(false); }}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Kode reset telah dikirim ke email terdaftar Anda. Masukkan kode dan PIN baru di bawah.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={forgotPinCode}
              onChange={(e) => setForgotPinCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Kode reset (6 digit)"
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-3 text-center tracking-widest font-mono"
            />
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={forgotPinNewPin}
              onChange={(e) => setForgotPinNewPin(e.target.value.replace(/\D/g, ""))}
              placeholder="PIN baru (4-6 digit)"
              className="w-full px-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-4 text-center tracking-widest font-mono"
            />
            <button
              onClick={handleResetPin}
              disabled={resettingPin || !forgotPinCode.trim() || !/^\d{4,6}$/.test(forgotPinNewPin)}
              className="w-full py-2.5 text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition disabled:opacity-50 cursor-pointer"
            >
              {resettingPin ? "Mereset..." : "Reset PIN"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
