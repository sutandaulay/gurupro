"use client";

import { apiFetch } from "@/lib/api-client";
import { useEffect, useState, useMemo, useCallback } from "react";
import {
  APP_ROLES,
  DASHBOARD_MODULES,
  INSTITUTION_ROLES,
  buildFeatureTree,
  getAllFeatureKeys,
} from "@/lib/menuConfig";

interface Institution {
  id: number;
  name: string;
  npsn: string | null;
  status: string;
}

interface RoleMenuSettingRow {
  feature_key: string;
  visible: boolean;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`w-9 h-5 rounded-full relative transition-colors shrink-0 cursor-pointer disabled:opacity-40 ${
        checked ? "bg-emerald-500" : "bg-slate-300"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export default function MenuPermissionsManager() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loadingInsts, setLoadingInsts] = useState(true);
  const [institutionId, setInstitutionId] = useState<number | null>(null);
  const [role, setRole] = useState<string>(INSTITUTION_ROLES[0].value);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const featureKeys = useMemo(() => getAllFeatureKeys(), []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch("/api/admin/institutions?source=all&search=");
        if (res.ok) {
          const data = await res.json();
          setInstitutions(Array.isArray(data) ? data : []);
        }
      } catch {
        // silent
      } finally {
        setLoadingInsts(false);
      }
    };
    load();
  }, []);

  const loadSettings = useCallback(async () => {
    if (!institutionId || !role) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiFetch(
        `/api/admin/menu-settings?institutionId=${institutionId}&role=${encodeURIComponent(role)}`
      );
      if (res.ok) {
        const data = await res.json();
        const next: Record<string, boolean> = {};
        for (const key of featureKeys) next[key] = true;
        for (const row of data.settings as RoleMenuSettingRow[]) {
          next[row.feature_key] = Boolean(row.visible);
        }
        setSettings(next);
        setDirty(false);
      } else {
        const body = await res.json().catch(() => null);
        console.error("loadMenuSettings failed:", res.status, body);
        setMessage({
          type: "error",
          text: `Gagal memuat pengaturan (HTTP ${res.status}): ${body?.error || res.statusText || "kesalahan tak dikenal"}`,
        });
      }
    } catch (err) {
      console.error("loadMenuSettings threw:", err);
      setMessage({ type: "error", text: "Koneksi gagal saat memuat pengaturan." });
    } finally {
      setLoading(false);
    }
  }, [institutionId, role, featureKeys]);

  useEffect(() => {
    if (institutionId) {
      loadSettings();
    }
  }, [institutionId, role, loadSettings]);

  const toggleKey = (key: string) => {
    setSettings((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
    setDirty(true);
  };

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const key of featureKeys) next[key] = value;
    setSettings(next);
    setDirty(true);
  };

  const save = async () => {
    if (!institutionId) return;
    setSaving(true);
    setMessage(null);
    try {
      const items = featureKeys.map((key) => ({ featureKey: key, visible: settings[key] ?? true }));
      const res = await apiFetch("/api/admin/menu-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institutionId, role, items }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Pengaturan visibilitas berhasil disimpan." });
        setDirty(false);
      } else {
        const data = await res.json().catch(() => null);
        setMessage({ type: "error", text: data?.error || "Gagal menyimpan pengaturan." });
      }
    } catch {
      setMessage({ type: "error", text: "Koneksi gagal saat menyimpan pengaturan." });
    } finally {
      setSaving(false);
    }
  };

  const tree = useMemo(() => buildFeatureTree(), []);
  const moduleKeys = new Set(DASHBOARD_MODULES.map((m) => `d:${m.key}`));

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Institusi
          </label>
          <select
            value={institutionId ?? ""}
            onChange={(e) => setInstitutionId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none bg-white font-medium text-slate-800"
            disabled={loadingInsts}
          >
            <option value="">-- Pilih Institusi --</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} {inst.npsn ? `(${inst.npsn})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none bg-white font-medium text-slate-800"
          >
            <optgroup label="Role Institusi">
              {INSTITUTION_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Role Aplikasi">
              {APP_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAll(true)}
            disabled={!institutionId}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            Tampilkan Semua
          </button>
          <button
            onClick={() => setAll(false)}
            disabled={!institutionId}
            className="px-4 py-2.5 border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            Sembunyikan Semua
          </button>
          <button
            onClick={save}
            disabled={!institutionId || saving || !dirty}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-40"
          >
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`text-xs font-bold px-4 py-3 rounded-xl ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {message.type === "success" ? "✅ " : "⚠️ "}
          {message.text}
        </div>
      )}

      {!institutionId ? (
        <div className="text-center py-16 text-slate-400 text-sm font-medium">
          Pilih institusi dan role untuk mengatur visibilitas menu.
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-slate-400 text-sm font-medium">
          Memuat pengaturan...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Menu & Sub Menu */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Menu & Sub Menu
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                Item dengan label "Modul" mengikuti toggle Modul Dashboard
              </span>
            </div>
            <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
              {tree.map((group) => {
                const hasChildren = group.children.length > 0;
                const groupVisible = settings[group.key] ?? true;
                return (
                  <div
                    key={group.key}
                    className={`border rounded-xl p-3 ${
                      groupVisible ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800">{group.label}</p>
                        {group.isModuleLinked && (
                          <p className="text-[10px] text-indigo-500 font-semibold">
                            Modul: {group.moduleKey}
                          </p>
                        )}
                      </div>
                      <Toggle checked={groupVisible} onChange={() => toggleKey(group.key)} />
                    </div>
                    {hasChildren && (
                      <div className="mt-2.5 space-y-1.5 pl-2">
                        {group.children.map((child) => {
                          const childVisible = settings[child.key] ?? true;
                          return (
                            <div
                              key={child.uid}
                              className="flex items-center justify-between gap-3 bg-white border border-slate-100 rounded-lg px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate">
                                  {child.label}
                                </p>
                                {child.isModuleLinked && (
                                  <p className="text-[9px] text-indigo-500 font-semibold">
                                    Modul: {child.moduleKey}
                                  </p>
                                )}
                              </div>
                              <Toggle checked={childVisible} onChange={() => toggleKey(child.key)} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modul Dashboard */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                Modul Dashboard
              </h3>
              <span className="text-[10px] text-slate-400 font-semibold">
                Menyembunyikan modul juga menyembunyikan menu terkait
              </span>
            </div>
            <div className="p-4 space-y-2 max-h-[560px] overflow-y-auto">
              {DASHBOARD_MODULES.map((mod) => {
                const key = `d:${mod.key}`;
                const visible = settings[key] ?? true;
                return (
                  <div
                    key={key}
                    className={`flex items-center justify-between gap-3 border rounded-xl px-3 py-2.5 ${
                      visible ? "border-indigo-100 bg-indigo-50/40" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{mod.label}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{mod.key}</p>
                    </div>
                    <Toggle checked={visible} onChange={() => toggleKey(key)} />
                  </div>
                );
              })}
              {moduleKeys.size === 0 && (
                <p className="text-xs text-slate-400">Tidak ada modul.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}