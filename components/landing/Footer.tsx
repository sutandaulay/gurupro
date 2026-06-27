import { IconSparklesFilled } from "@tabler/icons-react";

export interface FooterLink {
  label: string; // CMS: footer link label
  href: string; // CMS: footer link href
}

export interface SocialLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export interface ContactItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}

export interface FooterColumn {
  title: string; // CMS: footer column title
  links: FooterLink[];
}

export interface FooterProps {
  appName?: string;
  appLogo?: string;
  description?: string;
  socialLinks?: SocialLink[];
  columns?: FooterColumn[];
  contact?: ContactItem[];
  copyright?: string;
  madeInIndonesia?: boolean;
}

const defaultSocialLinks: SocialLink[] = [
  {
    label: "Facebook",
    href: "https://facebook.com/guruproai",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    href: "https://instagram.com/guruproai",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@guruproai",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0 -1.94 -2.02c-1.72 -.4 -8.6 -.4 -8.6 -.4s-6.88 0 -8.6 .4a2.78 2.78 0 0 0 -1.94 2.02a28.2 28.2 0 0 0 -.46 5.55a28.2 28.2 0 0 0 .46 5.55a2.78 2.78 0 0 0 1.94 2.02c1.72 .4 8.6 .4 8.6 .4s6.88 0 8.6 -.4a2.78 2.78 0 0 0 1.94 -2.02a28.2 28.2 0 0 0 .46 -5.55a28.2 28.2 0 0 0 -.46 -5.55z" />
        <polygon points="9.75 15.02 15.5 11.97 9.75 8.93 9.75 15.02" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://tiktok.com/@guruproai",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2V3h4.016a5 5 0 0 0 4.984 4.917z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://linkedin.com/company/guruproai",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2" />
        <line x1="8" y1="11" x2="8" y2="16" />
        <line x1="8" y1="8" x2="8.01" y2="8" />
        <line x1="12" y1="16" x2="12" y2="11" />
        <path d="M16 16v-3a2 2 0 0 0 -4 0" />
      </svg>
    ),
  },
];

const defaultColumns: FooterColumn[] = [
  {
    title: "Links",
    links: [
      { label: "Tentang GuruPRO", href: "/tentang" },
      { label: "Fitur", href: "#fitur" },
      { label: "Harga", href: "#harga" },
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Untuk Sekolah",
    links: [
      { label: "Daftar Sekolah", href: "/login?mode=register&sekolah=1" },
      { label: "Demo", href: "/demo" },
      { label: "Kontak Sales", href: "/kontak" },
      { label: "Kemitraan", href: "/kemitraan" },
    ],
  },
];

const defaultContact: ContactItem[] = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <polyline points="22,7 12,13 2,7" />
      </svg>
    ),
    label: "Email",
    value: "support@gurupro.id",
    href: "mailto:support@gurupro.id",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9" />
        <path d="M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1" />
      </svg>
    ),
    label: "WhatsApp CS",
    value: "+62 812-8396-0337",
    href: "https://wa.me/6281283960337",
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <polyline points="12 7 12 12 15 15" />
      </svg>
    ),
    label: "Jam Operasional",
    value: "Senin–Jumat, 08:00–17:00",
  },
];

export default function Footer({
  appName = "GuruPRO",
  appLogo,
  description = "Platform administrasi guru berbasis AI untuk membantu guru Indonesia membuat RPP, absensi, jurnal mengajar, hingga rapor dalam satu platform.",
  socialLinks = defaultSocialLinks,
  columns = defaultColumns,
  contact = defaultContact,
  copyright = `GuruPRO AI © ${new Date().getFullYear()}. All rights reserved.`,
  madeInIndonesia = true,
}: FooterProps) {
  return (
    <footer className="bg-neutral-900 text-neutral-400 border-t border-neutral-800">
      <div className="container-page py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          {/* Column 1: Brand + Description + Social */}
          <div className="sm:col-span-2 lg:col-span-1">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-4">
              {appLogo ? (
                <img
                  src={appLogo}
                  alt={appName}
                  className="h-9 object-contain brightness-0 invert"
                />
              ) : (
                <span className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-primary-800/30">
                  <IconSparklesFilled size={20} />
                </span>
              )}
              <span className="text-xl font-black tracking-tight text-white">
                {appName}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm leading-relaxed text-neutral-500 mb-6">
              {description}
            </p>

            {/* Social Media */}
            <div className="flex items-center gap-3">
              {socialLinks.map((social, idx) => (
                <a
                  key={idx}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500 hover:bg-primary-600 hover:text-white hover:border-primary-600 transition"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Column 2 & 3: Link Columns */}
          {columns.map((col, colIdx) => (
            <div key={colIdx}>
              <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-5">
                {col.title}
              </h4>
              <ul className="space-y-3">
                {col.links.map((link, linkIdx) => (
                  <li key={linkIdx}>
                    <a
                      href={link.href}
                      className="text-sm text-neutral-500 hover:text-white transition"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Column 4: Contact */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-white mb-5">
              Kontak
            </h4>
            <ul className="space-y-4">
              {contact.map((item, idx) => (
                <li key={idx}>
                  {item.href ? (
                    <a
                      href={item.href}
                      target={item.href.startsWith("http") ? "_blank" : undefined}
                      rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex items-start gap-3 group"
                    >
                      <span className="text-neutral-600 group-hover:text-primary-400 transition shrink-0 mt-0.5">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-xs text-neutral-600 font-medium">
                          {item.label}
                        </p>
                        <p className="text-sm text-neutral-400 group-hover:text-white transition">
                          {item.value}
                        </p>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="text-neutral-600 shrink-0 mt-0.5">
                        {item.icon}
                      </span>
                      <div>
                        <p className="text-xs text-neutral-600 font-medium">
                          {item.label}
                        </p>
                        <p className="text-sm text-neutral-400">
                          {item.value}
                        </p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-neutral-800">
        <div className="container-page py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-600">
          <p>{copyright}</p>
          {madeInIndonesia && (
            <span className="inline-flex items-center gap-1.5 text-neutral-500">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Dibuat di Indonesia
            </span>
          )}
        </div>
      </div>
    </footer>
  );
}
