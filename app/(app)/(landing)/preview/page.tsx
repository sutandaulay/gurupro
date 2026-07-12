import { cookies } from "next/headers";
import type { Metadata } from "next";

import LandingContent from "@/components/landing/LandingContent";

import {
  getLandingPage,
  getFeatures,
  getWhyPoints,
  getFooterContent,
} from "@/lib/payload";
import {
  fallbackHero,
  fallbackFeatures,
  fallbackWhyPoints,
  fallbackFooter,
  resolveTablerIcon,
} from "@/lib/fallback-data";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Preview - GuruPRO AI Landing Page",
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const refCode = typeof sp.ref === "string" ? sp.ref.toUpperCase() : null;

  let isLoggedIn = false;
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("gurupro_session")?.value;
    if (sessionCookie) {
      const session = JSON.parse(sessionCookie);
      if (session.user_id || session.id) isLoggedIn = true;
    }
  } catch {}

  const [landingPage, featuresDocs, whyDocs, footerData] = await Promise.all([
    getLandingPage().catch(() => null),
    getFeatures().catch(() => null),
    getWhyPoints().catch(() => null),
    getFooterContent().catch(() => null),
  ]);

  const landing = landingPage as Record<string, any> | null;

  const hero = {
    badge: landing?.heroBadgeText || fallbackHero.badge,
    headline: landing?.heroHeadline || fallbackHero.headline,
    subheadline: landing?.heroSubheadline || fallbackHero.subheadline,
    stats: landing?.heroStats?.length
      ? landing.heroStats.map((s: any) => ({
          value: s.number || s.value,
          label: s.label,
        }))
      : fallbackHero.stats,
  };

  const features = featuresDocs?.length
    ? featuresDocs.map((f: any) => ({
        icon: resolveTablerIcon(f.icon) as any,
        title: f.title,
        description: f.description,
      }))
    : fallbackFeatures;

  const whyPoints = whyDocs?.length
    ? whyDocs.map((p: any) => ({ text: p.point }))
    : fallbackWhyPoints;

  const footerDesc =
    (footerData as any)?.description || fallbackFooter.description;
  const footerCopyright =
    (footerData as any)?.copyrightText || fallbackFooter.copyright;

  const footerColumns = (footerData as any)?.links?.length
    ? (() => {
        const links = (footerData as any).links;
        const colMap: Record<
          string,
          { title: string; links: { label: string; href: string }[] }
        > = {};
        for (const link of links) {
          const col = link.column || "links";
          if (!colMap[col]) {
            colMap[col] = {
              title: col === "sekolah" ? "Untuk Sekolah" : "Links",
              links: [],
            };
          }
          colMap[col].links.push({ label: link.label, href: link.url });
        }
        return Object.values(colMap);
      })()
    : [];

  return (
    <LandingContent
      isLoggedIn={isLoggedIn}
      refCode={refCode}
      hero={hero}
      features={features}
      whyPoints={whyPoints}
      footer={{
        description: footerDesc,
        copyright: footerCopyright,
        columns: footerColumns,
      }}
      showPreviewBanner
    />
  );
}
