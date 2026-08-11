// NOTE: This is a preview-only component.
// The actual document export uses lib/export/teaching-report.ts and app/api/raport/download/route.ts
// which generate proper print-ready DOCX with kop sekolah, signature blocks, and page numbers.

// =============================================
// DUMMY DATA — only for preview in builder
// NEVER linked to real student data
// =============================================

export interface DummyDataSiswa {
  nama: string;
  nisn: string;
  nisLokal: string;
  kelas: string;
  semester: string;
  tahunAjaran: string;
}

export interface DummyDataNilaiMapel {
  namaMapel: string;
  nilaiAkhir: number | null;
  kkm: number | null;
  predikat: string;
  deskripsiCapaian: string;
}

export interface DummyDataSikap {
  label: string;
  nilai: string;
  deskripsi: string;
}

export interface DummyDataEkskul {
  namaEkskul: string;
  predikat: string;
  deskripsi: string;
}

export interface DummyData {
  sekolah: {
    nama: string;
    alamat: string;
    npsn: string;
    kepalaSekolah: string;
    nipKepsek: string;
  };
  siswa: DummyDataSiswa;
  nilaiMapel: DummyDataNilaiMapel[];
  sikap: DummyDataSikap[];
  ekskul: DummyDataEkskul[];
  catatanWaliKelas: string;
  waliKelas: string;
  nipWaliKelas: string;
}

export const DUMMY_DATA: DummyData = {
  sekolah: {
    nama: 'SDN CEMPAKA PUTIH 01',
    alamat: 'Jl. Cempaka Putih No. 123, Jakarta Pusat',
    npsn: '20102678',
    kepalaSekolah: 'Dra. Sri Wahyuni, M.Pd.',
    nipKepsek: '196507011990032010',
  },
  siswa: {
    nama: 'Ahmad Fauzi',
    nisn: '0123456789',
    nisLokal: '2024001',
    kelas: 'IV-A',
    semester: 'Ganjil',
    tahunAjaran: '2025/2026',
  },
  nilaiMapel: [
    { namaMapel: 'Pendidikan Agama Islam', nilaiAkhir: 88, kkm: 70, predikat: 'B', deskripsiCapaian: 'Siswa mampu memahami dan menerapkan nilai-nilai ajaran Islam dalam kehidupan sehari-hari dengan baik.' },
    { namaMapel: 'Pendidikan Pancasila', nilaiAkhir: 85, kkm: 70, predikat: 'B', deskripsiCapaian: 'Siswa mampu menunjukkan sikap gotong royong dan memahami nilai-nilai Pancasila.' },
    { namaMapel: 'Bahasa Indonesia', nilaiAkhir: 90, kkm: 70, predikat: 'A', deskripsiCapaian: 'Siswa mampu membaca, menulis, dan menyimak dengan sangat baik. Penguasaan kosakata berkembang pesat.' },
    { namaMapel: 'Matematika', nilaiAkhir: 78, kkm: 70, predikat: 'C', deskripsiCapaian: 'Siswa mampu memahami operasi hitung dasar. Perlu latihan lebih dalam soal cerita.' },
    { namaMapel: 'Ilmu Pengetahuan Alam dan Sosial', nilaiAkhir: 82, kkm: 70, predikat: 'B', deskripsiCapaian: 'Siswa aktif dalam pembelajaran dan mampu menjelaskan fenomena alam sederhana.' },
  ],
  sikap: [
    { label: 'Beriman, Bertakwa kepada Tuhan YME', nilai: 'Baik', deskripsi: 'Menunjukkan sikap religious dalam kegiatan sehari-hari, rajin beribadah.' },
    { label: 'Berkebinekaan Global', nilai: 'Baik', deskripsi: 'Menghargai perbedaan dan mampu bekerja sama dengan teman yang berbeda latar belakang.' },
    { label: 'Gotong Royong', nilai: 'Sangat Baik', deskripsi: 'Aktif dalam kerja kelompok dan membantu teman yang mengalami kesulitan.' },
    { label: 'Mandiri', nilai: 'Baik', deskripsi: 'Mampu menyelesaikan tugas secara mandiri dengan pengawasan minimal.' },
  ],
  ekskul: [
    { namaEkskul: 'Pramuka', predikat: 'Sangat Baik', deskripsi: 'Aktif mengikuti latihan dan kegiatan perkemahan. Menunjukkan jiwa kepemimpinan.' },
    { namaEkskul: 'Seni Tari', predikat: 'Baik', deskripsi: 'Mampu menampilkan tarian daerah dengan baik, perlu meningkatkan kekompakan gerakan.' },
  ],
  catatanWaliKelas: 'Ahmad adalah siswa yang rajin dan disiplin. Ia selalu mengerjakan tugas tepat waktu dan aktif dalam kegiatan kelas. Pertahankan prestasinya dan terus tingkatkan kemampuan dalam Matematika. Tetap semangat!',
  waliKelas: 'Rina Marlina, S.Pd.',
  nipWaliKelas: '198507162010012022',
};

// =============================================
// Variant availability per section type
// =============================================

export const SECTION_VARIANTS: Record<string, VarianTampilan[]> = {
  header: ['ringkas', 'lengkap_dengan_deskripsi'],
  identitas: ['satu_kolom', 'dua_kolom'],
  sikap: ['ringkas', 'lengkap_dengan_deskripsi'],
  ekskul: ['ringkas', 'lengkap_dengan_deskripsi'],
  catatan_wali_kelas: ['ringkas', 'lengkap_dengan_deskripsi'],
  footer: ['ringkas', 'lengkap_dengan_deskripsi'],
  nilai_mapel: ['ringkas', 'lengkap_dengan_deskripsi', 'satu_kolom', 'dua_kolom'],
};

export const SECTION_LABELS: Record<string, string> = {
  header: 'Kop Raport',
  identitas: 'Identitas Siswa',
  sikap: 'Penilaian Sikap',
  ekskul: 'Ekstrakurikuler',
  catatan_wali_kelas: 'Catatan Wali Kelas',
  footer: 'Tanda Tangan',
  nilai_mapel: 'Nilai Mata Pelajaran',
};

export const VARIANT_LABELS: Record<VarianTampilan, string> = {
  ringkas: 'Ringkas',
  lengkap_dengan_deskripsi: 'Lengkap dengan Deskripsi',
  dua_kolom: 'Dua Kolom',
  satu_kolom: 'Satu Kolom',
};

// =============================================
// Individual Section Renderers
// =============================================

interface SectionRendererProps {
  section: LayoutSection;
  data?: DummyData;
  isPreview?: boolean;
}

function IdentitasSatuKolom({ data }: { data: DummyData }) {
  const s = data.siswa;
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        <tr><td className="border border-gray-300 px-3 py-1.5 w-40 font-medium">Nama Siswa</td><td className="border border-gray-300 px-3 py-1.5">: {s.nama}</td></tr>
        <tr><td className="border border-gray-300 px-3 py-1.5 font-medium">NISN</td><td className="border border-gray-300 px-3 py-1.5">: {s.nisn}</td></tr>
        <tr><td className="border border-gray-300 px-3 py-1.5 font-medium">NIS Lokal</td><td className="border border-gray-300 px-3 py-1.5">: {s.nisLokal}</td></tr>
        <tr><td className="border border-gray-300 px-3 py-1.5 font-medium">Kelas</td><td className="border border-gray-300 px-3 py-1.5">: {s.kelas}</td></tr>
        <tr><td className="border border-gray-300 px-3 py-1.5 font-medium">Semester</td><td className="border border-gray-300 px-3 py-1.5">: {s.semester}</td></tr>
        <tr><td className="border border-gray-300 px-3 py-1.5 font-medium">Tahun Ajaran</td><td className="border border-gray-300 px-3 py-1.5">: {s.tahunAjaran}</td></tr>
      </tbody>
    </table>
  );
}

function IdentitasDuaKolom({ data }: { data: DummyData }) {
  const s = data.siswa;
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        <tr>
          <td className="border border-gray-300 px-3 py-1.5 w-40 font-medium">Nama Siswa</td>
          <td className="border border-gray-300 px-3 py-1.5">: {s.nama}</td>
          <td className="border border-gray-300 px-3 py-1.5 w-32 font-medium">NISN</td>
          <td className="border border-gray-300 px-3 py-1.5">: {s.nisn}</td>
        </tr>
        <tr>
          <td className="border border-gray-300 px-3 py-1.5 font-medium">NIS Lokal</td>
          <td className="border border-gray-300 px-3 py-1.5">: {s.nisLokal}</td>
          <td className="border border-gray-300 px-3 py-1.5 font-medium">Kelas</td>
          <td className="border border-gray-300 px-3 py-1.5">: {s.kelas}</td>
        </tr>
        <tr>
          <td className="border border-gray-300 px-3 py-1.5 font-medium">Semester</td>
          <td className="border border-gray-300 px-3 py-1.5">: {s.semester}</td>
          <td className="border border-gray-300 px-3 py-1.5 font-medium">Tahun Ajaran</td>
          <td className="border border-gray-300 px-3 py-1.5">: {s.tahunAjaran}</td>
        </tr>
      </tbody>
    </table>
  );
}

function HeaderRingkas({ data }: { data: DummyData }) {
  return (
    <div className="text-center">
      <h2 className="text-lg font-bold uppercase">{data.sekolah.nama}</h2>
      <h3 className="text-base font-semibold">LAPORAN HASIL BELAJAR</h3>
    </div>
  );
}

function HeaderLengkap({ data }: { data: DummyData }) {
  return (
    <div className="text-center border-b-2 border-black pb-2 mb-2">
      <h2 className="text-lg font-bold uppercase">{data.sekolah.nama}</h2>
      <p className="text-xs">{data.sekolah.alamat}</p>
      <p className="text-xs">NPSN: {data.sekolah.npsn}</p>
      <h3 className="text-base font-semibold mt-1">LAPORAN HASIL BELAJAR</h3>
    </div>
  );
}

function SikapRingkas({ data }: { data: DummyData }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-3 py-1.5 text-left">Dimensi Sikap</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Nilai</th>
        </tr>
      </thead>
      <tbody>
        {data.sikap.map((s, i) => (
          <tr key={i}>
            <td className="border border-gray-300 px-3 py-1.5">{s.label}</td>
            <td className="border border-gray-300 px-3 py-1.5">{s.nilai}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SikapLengkap({ data }: { data: DummyData }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-3 py-1.5 text-left">Dimensi Sikap</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Nilai</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Deskripsi</th>
        </tr>
      </thead>
      <tbody>
        {data.sikap.map((s, i) => (
          <tr key={i}>
            <td className="border border-gray-300 px-3 py-1.5">{s.label}</td>
            <td className="border border-gray-300 px-3 py-1.5">{s.nilai}</td>
            <td className="border border-gray-300 px-3 py-1.5">{s.deskripsi}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EkskulRingkas({ data }: { data: DummyData }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-3 py-1.5 text-left">Kegiatan Ekstrakurikuler</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Predikat</th>
        </tr>
      </thead>
      <tbody>
        {data.ekskul.map((e, i) => (
          <tr key={i}>
            <td className="border border-gray-300 px-3 py-1.5">{e.namaEkskul}</td>
            <td className="border border-gray-300 px-3 py-1.5">{e.predikat}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EkskulLengkap({ data }: { data: DummyData }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-3 py-1.5 text-left">Kegiatan Ekstrakurikuler</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Predikat</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Deskripsi</th>
        </tr>
      </thead>
      <tbody>
        {data.ekskul.map((e, i) => (
          <tr key={i}>
            <td className="border border-gray-300 px-3 py-1.5">{e.namaEkskul}</td>
            <td className="border border-gray-300 px-3 py-1.5">{e.predikat}</td>
            <td className="border border-gray-300 px-3 py-1.5">{e.deskripsi}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CatatanWaliKelasRingkas({ data }: { data: DummyData }) {
  return (
    <div className="text-sm italic border border-gray-300 rounded p-3">
      {data.catatanWaliKelas}
    </div>
  );
}

function CatatanWaliKelasLengkap({ data }: { data: DummyData }) {
  return (
    <div className="text-sm">
      <div className="italic border border-gray-300 rounded p-3 mb-3">
        {data.catatanWaliKelas}
      </div>
      <div className="text-right text-sm">
        <p>Mengetahui,</p>
        <p className="font-medium mt-1">Wali Kelas,</p>
        <div className="h-12" />
        <p className="font-medium">{data.waliKelas}</p>
        <p>NIP. {data.nipWaliKelas}</p>
      </div>
    </div>
  );
}

function FooterRingkas({ data }: { data: DummyData }) {
  return (
    <div className="flex justify-between text-sm mt-4">
      <div className="text-center w-1/2">
        <p>Mengetahui,</p>
        <p className="font-medium mt-1">Wali Kelas,</p>
        <div className="h-12" />
        <p className="font-medium underline">{data.waliKelas}</p>
        <p>NIP. {data.nipWaliKelas}</p>
      </div>
      <div className="text-center w-1/2">
        <p>Kepala Sekolah,</p>
        <div className="h-12" />
        <p className="font-medium underline">{data.sekolah.kepalaSekolah}</p>
        <p>NIP. {data.sekolah.nipKepsek}</p>
      </div>
    </div>
  );
}

function FooterLengkap({ data }: { data: DummyData }) {
  return (
    <div className="text-sm mt-4 border-t border-gray-300 pt-4">
      <div className="flex justify-between">
        <div className="text-center w-1/2">
          <p>Mengetahui Orang Tua/Wali,</p>
          <div className="h-14" />
          <p className="font-medium underline">( _________________ )</p>
        </div>
        <div className="text-center w-1/2">
          <p>Wali Kelas,</p>
          <div className="h-14" />
          <p className="font-medium underline">{data.waliKelas}</p>
          <p>NIP. {data.nipWaliKelas}</p>
        </div>
      </div>
      <div className="text-center mt-4">
        <p>Kepala {data.sekolah.nama},</p>
        <div className="h-14" />
        <p className="font-medium underline">{data.sekolah.kepalaSekolah}</p>
        <p>NIP. {data.sekolah.nipKepsek}</p>
      </div>
    </div>
  );
}

function NilaiMapelRingkas({ data }: { data: DummyData }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-3 py-1.5 text-left">No</th>
          <th className="border border-gray-300 px-3 py-1.5 text-left">Mata Pelajaran</th>
          <th className="border border-gray-300 px-3 py-1.5 text-center">Nilai</th>
          <th className="border border-gray-300 px-3 py-1.5 text-center">KKM</th>
          <th className="border border-gray-300 px-3 py-1.5 text-center">Predikat</th>
        </tr>
      </thead>
      <tbody>
        {data.nilaiMapel.map((m, i) => (
          <tr key={i}>
            <td className="border border-gray-300 px-3 py-1.5 text-center">{i + 1}</td>
            <td className="border border-gray-300 px-3 py-1.5">{m.namaMapel}</td>
            <td className="border border-gray-300 px-3 py-1.5 text-center">{m.nilaiAkhir ?? '-'}</td>
            <td className="border border-gray-300 px-3 py-1.5 text-center">{m.kkm ?? '-'}</td>
            <td className="border border-gray-300 px-3 py-1.5 text-center">{m.predikat}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NilaiMapelLengkap({ data }: { data: DummyData }) {
  return (
    <div className="space-y-3">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-3 py-1.5 text-left">No</th>
            <th className="border border-gray-300 px-3 py-1.5 text-left">Mata Pelajaran</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center">Nilai</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center">KKM</th>
            <th className="border border-gray-300 px-3 py-1.5 text-center">Predikat</th>
          </tr>
        </thead>
        <tbody>
          {data.nilaiMapel.map((m, i) => (
            <tr key={i}>
              <td className="border border-gray-300 px-3 py-1.5 text-center">{i + 1}</td>
              <td className="border border-gray-300 px-3 py-1.5">{m.namaMapel}</td>
              <td className="border border-gray-300 px-3 py-1.5 text-center">{m.nilaiAkhir ?? '-'}</td>
              <td className="border border-gray-300 px-3 py-1.5 text-center">{m.kkm ?? '-'}</td>
              <td className="border border-gray-300 px-3 py-1.5 text-center">{m.predikat}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-2">
        {data.nilaiMapel.map((m, i) => (
          <div key={i} className="text-sm">
            <p className="font-medium">{m.namaMapel}</p>
            <p className="italic text-gray-600">{m.deskripsiCapaian}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function NilaiMapelSatuKolom({ data }: { data: DummyData }) {
  return (
    <div className="space-y-4">
      {data.nilaiMapel.map((m, i) => (
        <div key={i} className="text-sm border-b border-gray-200 pb-2">
          <div className="flex justify-between">
            <span className="font-medium">{m.namaMapel}</span>
            <span>Nilai: {m.nilaiAkhir ?? '-'} | KKM: {m.kkm ?? '-'} | {m.predikat}</span>
          </div>
          <p className="italic text-gray-600 mt-1">{m.deskripsiCapaian}</p>
        </div>
      ))}
    </div>
  );
}

function NilaiMapelDuaKolom({ data }: { data: DummyData }) {
  const mid = Math.ceil(data.nilaiMapel.length / 2);
  const kiri = data.nilaiMapel.slice(0, mid);
  const kanan = data.nilaiMapel.slice(mid);
  const renderList = (items: DummyDataNilaiMapel[]) => (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-2 py-1 text-left">Mapel</th>
          <th className="border border-gray-300 px-2 py-1 text-center">Nilai</th>
          <th className="border border-gray-300 px-2 py-1 text-center">Pred</th>
        </tr>
      </thead>
      <tbody>
        {items.map((m, i) => (
          <tr key={i}>
            <td className="border border-gray-300 px-2 py-1">{m.namaMapel}</td>
            <td className="border border-gray-300 px-2 py-1 text-center">{m.nilaiAkhir ?? '-'}</td>
            <td className="border border-gray-300 px-2 py-1 text-center">{m.predikat}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>{renderList(kiri)}</div>
      <div>{renderList(kanan)}</div>
    </div>
  );
}

// =============================================
// Master Renderer — maps section type + variant
// =============================================

function getSectionContent(section: LayoutSection, data: DummyData) {
  const v = section.varianTampilan;
  const t = section.sectionType;

  if (t === 'header') {
    if (v === 'ringkas') return <HeaderRingkas data={data} />;
    return <HeaderLengkap data={data} />;
  }
  if (t === 'identitas') {
    if (v === 'dua_kolom') return <IdentitasDuaKolom data={data} />;
    return <IdentitasSatuKolom data={data} />;
  }
  if (t === 'sikap') {
    if (v === 'lengkap_dengan_deskripsi') return <SikapLengkap data={data} />;
    return <SikapRingkas data={data} />;
  }
  if (t === 'ekskul') {
    if (v === 'lengkap_dengan_deskripsi') return <EkskulLengkap data={data} />;
    return <EkskulRingkas data={data} />;
  }
  if (t === 'catatan_wali_kelas') {
    if (v === 'lengkap_dengan_deskripsi') return <CatatanWaliKelasLengkap data={data} />;
    return <CatatanWaliKelasRingkas data={data} />;
  }
  if (t === 'footer') {
    if (v === 'lengkap_dengan_deskripsi') return <FooterLengkap data={data} />;
    return <FooterRingkas data={data} />;
  }
  if (t === 'nilai_mapel') {
    if (v === 'lengkap_dengan_deskripsi') return <NilaiMapelLengkap data={data} />;
    if (v === 'satu_kolom') return <NilaiMapelSatuKolom data={data} />;
    if (v === 'dua_kolom') return <NilaiMapelDuaKolom data={data} />;
    return <NilaiMapelRingkas data={data} />;
  }
  return <div className="text-red-500 text-sm">Unknown section type: {t}</div>;
}

export function RaportSectionRenderer({
  section,
  data = DUMMY_DATA,
}: SectionRendererProps) {
  const label = SECTION_LABELS[section.sectionType] ?? section.sectionType;

  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold uppercase mb-2 text-gray-700">{label}</h3>
      {section.visible ? (
        getSectionContent(section, data)
      ) : (
        <div className="text-gray-400 italic text-sm border border-dashed border-gray-300 rounded p-3 text-center">
          {label} — disembunyikan
        </div>
      )}
    </div>
  );
}

export function RaportPreview({
  sections,
  data = DUMMY_DATA,
}: {
  sections: LayoutSection[];
  data?: DummyData;
}) {
  const visibleSections = sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);

  if (visibleSections.length === 0) {
    return (
      <div className="text-center text-gray-400 py-12 text-sm">
        Belum ada section yang ditampilkan.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 max-w-[800px] mx-auto">
      {visibleSections.map((section) => (
        <RaportSectionRenderer key={section.sectionType} section={section} data={data} />
      ))}
    </div>
  );
}
