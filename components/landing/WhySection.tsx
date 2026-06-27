import { IconCircleCheckFilled } from "@tabler/icons-react";

export interface WhyPoint {
  text: string;
}

export interface WhySectionProps {
  title?: string;
  subtitle?: string;
  points?: WhyPoint[];
}

const defaultPoints = [
  "Sesuai regulasi Kemenag & Kemendikbud terbaru",
  "Tersedia offline-first, cocok untuk daerah sinyal lemah",
  "Harga terjangkau, mulai Rp 49.000/bulan",
  "Data tersimpan aman, sesuai UU PDP No. 27/2022",
];

export default function WhySection({
  title = "Emang Worth It Pakai GuruPRO AI?",
  subtitle = "Bukan sekadar aplikasi, GuruPRO AI adalah Asisten Guru yang benar-benar mengerti kebutuhan Administrasi Guru",
  points = defaultPoints.map((p) => ({ text: p })),
}: WhySectionProps) {
  return (
    <section id="cara-kerja" className="py-20 md:py-28 bg-neutral-50">
      <div className="container-page">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-neutral-900">
              {title}
            </h2>
            <p className="mt-4 text-neutral-500 text-base leading-relaxed">
              {subtitle}
            </p>

            <ul className="mt-8 space-y-4">
              {points.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <IconCircleCheckFilled
                    size={22}
                    className="text-primary-600 shrink-0 mt-0.5"
                  />
                  <span className="text-neutral-700 font-medium">
                    {point.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Illustration / Mockup */}
          <div className="hidden lg:flex justify-center">
            <div className="relative w-full max-w-md">
              {/* Main card */}
              <div className="bg-white rounded-3xl shadow-xl border border-neutral-200/60 p-8 relative z-10">
                <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">🤖</span>
                </div>
                <h4 className="text-center font-bold text-neutral-900">
                  Asisten AI GuruPRO
                </h4>
                <p className="text-center text-sm text-neutral-500 mt-2">
                  Siap membantu administrasi Anda 24/7
                </p>

                {/* Chat bubble mockups */}
                <div className="mt-6 space-y-3">
                  <div className="bg-primary-50 border border-primary-100 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-neutral-700">
                    Buatkan RPP Matematika kelas 4 semester 2
                  </div>
                  <div className="bg-primary-600 text-white rounded-2xl rounded-tr-none px-4 py-3 text-sm ml-8">
                    RPP sudah siap! Berikut link download-nya...
                  </div>
                </div>
              </div>

              {/* Decorative badge */}
              <div className="absolute -top-4 -right-4 bg-primary-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg shadow-primary-200">
                AI-Powered
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
