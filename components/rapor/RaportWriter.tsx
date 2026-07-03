"use client";

import React, { useState } from "react";
import {
  IconSparkles,
  IconCheck,
  IconLoader2,
  IconAlertCircle,
  IconEdit,
  IconCopy,
  IconRefresh,
  IconDownload,
} from "@tabler/icons-react";

interface Student {
  id: string;
  nama_siswa: string;
  nomor_absen: number;
}

interface RaportWriterProps {
  student?: Student;
  subjectId?: string;
  assessmentId?: string;
  nilai?: number;
  semester?: string;
  tahunAjaran?: string;
  onGenerated?: (description: string) => void;
  compact?: boolean;
}

export default function RaportWriter({
  student,
  subjectId: initialSubjectId,
  assessmentId: initialAssessmentId,
  nilai: initialNilai,
  semester: initialSemester = "1",
  tahunAjaran: initialTahunAjaran = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
  onGenerated,
  compact = false,
}: RaportWriterProps) {
  const [studentId, setStudentId] = useState(student?.id || "");
  const [subjectId, setSubjectId] = useState(initialSubjectId || "");
  const [assessmentId, setAssessmentId] = useState(initialAssessmentId || "");
  const [nilai, setNilai] = useState(initialNilai || "");
  const [semester, setSemester] = useState(initialSemester);
  const [tahunAjaran, setTahunAjaran] = useState(initialTahunAjaran);
  const [kurikulum, setKurikulum] = useState("merdeka");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{
    deskripsi: string;
    saran: string;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState("");
  const [editedSaran, setEditedSaran] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!studentId || !subjectId || nilai === "") {
      setError("Mohon isi semua field yang diperlukan");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/rapor/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          subject_id: subjectId,
          assessment_id: assessmentId || undefined,
          nilai: Number(nilai),
          semester,
          tahun_ajaran: tahunAjaran,
          kurikulum,
          save: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal generate rapor");
      }

      setGenerated(result.generated);
      setEditedDescription(result.generated?.deskripsi || "");
      setEditedSaran(result.generated?.saran || "");
      onGenerated?.(result.generated?.deskripsi || "");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    const textToCopy = `Deskripsi:\n${editedDescription}\n\nSaran:\n${editedSaran}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveEdit = () => {
    setGenerated({
      deskripsi: editedDescription,
      saran: editedSaran,
    });
    setIsEditing(false);
  };

  const handleReset = () => {
    setGenerated(null);
    setIsEditing(false);
    setEditedDescription("");
    setEditedSaran("");
  };

  // Compact mode - just show the result
  if (compact && generated && student) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <IconCheck size={16} className="text-emerald-500" />
            <span className="text-sm font-semibold text-indigo-700">
              Deskripsi untuk {student.nama_siswa}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
              title="Edit"
            >
              <IconEdit size={14} />
            </button>
            <button
              onClick={handleCopy}
              className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
              title="Salin"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
              title="Generate Ulang"
            >
              <IconRefresh size={14} />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                Deskripsi
              </label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-lg resize-none focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                Saran
              </label>
              <textarea
                value={editedSaran}
                onChange={(e) => setEditedSaran(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-xs border border-indigo-200 rounded-lg resize-none focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-lg hover:bg-indigo-600 transition"
              >
                Simpan
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedDescription(generated.deskripsi);
                  setEditedSaran(generated.saran);
                }}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">{generated.deskripsi}</p>
            {generated.saran && (
              <div className="pt-2 border-t border-indigo-200">
                <p className="text-xs text-slate-500">
                  <strong>Saran:</strong> {generated.saran}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full mode
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <IconSparkles className="text-white" size={18} />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">AI Rapor Writer</h3>
            <p className="text-[10px] text-white/80">
              Generate deskripsi rapor otomatis
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Input Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">
              Siswa *
            </label>
            <select
              value={studentId}
              onChange={(e) => {
                setStudentId(e.target.value);
                setGenerated(null);
              }}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none bg-white"
            >
              <option value="">Pilih Siswa</option>
              {student && (
                <option value={student.id}>
                  {student.nomor_absen}. {student.nama_siswa}
                </option>
              )}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">
              Mata Pelajaran *
            </label>
            <input
              type="text"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setGenerated(null);
              }}
              placeholder="Contoh: Matematika"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">
              Nilai *
            </label>
            <input
              type="number"
              value={nilai}
              onChange={(e) => {
                setNilai(Number(e.target.value));
                setGenerated(null);
              }}
              min={0}
              max={100}
              placeholder="0-100"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-1">
              Semester
            </label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none bg-white"
            >
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
            </select>
          </div>
        </div>

        {/* Kurikulum */}
        <div>
          <label className="text-[10px] font-semibold text-slate-500 block mb-1">
            Kurikulum
          </label>
          <select
            value={kurikulum}
            onChange={(e) => setKurikulum(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none bg-white"
          >
            <option value="merdeka">Kurikulum Merdeka</option>
            <option value="k13">K13 (Kurikulum 2013)</option>
            <option value="kbc">KBC (Madrasah)</option>
            <option value="hybrid">Hybrid (Gabungan)</option>
          </select>
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading || !studentId || !subjectId || nilai === ""}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
            isLoading || !studentId || !subjectId || nilai === ""
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700"
          }`}
        >
          {isLoading ? (
            <>
              <IconLoader2 className="animate-spin" size={16} />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <IconSparkles size={16} />
              <span>Generate dengan AI</span>
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
            <IconAlertCircle className="text-rose-500 flex-shrink-0 mt-0.5" size={14} />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {/* Result */}
        {generated && !isEditing && (
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconCheck size={16} className="text-emerald-500" />
                <span className="text-sm font-semibold text-indigo-700">
                  Deskripsi Generated
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
                  title="Edit"
                >
                  <IconEdit size={14} />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
                  title="Salin"
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </button>
                <button
                  onClick={handleReset}
                  className="p-1.5 text-indigo-500 hover:bg-indigo-100 rounded-lg transition"
                  title="Generate Ulang"
                >
                  <IconRefresh size={14} />
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-indigo-600 block mb-1">
                Deskripsi Raport
              </label>
              <p className="text-sm text-slate-700 leading-relaxed">
                {generated.deskripsi}
              </p>
            </div>

            {generated.saran && (
              <div className="pt-2 border-t border-indigo-200">
                <label className="text-[10px] font-semibold text-indigo-600 block mb-1">
                  Saran
                </label>
                <p className="text-xs text-slate-600">{generated.saran}</p>
              </div>
            )}
          </div>
        )}

        {/* Edit Mode */}
        {generated && isEditing && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-amber-700">
              ✏️ Mode Edit - Ubah deskripsi di bawah ini
            </p>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                Deskripsi
              </label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg resize-none focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                Saran
              </label>
              <textarea
                value={editedSaran}
                onChange={(e) => setEditedSaran(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-amber-200 rounded-lg resize-none focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-2 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition"
              >
                Simpan Perubahan
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedDescription(generated.deskripsi);
                  setEditedSaran(generated.saran);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-200 transition"
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}