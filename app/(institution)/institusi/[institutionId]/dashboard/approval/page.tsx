"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import { Card, Badge, Spinner, Modal, Textarea } from "@/app/components/ui";
import { useToast } from "@/app/components/ui/toast";
import { IconCheck, IconAlertCircle, IconClock, IconFileText, IconBook } from "@tabler/icons-react";

interface PendingDocument {
  id: string;
  user_id: number;
  guru_nama: string;
  tipe_dokumen: "rpp" | "modul";
  judul_dokumen: string;
  approval_status: string;
  approval_note: string | null;
  created_at: string;
  institution_id: number;
  can_approve: boolean;
  my_roles: string[];
}

export default function ApprovalPage({
  params,
}: {
  params: Promise<{ institutionId: string }>;
}) {
  const toast = useToast();
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<PendingDocument | null>(null);
  const [actionType, setActionType] = useState<"approve" | "revisi">("approve");
  const [catatan, setCatatan] = useState("");

  useEffect(() => {
    params.then((p) => setInstitutionId(parseInt(p.institutionId, 10)));
  }, [params]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/administrasi/pending-approval");
      if (res.status === 403) {
        setError("Anda tidak punya akses.");
        return;
      }
      if (!res.ok) {
        setError("Gagal memuat daftar persetujuan.");
        return;
      }
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch {
      setError("Gagal memuat daftar persetujuan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAction = async () => {
    if (!selectedDoc) return;
    setProcessingId(selectedDoc.id);
    try {
      const res = await apiFetch(`/api/administrasi/${selectedDoc.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: actionType, catatan: catatan || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses.");
        return;
      }
      toast.success(
        actionType === "approve"
          ? "Dokumen berhasil disetujui."
          : "Dokumen diminta revisi."
      );
      setSelectedDoc(null);
      setCatatan("");
      fetchData();
    } catch {
      toast.error("Gagal memproses dokumen.");
    } finally {
      setProcessingId(null);
    }
  };

  const pendingCount = documents.filter((d) => d.approval_status === "pending").length;
  const rppDocs = documents.filter((d) => d.tipe_dokumen === "rpp");
  const modulDocs = documents.filter((d) => d.tipe_dokumen === "modul");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Approval / Persetujuan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Periksa dan setujui dokumen RPP / Modul Ajar dari guru.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-sm text-gray-500">Menunggu</p>
          <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <IconFileText size={18} className="text-violet-500" />
            <div>
              <p className="text-sm text-gray-500">RPP</p>
              <p className="text-xl font-bold text-gray-900">{rppDocs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <IconBook size={18} className="text-blue-500" />
            <div>
              <p className="text-sm text-gray-500">Modul Ajar</p>
              <p className="text-xl font-bold text-gray-900">{modulDocs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <IconCheck size={18} className="text-green-500" />
            <div>
              <p className="text-sm text-gray-500">Disetujui</p>
              <p className="text-xl font-bold text-gray-900">
                {documents.filter((d) => d.approval_status === "approved").length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <Card className="p-12 text-center">
          <IconAlertCircle size={40} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600">{error}</p>
        </Card>
      ) : documents.length === 0 ? (
        <Card className="p-12 text-center">
          <IconCheck size={40} className="mx-auto text-green-300 mb-3" />
          <p className="text-gray-500 font-medium">Semua dokumen sudah diproses!</p>
          <p className="text-gray-400 text-sm mt-1">Tidak ada yang menunggu persetujuan.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={doc.tipe_dokumen === "rpp" ? "info" : "default"}>
                      {doc.tipe_dokumen === "rpp" ? "RPP" : "Modul Ajar"}
                    </Badge>
                    <Badge
                      variant={
                        doc.approval_status === "pending"
                          ? "warning"
                          : doc.approval_status === "approved"
                            ? "success"
                            : "error"
                      }
                    >
                      {doc.approval_status === "pending"
                        ? "Menunggu"
                        : doc.approval_status === "approved"
                          ? "Disetujui"
                          : "Revisi"}
                    </Badge>
                  </div>
                  <p className="font-semibold text-gray-900 text-base">
                    {doc.judul_dokumen || "(Tanpa judul)"}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Oleh: {doc.guru_nama || `Guru #${doc.user_id}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                    <IconClock size={12} />
                    {new Date(doc.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {doc.approval_note && (
                    <p className="text-sm text-amber-600 mt-2 italic">
                      Catatan: {doc.approval_note}
                    </p>
                  )}
                </div>
                {doc.can_approve && doc.approval_status === "pending" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedDoc(doc);
                        setActionType("approve");
                        setCatatan("");
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      Setujui
                    </button>
                    <button
                      onClick={() => {
                        setSelectedDoc(doc);
                        setActionType("revisi");
                        setCatatan("");
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg font-medium transition-colors cursor-pointer"
                    >
                      Minta Revisi
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal */}
      {selectedDoc && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedDoc(null)}
          title={actionType === "approve" ? "Setujui Dokumen" : "Minta Revisi"}
          footer={
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleAction}
                disabled={processingId !== null}
                className={`px-4 py-2 text-white text-sm rounded-lg font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                  actionType === "approve"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {processingId !== null ? "Memproses..." : actionType === "approve" ? "Ya, Setujui" : "Kirim Permintaan Revisi"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Dokumen</p>
              <p className="font-medium text-gray-900">{selectedDoc.judul_dokumen || "(Tanpa judul)"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Jenis</p>
              <p className="font-medium text-gray-900">
                {selectedDoc.tipe_dokumen === "rpp" ? "RPP" : "Modul Ajar"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Oleh</p>
              <p className="font-medium text-gray-900">{selectedDoc.guru_nama}</p>
            </div>
            <Textarea
              label={actionType === "approve" ? "Catatan (opsional)" : "Catatan revisi (opsional)"}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder={
                actionType === "approve"
                  ? "Tambahkan catatan jika diperlukan..."
                  : "Jelaskan bagian yang perlu direvisi..."
              }
              rows={3}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
