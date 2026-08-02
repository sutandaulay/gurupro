"use client";
import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface Topic {
  id: string;
  institution_id?: number;
  mapel: string;
  title: string;
  body: string;
  author: string;
  reply_count: number;
  created_at: string;
}

const MAPEL_UMUM = [
  "Bahasa Indonesia", "Matematika", "IPA", "IPS", "PPKn", "Bahasa Inggris",
  "PAI", "PJOK", "Seni Budaya", "Informatika", "Fisika", "Kimia", "Biologi",
  "Ekonomi", "Sosiologi", "Geografi", "Sejarah", "Lainnya",
];

export default function ForumPage() {
  const { data: session } = useSession();
  const [scope, setScope] = useState<"institution" | "all">("institution");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMapel, setFilterMapel] = useState("");

  const [openNew, setOpenNew] = useState(false);
  const [newMapel, setNewMapel] = useState("Matematika");
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);

  const [openTopic, setOpenTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope });
      if (filterMapel) qs.set("mapel", filterMapel);
      const res = await apiFetch(`/api/forum?${qs.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setTopics(data.topics || []);
      else toast.error(data.error || "Gagal memuat forum");
    } catch {
      toast.error("Koneksi bermasalah, coba lagi nanti.");
    } finally {
      setLoading(false);
    }
  }, [scope, filterMapel]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  const submitTopic = async () => {
    if (!newTitle.trim() || !newBody.trim()) {
      toast.error("Judul dan isi wajib diisi ya.");
      return;
    }
    setPosting(true);
    try {
      const res = await apiFetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapel: newMapel, title: newTitle, body: newBody }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Topik berhasil dibagikan!");
        setOpenNew(false);
        setNewTitle("");
        setNewBody("");
        fetchTopics();
      } else {
        toast.error(data.error || "Gagal memposting.");
      }
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setPosting(false);
    }
  };

  const openTopicDetail = async (t: Topic) => {
    setOpenTopic(t);
    setReplies([]);
    try {
      const res = await apiFetch(`/api/forum/${t.id}/replies`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setReplies(data.replies || []);
    } catch {}
  };

  const sendReply = async () => {
    if (!replyText.trim() || !openTopic) return;
    setSendingReply(true);
    try {
      const res = await apiFetch("/api/forum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: openTopic.id, body: replyText }),
      });
      const data = await res.json();
      if (res.ok) {
        setReplyText("");
        const r = await apiFetch(`/api/forum/${openTopic.id}/replies`, { cache: "no-store" });
        const rd = await r.json();
        if (r.ok) setReplies(rd.replies || []);
        fetchTopics();
      } else {
        toast.error(data.error || "Gagal membalas.");
      }
    } catch {
      toast.error("Koneksi bermasalah.");
    } finally {
      setSendingReply(false);
    }
  };

  const formatDate = (s: string) => {
    try { return new Date(s).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
    catch { return ""; }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">💬 Komunitas Guru</h1>
          <p className="text-sm text-slate-500">Berbagi tips & tanya jawab antar guru, per mapel.</p>
        </div>
        <Button onClick={() => setOpenNew(true)} className="gap-2 shrink-0">
          <span>➕</span> Topik Baru
        </Button>
      </div>

      {/* Scope toggle */}
      <div className="flex gap-2 mb-3">
        <Button
          size="sm"
          variant={scope === "institution" ? "default" : "outline"}
          onClick={() => setScope("institution")}
        >
          Sekolah Saya
        </Button>
        <Button
          size="sm"
          variant={scope === "all" ? "default" : "outline"}
          onClick={() => setScope("all")}
        >
          Lintas Sekolah
        </Button>
      </div>

      {/* Filter mapel */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setFilterMapel("")}
          className={`px-3 py-1 rounded-full text-xs font-medium border ${filterMapel === "" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}
        >
          Semua
        </button>
        {MAPEL_UMUM.slice(0, 8).map((m) => (
          <button
            key={m}
            onClick={() => setFilterMapel(m)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${filterMapel === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"}`}
          >
            {m}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">Memuat diskusi…</div>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400 text-sm">
            Belum ada topik di sini. Jadi yang pertama berbagi ya! 🌟
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openTopicDetail(t)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-800 truncate">{t.title}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1">{t.body}</p>
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                      <span>{t.author}</span>
                      <span>•</span>
                      <span>{formatDate(t.created_at)}</span>
                      {scope === "all" && t.institution_id && (
                        <Badge variant="outline" className="text-[10px]">Sekolah #{t.institution_id}</Badge>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{t.reply_count} balasan</Badge>
                </div>
                <div className="mt-2">
                  <Badge variant="outline" className="text-[10px]">{t.mapel}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog topik baru */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Topik Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Mata Pelajaran</label>
              <select
                value={newMapel}
                onChange={(e) => setNewMapel(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                {MAPEL_UMUM.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Judul</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Contoh: Cara seru mengajar pecahan?" className="mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Isi</label>
              <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} rows={4} placeholder="Tulis pertanyaan atau bagikan pengalamanmu…" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenNew(false)}>Batal</Button>
              <Button onClick={submitTopic} disabled={posting}>{posting ? "Mengirim…" : "Kirim"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog detail topik */}
      <Dialog open={!!openTopic} onOpenChange={(o) => !o && setOpenTopic(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {openTopic && (
            <>
              <DialogHeader>
                <DialogTitle>{openTopic.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Badge variant="outline">{openTopic.mapel}</Badge>
                  <span>{openTopic.author}</span>
                  <span>•</span>
                  <span>{formatDate(openTopic.created_at)}</span>
                </div>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{openTopic.body}</p>

                <div className="border-t pt-3 space-y-2">
                  <h4 className="text-sm font-semibold text-slate-700">Balasan ({replies.length})</h4>
                  {replies.length === 0 && <p className="text-sm text-slate-400">Belum ada balasan. Jadilah yang pertama! 💡</p>}
                  {replies.map((r) => (
                    <div key={r.id} className="text-sm bg-white border border-slate-100 rounded-lg p-3">
                      <p className="text-slate-700">{r.body}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{r.author} • {formatDate(r.created_at)}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-3">
                  <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={2} placeholder="Tulis balasan…" />
                  <div className="flex justify-end mt-2">
                    <Button size="sm" onClick={sendReply} disabled={sendingReply}>{sendingReply ? "Mengirim…" : "Kirim Balasan"}</Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
