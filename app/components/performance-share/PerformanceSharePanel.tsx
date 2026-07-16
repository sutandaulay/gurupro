"use client";

import { useState, useEffect, useCallback } from "react";
import {
  IconPlus,
  IconBrandWhatsapp,
  IconMail,
  IconExternalLink,
  IconCopy,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconSend,
} from "@tabler/icons-react";
import { Label } from "@/app/components/ui/form";
import LeaderContactForm from "./LeaderContactForm";
import DocumentAccessToggle from "./DocumentAccessToggle";

interface LeaderContact {
  id: string;
  leaderName: string;
  leaderRole: string;
  phoneNumber?: string;
  email?: string;
  schoolNameRaw?: string;
  optedOut?: boolean;
  lastNotifiedAt?: string;
  notificationFrequency?: string;
  notificationTime?: string;
  notificationDay?: string;
  notificationDate?: string;
  nextScheduledNotification?: string;
}

interface ShareLink {
  id: string;
  leaderContactId: string;
  shareToken: string;
  accessLevel: string;
  aggregatedStats?: Record<string, unknown>;
  expiresAt?: string;
  revokedAt?: string;
  viewCount: number;
  createdAt: string;
}

interface DocumentGrant {
  id: string;
  documentCategory: string;
  otpVerified: boolean;
  grantedAt?: string;
  revokedAt?: string;
}

const DOCUMENT_CATEGORIES = [
  { value: "rpp_modul_ajar", label: "RPP / Modul Ajar", description: "Rencana Pelaksanaan Pembelajaran dan Modul Ajar" },
  { value: "jurnal_harian", label: "Jurnal Harian", description: "Jurnal Mengajar Harian" },
  { value: "bank_soal", label: "Bank Soal / Evaluasi", description: "Kumpulan soal dan instrumen evaluasi" },
  { value: "lkpd_bahan_ajar", label: "LKPD / Bahan Ajar", description: "Lembar Kerja Peserta Didik dan Bahan Ajar" },
  { value: "presensi_kinerja", label: "Laporan Presensi & Kinerja", description: "Laporan kehadiran dan kinerja mengajar mingguan" },
];

const ROLE_LABELS: Record<string, string> = {
  kepala_sekolah: "Kepala Sekolah",
  pengawas: "Pengawas",
  wali_kelas: "Wali Kelas",
  lainnya: "Lainnya",
};

interface PerformanceSharePanelProps {
  userId: string;
  aggregatedStats?: Record<string, unknown>;
}

export default function PerformanceSharePanel({
  userId,
  aggregatedStats = {},
}: PerformanceSharePanelProps) {
  const [leaderContacts, setLeaderContacts] = useState<LeaderContact[]>([]);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [documentGrants, setDocumentGrants] = useState<Record<string, DocumentGrant[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContact, setEditingContact] = useState<LeaderContact | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<{
    shareUrl: string;
    waMeLink?: string;
    shareMessage: string;
    multiTeacherInfo?: { count: number; message: string };
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/leader-contacts");
      const data = await res.json();
      if (data.leaderContacts) {
        setLeaderContacts(data.leaderContacts);
      }
    } catch (err) {
      console.error("Failed to fetch leader contacts:", err);
    }
  }, []);

  const fetchShareLinks = useCallback(async () => {
    try {
      const res = await fetch("/api/performance-share");
      const data = await res.json();
      if (data.shareLinks) {
        setShareLinks(data.shareLinks);
      }
    } catch (err) {
      console.error("Failed to fetch share links:", err);
    }
  }, []);

  const fetchDocumentGrants = useCallback(async (linkId: string) => {
    try {
      const res = await fetch(`/api/performance-share/${linkId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.level2?.grants || [];
    } catch (err) {
      console.error("Failed to fetch document grants:", err);
      return [];
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchLeaderContacts();
      await fetchShareLinks();
      setLoading(false);
    };
    init();
  }, [fetchLeaderContacts, fetchShareLinks]);

  useEffect(() => {
    const fetchGrants = async () => {
      const grantsMap: Record<string, DocumentGrant[]> = {};
      for (const link of shareLinks) {
        if (!link.revokedAt) {
          const grants = await fetchDocumentGrants(link.id);
          grantsMap[link.id] = grants;
        }
      }
      setDocumentGrants(grantsMap);
    };
    if (shareLinks.length > 0) {
      fetchGrants();
    }
  }, [shareLinks, fetchDocumentGrants]);

  const handleSaveContact = async (data: LeaderContact) => {
    setLoading(true);
    setError(null);
    try {
      const url = data.id ? "/api/leader-contacts" : "/api/leader-contacts";
      const method = data.id ? "PUT" : "POST";
      const body: Record<string, unknown> = { ...data };
      if (data.id) {
        body.id = data.id;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal menyimpan kontak");
      }

      await fetchLeaderContacts();
      setShowAddForm(false);
      setEditingContact(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm("Hapus kontak ini?")) return;

    try {
      const res = await fetch(`/api/leader-contacts?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal menghapus kontak");
      }
      await fetchLeaderContacts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateShareLink = async (leaderContactId: string) => {
    setLoading(true);
    setError(null);
    setShareResult(null);

    try {
      const res = await fetch("/api/performance-share/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderContactId, aggregatedStats }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal membuat link");
      }

      setShareResult(result.shareLink);
      setSelectedContactId(leaderContactId);
      if (result.multiTeacherInfo) {
        setError(result.multiTeacherInfo.message);
      }
      await fetchShareLinks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeShareLink = async (linkId: string) => {
    if (!confirm("Cabut link ini? Link tidak akan bisa dilihat lagi.")) return;

    try {
      const res = await fetch(`/api/performance-share?id=${linkId}`, { method: "DELETE" });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal mencabut link");
      }
      await fetchShareLinks();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGrantDocumentAccess = async (
    linkId: string,
    category: string,
    channel: "whatsapp" | "email"
  ) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/performance-share/${linkId}/grant-document-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentCategory: category, channel }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Gagal mengirim OTP");
      }

      const updatedGrants = await fetchDocumentGrants(linkId);
      setDocumentGrants((prev) => ({ ...prev, [linkId]: updatedGrants }));
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDocumentAccess = async (linkId: string, grantId: string) => {
    try {
      const res = await fetch(`/api/performance-share/${linkId}/revoke-document-access/${grantId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || "Gagal mencabut akses");
      }

      const updatedGrants = await fetchDocumentGrants(linkId);
      setDocumentGrants((prev) => ({ ...prev, [linkId]: updatedGrants }));
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  };

  const handleCopyLink = () => {
    if (shareResult?.shareUrl) {
      navigator.clipboard.writeText(shareResult.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getContactShareLinks = (contactId: string) => {
    return shareLinks.filter((link) => link.leaderContactId === contactId && !link.revokedAt);
  };

  const getContactGrants = (linkId: string) => {
    return documentGrants[linkId] || [];
  };

  const getDayName = (dayValue?: string) => {
    const days: Record<string, string> = {
      "1": "Senin",
      "2": "Selasa",
      "3": "Rabu",
      "4": "Kamis",
      "5": "Jumat",
      "6": "Sabtu",
    };
    return days[dayValue || "5"] || "Jumat";
  };

  if (loading && leaderContacts.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bagikan Kinerja ke Pimpinan</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tambahkan kontak pimpinan untuk membagikan ringkasan kinerja mengajar
          </p>
        </div>
        <button
          onClick={() => {
            setEditingContact(null);
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white font-medium text-sm hover:bg-violet-700 transition-colors"
        >
          <IconPlus size={18} />
          Tambah Kontak
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <IconAlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-amber-600 hover:text-amber-800">
            <IconCheck size={18} />
          </button>
        </div>
      )}

      {showAddForm && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-medium text-gray-900 mb-4">
            {editingContact ? "Edit Kontak Pimpinan" : "Tambah Kontak Pimpinan Baru"}
          </h3>
          <LeaderContactForm
            initialData={editingContact || undefined}
            onSubmit={handleSaveContact}
            onCancel={() => {
              setShowAddForm(false);
              setEditingContact(null);
            }}
            loading={loading}
          />
        </div>
      )}

      {leaderContacts.length === 0 && !showAddForm && (
        <div className="text-center py-12 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-100 flex items-center justify-center">
            <IconPlus size={24} className="text-violet-600" />
          </div>
          <h3 className="font-medium text-gray-900">Belum Ada Kontak</h3>
          <p className="text-sm text-gray-500 mt-1">
            Tambahkan kontak pimpinan untuk mulai membagikan kinerja Anda
          </p>
        </div>
      )}

      <div className="space-y-4">
        {leaderContacts.map((contact) => {
          const contactLinks = getContactShareLinks(contact.id);
          const latestLink = contactLinks[0];

          return (
            <div key={contact.id} className="border border-gray-200 rounded-lg bg-white overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{contact.leaderName}</h3>
                    <p className="text-sm text-gray-500">
                      {ROLE_LABELS[contact.leaderRole] || contact.leaderRole}
                      {contact.schoolNameRaw && ` - ${contact.schoolNameRaw}`}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      {contact.phoneNumber && <span>{contact.phoneNumber}</span>}
                      {contact.email && <span>{contact.email}</span>}
                    </div>
                    {contact.notificationFrequency && contact.notificationFrequency !== "manual" && (
                      <div className="mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          contact.notificationFrequency === "daily" ? "bg-green-100 text-green-700" :
                          contact.notificationFrequency === "weekly" ? "bg-blue-100 text-blue-700" :
                          "bg-purple-100 text-purple-700"
                        }`}>
                          <IconSend size={12} />
                          {contact.notificationFrequency === "daily" ? "Harian" :
                           contact.notificationFrequency === "weekly" ? "Mingguan" : "Bulanan"}
                        </span>
                        <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                          <span>
                            {contact.notificationFrequency === "daily" && `Setiap jam ${contact.notificationTime || "14:00"}`}
                            {contact.notificationFrequency === "weekly" && `Setiap ${getDayName(contact.notificationDay)} jam ${contact.notificationTime || "14:00"}`}
                            {contact.notificationFrequency === "monthly" && `Tanggal ${contact.notificationDate || "25"} jam ${contact.notificationTime || "10:00"}`}
                          </span>
                        </div>
                        {contact.lastNotifiedAt && (
                          <span className="text-xs text-gray-400">
                            Terakhir: {new Date(contact.lastNotifiedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} {new Date(contact.lastNotifiedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingContact(contact);
                        setShowAddForm(true);
                      }}
                      className="text-sm text-violet-600 hover:text-violet-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  </div>
                </div>

                {contact.optedOut && (
                  <div className="mt-3 p-2 bg-gray-100 rounded text-sm text-gray-500">
                    Pimpinan ini telah memilih untuk tidak menerima link
                  </div>
                )}

                {!contact.optedOut && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    {latestLink ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">Link Aktif</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyLink()}
                              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                            >
                              {copied ? <IconCheck size={16} className="text-green-600" /> : <IconCopy size={16} />}
                              {copied ? "Tersalin" : "Salin"}
                            </button>
                            <button
                              onClick={() => handleRevokeShareLink(latestLink.id)}
                              className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
                            >
                              <IconTrash size={16} />
                              Cabut
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={latestLink.shareToken}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded text-sm text-gray-600 hover:bg-gray-100 truncate"
                          >
                            <IconExternalLink size={16} />
                            Lihat Halaman
                          </a>
                          <span className="text-xs text-gray-400">
                            {latestLink.viewCount} dilihat
                          </span>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCreateShareLink(contact.id)}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg font-medium text-sm hover:bg-violet-700 disabled:opacity-50"
                      >
                        <IconSend size={18} />
                        {loading ? "Membuat..." : "Bagikan ke WhatsApp"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {latestLink && !contact.optedOut && (
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400">Akses Dokumen (Opsional)</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    {DOCUMENT_CATEGORIES.map((category) => {
                      const grants = getContactGrants(latestLink.id);
                      const grant = grants.find((g) => g.documentCategory === category.value);

                      return (
                        <DocumentAccessToggle
                          key={category.value}
                          shareLinkId={latestLink.id}
                          category={category}
                          grant={grant}
                          leaderName={contact.leaderName}
                          onGrant={(cat, channel) =>
                            handleGrantDocumentAccess(latestLink.id, cat, channel)
                          }
                          onRevoke={(grantId) =>
                            handleRevokeDocumentAccess(latestLink.id, grantId)
                          }
                          disabled={loading}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {shareResult?.waMeLink && (
        <div className="fixed bottom-6 right-6 bg-white rounded-xl shadow-lg border p-4 max-w-sm z-50">
          <h4 className="font-medium text-gray-900 mb-2">Link Berhasil Dibuat!</h4>
          <p className="text-sm text-gray-500 mb-3">
            Kirim link ke {leaderContacts.find((c) => c.id === selectedContactId)?.leaderName}
          </p>
          <div className="flex gap-2">
            <a
              href={shareResult.waMeLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700"
            >
              <IconBrandWhatsapp size={18} />
              Kirim via WA
            </a>
            <a
              href={`mailto:?subject=Ringkasan Kinerja GuruPRO AI&body=${encodeURIComponent(shareResult.shareMessage)}`}
              className="flex items-center justify-center px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <IconMail size={18} />
            </a>
          </div>
          <button
            onClick={() => setShareResult(null)}
            className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Tutup
          </button>
        </div>
      )}
    </div>
  );
}