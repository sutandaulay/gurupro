"use client";

import React, { useState, useEffect, useCallback } from "react";
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
}

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
      const folderParams = folderId ? `?parent_id=${folderId}` : `?parent_id=null`;
      const fileParams = folderId ? `?folder_id=${folderId}` : `?folder_id=null`;

      const [foldersRes, filesRes] = await Promise.all([
        fetch(`/api/storage/folders${folderParams}`),
        fetch(`/api/storage/files${fileParams}`),
      ]);

      if (foldersRes.ok) {
        const fData = await foldersRes.json();
        setFolders(fData);
      }
      if (filesRes.ok) {
        const fiData = await filesRes.json();
        setFiles(fiData);
      }
    } catch {
      showToast("Gagal memuat data", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData(currentFolderId);
  }, [currentFolderId, loadData]);

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
      const res = await fetch("/api/storage/folders", {
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
      const res = await fetch(endpoint, {
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
      const endpoint =
        type === "folder"
          ? `/api/storage/folders?id=${target.id}`
          : `/api/storage/files?id=${target.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
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
      const res = await fetch("/api/storage/folders/pin", {
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
      const res = await fetch("/api/storage/folders/pin", {
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
      const res = await fetch("/api/storage/folders/pin", {
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
      const res = await fetch("/api/storage/folders/pin", {
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
      const res = await fetch("/api/storage/folders/pin", {
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
      const res = await fetch("/api/storage/files", {
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
              <div className="border-t border-gray-100 my-1" />
            </>
          )}
          <button
            onClick={() => openRename(contextMenu.target, contextMenu.type)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-left cursor-pointer"
          >
            <IconPencil size={16} stroke={1.5} /> Ubah Nama
          </button>
          <button
            onClick={() => {
              handleDelete(contextMenu.target, contextMenu.type);
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 text-left cursor-pointer"
          >
            <IconTrash size={16} stroke={1.5} /> Hapus
          </button>
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
                    className="group bg-white hover:bg-violet-50 border border-gray-200 hover:border-violet-300 rounded-2xl p-4 transition-all duration-200 cursor-pointer relative"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
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
                      {new Date(folder.created_at).toLocaleDateString("id-ID", {
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
                        <a
                          href={`/api/storage/files/download?id=${file.id}`}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                          title="Download"
                        >
                          <IconDownload size={16} stroke={1.5} />
                        </a>
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
                        <button
                          onClick={() => openRename(file, "file")}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
                          title="Ubah Nama"
                        >
                          <IconPencil size={16} stroke={1.5} />
                        </button>
                        <button
                          onClick={() => handleDelete(file, "file")}
                          className="p-2 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 cursor-pointer"
                          title="Hapus"
                        >
                          <IconTrash size={16} stroke={1.5} />
                        </button>
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
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 truncate">{previewFile.name}</h3>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <IconX size={20} stroke={1.5} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50">
              {previewFile.mime_type.startsWith("image/") ? (
                <img
                  src={previewFile.r2_url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : previewFile.mime_type.includes("pdf") ? (
                <iframe
                  src={`/api/storage/files/download?id=${previewFile.id}`}
                  className="w-full h-[70vh] rounded-lg"
                  title={previewFile.name}
                />
              ) : (
                <div className="text-center">
                  <span className="text-5xl block mb-3">{getFileIcon(previewFile.mime_type)}</span>
                  <p className="text-sm font-bold text-gray-700">{previewFile.name}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatSize(previewFile.size)}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 p-4 border-t border-gray-100">
              <a
                href={`/api/storage/files/download?id=${previewFile.id}`}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition"
              >
                <IconDownload size={16} stroke={1.5} /> Download
              </a>
              <p className="text-xs text-gray-400 ml-auto">
                {formatSize(previewFile.size)}
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
