import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Offline SVG illustration */}
      <svg
        viewBox="0 0 120 120"
        className="w-32 h-32 mb-8 text-gray-300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M60 20c-8 0-15.6 1.6-22.6 4.6"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M106 50C96 30 80 20 60 20"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M60 40c-6 0-11.6 1.2-16.8 3.4"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M88 50c-5-9-15-14-28-14"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M60 58c-3 0-5.6.6-8 1.6"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="60" cy="75" r="6" fill="currentColor" />
        <line
          x1="10"
          y1="10"
          x2="110"
          y2="110"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Tidak Ada Koneksi Internet
      </h1>
      <p className="text-sm text-gray-500 max-w-md mb-8">
        Periksa koneksi internet Anda dan coba lagi. Beberapa fitur GuruPRO
        mungkin tersedia dalam mode offline.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors cursor-pointer mb-12"
      >
        Coba Lagi
      </button>

      {/* Offline features */}
      <div className="text-left max-w-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Fitur yang tersedia offline:
        </h3>
        <ul className="space-y-2 text-sm text-gray-500">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Melihat RPP yang sudah dibuat
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Membaca materi yang tersimpan
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
            Membuat soal baru (perlu koneksi)
          </li>
        </ul>
      </div>
    </div>
  );
}
