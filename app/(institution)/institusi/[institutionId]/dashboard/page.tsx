import { query } from "@/lib/db";

async function getOverviewData(institutionId: number) {
  try {
    const [membersRes] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status = 'active')::int AS aktif,
                COUNT(*) FILTER (WHERE status = 'invited')::int AS menunggu,
                COUNT(*) FILTER (WHERE status = 'left')::int AS nonaktif,
                COUNT(*) FILTER (WHERE status = 'rejected')::int AS ditolak
         FROM public.institution_members
         WHERE institution_id = $1`,
        [institutionId]
      ),
    ]);

    const guruRes = await query(
      `SELECT COUNT(*)::int AS total_guru
       FROM public.institution_members im
       JOIN public.institution_members_role imr ON imr.parent_id = im.id
       WHERE im.institution_id = $1 AND im.status = 'active' AND imr.value = 'guru'`,
      [institutionId]
    );

    return {
      total: membersRes.rows[0]?.total || 0,
      aktif: membersRes.rows[0]?.aktif || 0,
      menunggu: membersRes.rows[0]?.menunggu || 0,
      nonaktif: membersRes.rows[0]?.nonaktif || 0,
      ditolak: membersRes.rows[0]?.ditolak || 0,
      totalGuru: guruRes.rows[0]?.total_guru || 0,
    };
  } catch {
    return {
      total: 0,
      aktif: 0,
      menunggu: 0,
      nonaktif: 0,
      ditolak: 0,
      totalGuru: 0,
    };
  }
}

interface OverviewProps {
  params: Promise<{ institutionId: string }>;
}

export default async function DashboardOverviewPage({ params }: OverviewProps) {
  const { institutionId } = await params;
  const instId = parseInt(institutionId, 10);

  const [institutionRes, stats] = await Promise.all([
    query(
      `SELECT id, name, npsn, jenjang, naungan, academic_year_active, status
       FROM institutions WHERE id = $1`,
      [instId]
    ),
    getOverviewData(instId),
  ]);

  const institution = institutionRes.rows[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ringkasan data institusi {institution?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Guru" value={stats.totalGuru} color="text-violet-600" />
        <StatCard label="Total Anggota" value={stats.total} color="text-gray-900" />
        <StatCard label="Aktif" value={stats.aktif} color="text-green-600" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Menunggu Konfirmasi"
          value={stats.menunggu}
          color="text-amber-600"
        />
        <StatCard
          label="Nonaktif"
          value={stats.nonaktif}
          color="text-gray-500"
        />
        <StatCard
          label="Ditolak"
          value={stats.ditolak}
          color="text-red-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Informasi Institusi
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Nama</p>
            <p className="font-medium text-gray-900">{institution?.name}</p>
          </div>
          {institution?.npsn && (
            <div>
              <p className="text-gray-500">NPSN</p>
              <p className="font-medium text-gray-900">{institution.npsn}</p>
            </div>
          )}
          <div>
            <p className="text-gray-500">Jenjang</p>
            <p className="font-medium text-gray-900">{institution?.jenjang}</p>
          </div>
          <div>
            <p className="text-gray-500">Naungan</p>
            <p className="font-medium text-gray-900">{institution?.naungan}</p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium mt-0.5">
              {institution?.status || "-"}
            </span>
          </div>
          <div>
            <p className="text-gray-500">Tier Langganan</p>
            <p className="font-medium text-gray-900">
              {institution?.subscription_tier || "-"}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Tahun Ajaran Aktif</p>
            <p className="font-medium text-gray-900">
              {institution?.academic_year_active || "Belum diatur"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
