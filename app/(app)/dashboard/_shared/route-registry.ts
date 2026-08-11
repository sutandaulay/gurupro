import dynamic from "next/dynamic";
import type { ComponentType } from "react";

interface RouteEntry {
  pattern: string[];
  component: ComponentType<any>;
  paramKeys: string[];
}

const routes: RouteEntry[] = [
  { pattern: [], component: dynamic(() => import("../content")), paramKeys: [] },
  { pattern: ["administrasi"], component: dynamic(() => import("../administrasi/content")), paramKeys: [] },
  { pattern: ["ai-performance-report"], component: dynamic(() => import("../ai-performance-report/content")), paramKeys: [] },
  { pattern: ["ai-monitoring"], component: dynamic(() => import("../ai-monitoring/page")), paramKeys: [] },
  { pattern: ["approval-rpp"], component: dynamic(() => import("../approval-rpp/content")), paramKeys: [] },
  { pattern: ["atp-editor"], component: dynamic(() => import("../atp-editor/content")), paramKeys: [] },
  { pattern: ["billing"], component: dynamic(() => import("../billing/content")), paramKeys: [] },
  { pattern: ["brankas"], component: dynamic(() => import("../brankas/content")), paramKeys: [] },
  { pattern: ["chat"], component: dynamic(() => import("../chat/content")), paramKeys: [] },
  { pattern: ["evidence"], component: dynamic(() => import("../evidence/content")), paramKeys: [] },
  { pattern: ["executive-dashboard"], component: dynamic(() => import("../executive-dashboard/content")), paramKeys: [] },
  { pattern: ["forum"], component: dynamic(() => import("../forum/content")), paramKeys: [] },
  { pattern: ["laporan-harian"], component: dynamic(() => import("../laporan-harian/content")), paramKeys: [] },
  { pattern: ["laporan-harian", ":tanggal"], component: dynamic(() => import("../laporan-harian/[tanggal]/content")), paramKeys: ["tanggal"] },
  { pattern: ["laporan-mengajar"], component: dynamic(() => import("../laporan-mengajar/content")), paramKeys: [] },
  { pattern: ["laporan-mengajar", ":id"], component: dynamic(() => import("../laporan-mengajar/[id]/content")), paramKeys: ["id"] },
  { pattern: ["laporan-kinerja"], component: dynamic(() => import("../laporan-kinerja/content")), paramKeys: [] },
  { pattern: ["laporan-kinerja", ":id"], component: dynamic(() => import("../laporan-kinerja/[id]/content")), paramKeys: ["id"] },
  { pattern: ["laporan-kinerja", "buat"], component: dynamic(() => import("../laporan-kinerja/buat/content")), paramKeys: [] },
  { pattern: ["laporan-kinerja", "observasi"], component: dynamic(() => import("../laporan-kinerja/observasi/content")), paramKeys: [] },
  { pattern: ["laporan-kinerja", "observasi", ":id"], component: dynamic(() => import("../laporan-kinerja/observasi/[id]/content")), paramKeys: ["id"] },
  { pattern: ["laporan-kinerja", "observasi", "buat"], component: dynamic(() => import("../laporan-kinerja/observasi/buat/content")), paramKeys: [] },
  { pattern: ["laporan-kinerja", "skp"], component: dynamic(() => import("../laporan-kinerja/skp/content")), paramKeys: [] },
  { pattern: ["laporan-kinerja", "skp", ":id"], component: dynamic(() => import("../laporan-kinerja/skp/[id]/content")), paramKeys: ["id"] },
  { pattern: ["layout-raport"], component: dynamic(() => import("../layout-raport/content")), paramKeys: [] },
  { pattern: ["pembina-ekskul"], component: dynamic(() => import("../pembina-ekskul/content")), paramKeys: [] },
  { pattern: ["pemetaan-kolom"], component: dynamic(() => import("../pemetaan-kolom/content")), paramKeys: [] },
  { pattern: ["pengaturan", "tahun-ajaran"], component: dynamic(() => import("../pengaturan/tahun-ajaran/content")), paramKeys: [] },
  { pattern: ["pengembangan-diri"], component: dynamic(() => import("../pengembangan-diri/content")), paramKeys: [] },
  { pattern: ["pengembangan-diri", ":id"], component: dynamic(() => import("../pengembangan-diri/[id]/content")), paramKeys: ["id"] },
  { pattern: ["pengembangan-diri", "tambah"], component: dynamic(() => import("../pengembangan-diri/tambah/content")), paramKeys: [] },
  { pattern: ["pengembangan-diri", "dokumen", "tambah"], component: dynamic(() => import("../pengembangan-diri/dokumen/tambah/content")), paramKeys: [] },
  { pattern: ["prosem"], component: dynamic(() => import("../prosem/content")), paramKeys: [] },
  { pattern: ["prota"], component: dynamic(() => import("../prota/content")), paramKeys: [] },
  { pattern: ["rapor-review"], component: dynamic(() => import("../rapor-review/content")), paramKeys: [] },
  { pattern: ["raport-status"], component: dynamic(() => import("../raport-status/content")), paramKeys: [] },
  { pattern: ["wali-kelas"], component: dynamic(() => import("../wali-kelas/content")), paramKeys: [] },
  // Institution pages removed — canonical routing is /institusi/[id]/dashboard/[page]
  { pattern: ["attendance"], component: dynamic(() => import("../attendance/content")), paramKeys: [] },
  { pattern: ["attendance", "teaching"], component: dynamic(() => import("../attendance/teaching/content")), paramKeys: [] },
  { pattern: ["attendance", "leave"], component: dynamic(() => import("../attendance/leave/content")), paramKeys: [] },
  { pattern: ["reports", "attendance"], component: dynamic(() => import("../reports/attendance/content")), paramKeys: [] },
  { pattern: ["reports", "tpg"], component: dynamic(() => import("../reports/tpg/content")), paramKeys: [] },
  { pattern: ["perpustakaan"], component: dynamic(() => import("../perpustakaan/content")), paramKeys: [] },
];

interface ResolvedRoute {
  component: ComponentType<any>;
  params: Record<string, string>;
}

export function resolveRoute(slug: string[]): ResolvedRoute {
  for (const entry of routes) {
    if (entry.pattern.length !== slug.length) continue;

    let match = true;
    const params: Record<string, string> = {};

    for (let i = 0; i < entry.pattern.length; i++) {
      const patternSegment = entry.pattern[i];
      const slugSegment = slug[i];

      if (patternSegment.startsWith(":")) {
        params[patternSegment.slice(1)] = slugSegment;
      } else if (patternSegment !== slugSegment) {
        match = false;
        break;
      }
    }

    if (match) {
      return { component: entry.component, params };
    }
  }

  return { component: dynamic(() => import("../content")), params: {} };
}
