"use client";

import Image from "next/image";
import { useEffect, useState, useCallback } from "react";
import {
  IconFileText, IconStar, IconThumbUp, IconSchool, IconPointer,
  IconLayoutBottombar, IconRobot, IconPlus, IconTrash, IconGripVertical,
  IconEye, IconDeviceFloppy, IconChevronRight, IconArrowUp, IconArrowDown,
  IconToggleLeft, IconToggleRight, IconQuestionMark, IconGift, IconNews,
  IconCreditCard, IconEdit,   IconSparkles, IconBrain, IconBolt, IconHeart,
  IconRocket, IconShield, IconBook, IconAward, IconCertificate,
  IconBulb, IconCloud, IconCode, IconCpu, IconDatabase, IconDeviceDesktop,
  IconFiles, IconFlask, IconGlobe, IconHash, IconHeadphones, IconHelp,
  IconKey, IconLanguage, IconLink, IconLock, IconMail,
  IconMap, IconMessage, IconMusic, IconPalette, IconPaperclip, IconPhoto,
  IconPlug, IconPuzzle, IconRefresh, IconScale, IconSearch,
  IconSend, IconSettings, IconShare, IconSignature, IconSitemap,
  IconSmartHome, IconSpeakerphone, IconSpeedboat,
  IconSun, IconTable, IconTag, IconTarget, IconTerminal, IconTestPipe,
  IconTicket, IconTimeline, IconTools, IconTrendingUp, IconTrophy, IconTruck,
  IconUsers, IconVideo, IconWallet, IconWand, IconWorld, IconWreckingBall,
} from "@tabler/icons-react";
import { resolveTablerIcon } from "@/lib/fallback-data";

type IconEntry = { name: string; comp: React.ComponentType<any> };
const iconList: IconEntry[] = [
  { name: "IconSparkles", comp: IconSparkles }, { name: "IconBrain", comp: IconBrain },
  { name: "IconBolt", comp: IconBolt }, { name: "IconHeart", comp: IconHeart },
  { name: "IconRocket", comp: IconRocket }, { name: "IconShield", comp: IconShield },
  { name: "IconBook", comp: IconBook }, { name: "IconAward", comp: IconAward },
  { name: "IconCertificate", comp: IconCertificate }, { name: "IconBulb", comp: IconBulb },
  { name: "IconCloud", comp: IconCloud }, { name: "IconCode", comp: IconCode },
  { name: "IconCpu", comp: IconCpu }, { name: "IconDatabase", comp: IconDatabase },
  { name: "IconDeviceDesktop", comp: IconDeviceDesktop }, { name: "IconFiles", comp: IconFiles },
  { name: "IconFlask", comp: IconFlask }, { name: "IconGlobe", comp: IconGlobe },
  { name: "IconHash", comp: IconHash }, { name: "IconHeadphones", comp: IconHeadphones },
  { name: "IconHelp", comp: IconHelp }, { name: "IconKey", comp: IconKey },
  { name: "IconLanguage", comp: IconLanguage }, { name: "IconLink", comp: IconLink },
  { name: "IconLock", comp: IconLock }, { name: "IconMail", comp: IconMail },
  { name: "IconMap", comp: IconMap }, { name: "IconMessage", comp: IconMessage },
  { name: "IconMusic", comp: IconMusic }, { name: "IconPalette", comp: IconPalette },
  { name: "IconPaperclip", comp: IconPaperclip }, { name: "IconPhoto", comp: IconPhoto },
  { name: "IconPlug", comp: IconPlug }, { name: "IconPuzzle", comp: IconPuzzle },
  { name: "IconRefresh", comp: IconRefresh }, { name: "IconScale", comp: IconScale },
  { name: "IconSearch", comp: IconSearch }, { name: "IconSend", comp: IconSend },
  { name: "IconSettings", comp: IconSettings }, { name: "IconShare", comp: IconShare },
  { name: "IconSignature", comp: IconSignature }, { name: "IconSitemap", comp: IconSitemap },
  { name: "IconSmartHome", comp: IconSmartHome }, { name: "IconSpeakerphone", comp: IconSpeakerphone },
  { name: "IconSpeedboat", comp: IconSpeedboat }, { name: "IconSun", comp: IconSun },
  { name: "IconTable", comp: IconTable }, { name: "IconTag", comp: IconTag },
  { name: "IconTarget", comp: IconTarget }, { name: "IconTerminal", comp: IconTerminal },
  { name: "IconTestPipe", comp: IconTestPipe }, { name: "IconTicket", comp: IconTicket },
  { name: "IconTimeline", comp: IconTimeline }, { name: "IconTools", comp: IconTools },
  { name: "IconTrendingUp", comp: IconTrendingUp }, { name: "IconTrophy", comp: IconTrophy },
  { name: "IconTruck", comp: IconTruck }, { name: "IconUsers", comp: IconUsers },
  { name: "IconVideo", comp: IconVideo }, { name: "IconWallet", comp: IconWallet },
  { name: "IconWand", comp: IconWand }, { name: "IconWorld", comp: IconWorld },
  { name: "IconWreckingBall", comp: IconWreckingBall },
  { name: "IconStar", comp: IconStar }, { name: "IconRobot", comp: IconRobot },
  { name: "IconThumbUp", comp: IconThumbUp }, { name: "IconSchool", comp: IconSchool },
  { name: "IconEye", comp: IconEye }, { name: "IconGift", comp: IconGift },
  { name: "IconQuestionMark", comp: IconQuestionMark },
];

type TabId = "hero" | "features" | "why" | "school" | "cta" | "footer" | "chatbot" | "faq" | "referral" | "blog" | "pricing" | "legal";

interface HeroStat {
  id?: string;
  number: string;
  label: string;
}
interface HeroCTA {
  label?: string;
  url?: string;
}
interface HeroData {
  heroBadgeText?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  heroCTAPrimary?: HeroCTA;
  heroCTASecondary?: HeroCTA;
  heroStats?: HeroStat[];
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: number | string | null;
}

interface FeatureItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  order: number;
  isActive: boolean;
}

interface WhyPoint {
  id: string;
  point: string;
  order: number;
  isActive: boolean;
}

interface FooterLink {
  id?: string;
  label: string;
  url: string;
  column: "links" | "sekolah";
}
interface SocialLink {
  id?: string;
  platform: string;
  url: string;
}
interface FooterData {
  description?: string;
  links?: FooterLink[];
  contactEmail?: string;
  contactWhatsapp?: string;
  socialLinks?: SocialLink[];
  copyrightText?: string;
}

interface ChatbotData {
  isEnabled?: boolean;
  welcomeMessage?: string;
  systemPrompt?: string;
  humanCSUrl?: string;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "features", label: "Fitur" },
  { id: "why", label: "Kenapa" },
  { id: "pricing", label: "Paket" },
  { id: "school", label: "Sekolah" },
  { id: "cta", label: "CTA" },
  { id: "footer", label: "Footer" },
  { id: "chatbot", label: "Chatbot" },
  { id: "faq", label: "FAQ" },
  { id: "referral", label: "Referral" },
  { id: "legal", label: "Legal" },
  { id: "blog", label: "Blog" },
];

export default function CmsLandingEditor() {
  const [activeTab, setActiveTab] = useState<TabId>("hero");

  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const showToast = useCallback((type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [hero, setHero] = useState<HeroData>({});
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [editFeature, setEditFeature] = useState<Partial<FeatureItem> | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [whyPoints, setWhyPoints] = useState<WhyPoint[]>([]);
  const [footer, setFooter] = useState<FooterData>({});
  const [chatbot, setChatbot] = useState<ChatbotData>({});
  const [testChatOpen, setTestChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [faqItems, setFaqItems] = useState<{ question: string; answer: string }[]>([]);
  const [referral, setReferral] = useState<{
    badge: string; title: string; description: string;
    benefits: { icon: string; title: string; description: string }[];
    ctaText: string; ctaLink: string;
  }>({ badge: "", title: "", description: "", benefits: [], ctaText: "", ctaLink: "" });
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [blogCategories, setBlogCategories] = useState<any[]>([]);
  const [blogLoading, setBlogLoading] = useState(false);
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [editPricing, setEditPricing] = useState<any>(null);
  const [editPost, setEditPost] = useState<any>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [editCategory, setEditCategory] = useState<any>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [legalPages, setLegalPages] = useState<Record<string, { title: string; content: string; last_updated?: string }>>({});

  // Helper with timeout
  const fetchWithTimeout = async (url: string, timeout = 5000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Load hero
      const heroRes = await fetchWithTimeout("/api/admin/landing/hero");
      if (heroRes?.ok) {
        const heroData = await heroRes.json();
        setHero({
          heroBadgeText: heroData.badge || heroData.heroBadgeText || "",
          heroHeadline: heroData.headline || heroData.heroHeadline || "",
          heroSubheadline: heroData.subheadline || heroData.heroSubheadline || "",
          heroStats: (heroData.stats || heroData.heroStats || []).map((s: any) => ({
            number: s.value || s.number || "",
            label: s.label || "",
          })),
          heroCTAPrimary: heroData.heroCTAPrimary || { label: "Mulai Gratis Sekarang", url: "/login?mode=register" },
          heroCTASecondary: heroData.heroCTASecondary || { label: "Lihat Demo", url: "#demo" },
          seoTitle: heroData.seoTitle || "",
          seoDescription: heroData.seoDescription || "",
          ogImage: heroData.ogImage ?? null,
        });
      }

      // Load features
      const featuresRes = await fetchWithTimeout("/api/admin/landing/features");
      if (featuresRes?.ok) {
        const featuresData = await featuresRes.json();
        setFeatures(featuresData.docs || []);
      }

      // Load why points
      const whyRes = await fetchWithTimeout("/api/admin/landing/why");
      if (whyRes?.ok) {
        const whyData = await whyRes.json();
        setWhyPoints(whyData.docs || []);
      }

      // Load footer
      const footerRes = await fetchWithTimeout("/api/admin/landing/footer");
      if (footerRes?.ok) {
        const footerData = await footerRes.json();
        setFooter(footerData || {});
      }

      // Load chatbot
      const chatbotRes = await fetchWithTimeout("/api/admin/landing/chatbot");
      if (chatbotRes?.ok) {
        const chatbotData = await chatbotRes.json();
        setChatbot(chatbotData || {});
      }

      // Load pricing
      const pricingRes = await fetchWithTimeout("/api/admin/pricing");
      if (pricingRes?.ok) {
        const pricingData = await pricingRes.json();
        setPricingPlans(pricingData.plans || pricingData.docs || []);
      }

      // Load blog data
      // eslint-disable-next-line react-hooks/immutability
      await fetchBlogData();

      // Load FAQ & Referral & Legal from settings
      const settingsRes = await fetchWithTimeout("/api/admin/settings");
      if (settingsRes?.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.faqConfig) setFaqItems(settingsData.faqConfig);
        if (settingsData.referralConfig) setReferral(settingsData.referralConfig);
        setLegalPages({
          privacy_policy: settingsData.privacy_policy || { title: "Kebijakan Privasi", content: "", last_updated: "" },
          terms_conditions: settingsData.terms_conditions || { title: "Syarat & Ketentuan", content: "", last_updated: "" },
          refund_policy: settingsData.refund_policy || { title: "Kebijakan Refund", content: "", last_updated: "" },
        });
      }

      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBlogData = async () => {
    setBlogLoading(true);
    try {
      const postsRes = await fetchWithTimeout("/api/admin/posts?limit=50");
      const catsRes = await fetchWithTimeout("/api/admin/categories?limit=50");

      if (postsRes?.ok) {
        const postsData = await postsRes.json();
        setBlogPosts(postsData.docs || []);
      }
      if (catsRes?.ok) {
        const catsData = await catsRes.json();
        setBlogCategories(catsData.docs || []);
      }
    } catch {}
    setBlogLoading(false);
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const saveHero = async () => {
    try {
      setSaving("hero");
      const stats = (hero.heroStats || []).map(s => ({
        value: s?.number || "",
        label: s?.label || "",
      }));
      const payload = {
        badge: hero.heroBadgeText || "",
        headline: hero.heroHeadline || "",
        subheadline: hero.heroSubheadline || "",
        stats,
        heroCTAPrimary: hero.heroCTAPrimary || { label: "Mulai Gratis Sekarang", url: "/login?mode=register" },
        heroCTASecondary: hero.heroCTASecondary || { label: "Lihat Demo", url: "#demo" },
        seoTitle: hero.seoTitle || "",
        seoDescription: hero.seoDescription || "",
        ogImage: hero.ogImage ?? null,
      };
      const res = await fetch("/api/admin/landing/hero", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (res.ok) showToast("success", "Hero berhasil disimpan!");
      else showToast("error", "Gagal menyimpan hero");
    } catch (e) {
      console.error("saveHero error:", e);
      showToast("error", "Koneksi gagal");
    } finally {
      setSaving(null);
    }
  };

  const saveFeature = async () => {
    if (!editFeature?.title) { showToast("error", "Judul fitur wajib diisi"); return; }
    setSaving("feature");
    try {
      const method = editFeature.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/landing/features", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFeature),
      });
      if (res.ok) {
        showToast("success", editFeature.id ? "Fitur diperbarui!" : "Fitur ditambahkan!");
        setShowFeatureModal(false);
        setEditFeature(null);
        setShowIconPicker(false);
        const d = await fetch("/api/admin/landing/features").then((r) => r.json());
        setFeatures(d.docs || []);
      } else showToast("error", "Gagal menyimpan fitur");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const deleteFeature = async (id: string) => {
    if (!confirm("Hapus fitur ini?")) return;
    try {
      const res = await fetch(`/api/admin/landing/features?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Fitur dihapus!");
        setFeatures((prev) => prev.filter((f) => f.id !== id));
      } else showToast("error", "Gagal menghapus fitur");
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const toggleFeature = async (item: FeatureItem) => {
    try {
      const res = await fetch("/api/admin/landing/features", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, isActive: !item.isActive }),
      });
      if (res.ok) {
        setFeatures((prev) => prev.map((f) => f.id === item.id ? { ...f, isActive: !f.isActive } : f));
      }
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const moveFeature = async (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= features.length) return;
    const updated = [...features];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    updated.forEach((f, i) => f.order = i);
    setFeatures(updated);
    try {
      await fetch("/api/admin/landing/features", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: updated[index].id, order: updated[index].order }),
      });
      await fetch("/api/admin/landing/features", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: updated[newIndex].id, order: updated[newIndex].order }),
      });
    } catch { showToast("error", "Gagal menyusun ulang"); }
  };

  const saveWhyPoint = async (point: WhyPoint) => {
    try {
      const res = await fetch("/api/admin/landing/why", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(point),
      });
      if (res.ok) showToast("success", "Point diperbarui!");
      else showToast("error", "Gagal menyimpan");
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const addWhyPoint = async () => {
    setSaving("why");
    try {
      const res = await fetch("/api/admin/landing/why", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ point: "Point baru...", order: whyPoints.length, isActive: true }),
      });
      if (res.ok) {
        showToast("success", "Point ditambahkan!");
        const d = await fetch("/api/admin/landing/why").then((r) => r.json());
        setWhyPoints(d.docs || []);
      }
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const deleteWhyPoint = async (id: string) => {
    if (!confirm("Hapus point ini?")) return;
    try {
      await fetch(`/api/admin/landing/why?id=${id}`, { method: "DELETE" });
      setWhyPoints((prev) => prev.filter((p) => p.id !== id));
      showToast("success", "Point dihapus!");
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const toggleWhyPoint = async (item: WhyPoint) => {
    try {
      const res = await fetch("/api/admin/landing/why", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...item, isActive: !item.isActive }),
      });
      if (res.ok) setWhyPoints((prev) => prev.map((p) => p.id === item.id ? { ...p, isActive: !p.isActive } : p));
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const saveFooter = async () => {
    setSaving("footer");
    try {
      const res = await fetch("/api/admin/landing/footer", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(footer),
      });
      if (res.ok) showToast("success", "Footer berhasil disimpan!");
      else showToast("error", "Gagal menyimpan footer");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const saveFaq = async () => {
    setSaving("faq");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_faq_config", data: faqItems }),
      });
      if (res.ok) showToast("success", "FAQ berhasil disimpan!");
      else showToast("error", "Gagal menyimpan FAQ");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const saveReferral = async () => {
    setSaving("referral");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_referral_config", data: referral }),
      });
      if (res.ok) showToast("success", "Konfigurasi referral berhasil disimpan!");
      else showToast("error", "Gagal menyimpan konfigurasi referral");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  // Legal Pages
  const saveLegalPage = async (key: string) => {
    setSaving("legal");
    try {
      const data = legalPages[key];
      const actionMap: Record<string, string> = {
        privacy_policy: "update_privacy_policy",
        terms_conditions: "update_terms_conditions",
        refund_policy: "update_refund_policy",
      };
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionMap[key], data: { ...data, last_updated: new Date().toLocaleDateString("id-ID") } }),
      });
      if (res.ok) showToast("success", `${data.title} berhasil disimpan!`);
      else showToast("error", "Gagal menyimpan halaman legal");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  // Pricing Management
  const savePricing = async () => {
    if (!editPricing?.package_name) { showToast("error", "Nama paket wajib diisi"); return; }
    setSaving("pricing");
    try {
      const method = editPricing.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/pricing", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPricing),
      });
      if (res.ok) {
        showToast("success", editPricing.id ? "Paket diperbarui!" : "Paket ditambahkan!");
        setShowPricingModal(false);
        setEditPricing(null);
        const d = await fetch("/api/admin/pricing").then((r) => r.json());
        setPricingPlans(d.docs || []);
      } else showToast("error", "Gagal menyimpan paket");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const togglePricingPopular = async (plan: any) => {
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...plan, popular: !plan.popular }),
      });
      if (res.ok) {
        showToast("success", `Paket ${plan.package_name} ${plan.popular ? "tidak" : "menjadi"} populer!`);
        setPricingPlans((prev) => prev.map((p) => p.id === plan.id ? { ...p, popular: !p.popular } : p));
        const d = await fetch("/api/admin/pricing").then((r) => r.json());
        setPricingPlans(d.docs || []);
      } else showToast("error", "Gagal mengubah status populer");
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const deletePricing = async (id: number) => {
    if (!confirm("Hapus paket ini?")) return;
    try {
      const res = await fetch(`/api/admin/pricing?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Paket dihapus!");
        setPricingPlans((prev) => prev.filter((p) => p.id !== id));
      } else showToast("error", "Gagal menghapus paket");
    } catch { showToast("error", "Koneksi gagal"); }
  };

  // Blog Post Management
  const savePost = async () => {
    if (!editPost?.title) { showToast("error", "Judul artikel wajib diisi"); return; }
    setSaving("post");
    try {
      const method = editPost.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/posts", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPost),
      });
      if (res.ok) {
        showToast("success", editPost.id ? "Artikel diperbarui!" : "Artikel ditambahkan!");
        setShowPostModal(false);
        setEditPost(null);
        fetchBlogData();
      } else showToast("error", "Gagal menyimpan artikel");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const deletePost = async (id: number) => {
    if (!confirm("Hapus artikel ini?")) return;
    try {
      const res = await fetch(`/api/admin/posts?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Artikel dihapus!");
        setBlogPosts((prev) => prev.filter((p) => p.id !== id));
      } else showToast("error", "Gagal menghapus artikel");
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const togglePostStatus = async (post: any) => {
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...post, status: post.status === "published" ? "draft" : "published" }),
      });
      if (res.ok) {
        showToast("success", post.status === "published" ? "Dit设置为 draft" : "Dipublikasi!");
        fetchBlogData();
      }
    } catch { showToast("error", "Koneksi gagal"); }
  };

  // Category Management
  const saveCategory = async () => {
    if (!editCategory?.title) { showToast("error", "Nama kategori wajib diisi"); return; }
    setSaving("category");
    try {
      const method = editCategory.id ? "PUT" : "POST";
      const res = await fetch("/api/admin/categories", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCategory),
      });
      if (res.ok) {
        showToast("success", editCategory.id ? "Kategori diperbarui!" : "Kategori ditambahkan!");
        setShowCategoryModal(false);
        setEditCategory(null);
        fetchBlogData();
      } else {
        const err = await res.json();
        showToast("error", err.error || "Gagal menyimpan kategori");
      }
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      const res = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("success", "Kategori dihapus!");
        setBlogCategories((prev) => prev.filter((c) => c.id !== id));
      } else {
        const err = await res.json();
        showToast("error", err.error || "Gagal menghapus kategori");
      }
    } catch { showToast("error", "Koneksi gagal"); }
  };

  const saveChatbot = async () => {
    setSaving("chatbot");
    try {
      const res = await fetch("/api/admin/landing/chatbot", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(chatbot),
      });
      if (res.ok) showToast("success", "Konfigurasi chatbot disimpan!");
      else showToast("error", "Gagal menyimpan");
    } catch { showToast("error", "Koneksi gagal"); }
    finally { setSaving(null); }
  };

  const schoolLinks = footer.links?.filter((l) => l.column === "sekolah") || [];
  const addSchoolLink = () => {
    setFooter((prev) => ({
      ...prev,
      links: [...(prev.links || []), { label: "", url: "", column: "sekolah" as const }],
    }));
  };
  const updateSchoolLink = (index: number, field: "label" | "url", value: string) => {
    const links = [...(footer.links || [])];
    const schoolItems = links.filter((l) => l.column === "sekolah");
    const target = schoolItems[index];
    if (!target) return;
    const realIdx = links.indexOf(target);
    links[realIdx] = { ...links[realIdx], [field]: value };
    setFooter({ ...footer, links });
  };
  const removeSchoolLink = (index: number) => {
    const links = footer.links?.filter((l) => l.column !== "sekolah") || [];
    const schoolItems = schoolLinks.filter((_, i) => i !== index);
    setFooter({ ...footer, links: [...links, ...schoolItems] });
  };

  const toastElement = toast && (
    <div className={`fixed top-6 right-6 z-50 px-6 py-3.5 rounded-2xl shadow-xl text-white font-bold text-sm ${
      toast.type === "success" ? "bg-emerald-600" : "bg-rose-600"
    }`}>
      {toast.type === "success" ? "✅" : "⚠️"} {toast.message}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neutral-400 font-semibold animate-pulse">Memuat CMS Landing Page...</div>
      </div>
    );
  }

  return (
    <div>
      {toastElement}

      <div className="border-b border-neutral-200 mb-6">
        <div className="flex gap-1 -mb-px flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "hero" && renderHeroTab()}
      {activeTab === "features" && renderFeaturesTab()}
      {activeTab === "why" && renderWhyTab()}
      {activeTab === "pricing" && renderPricingTab()}
      {activeTab === "school" && renderSchoolTab()}
      {activeTab === "cta" && renderCTATab()}
      {activeTab === "footer" && renderFooterTab()}
      {activeTab === "chatbot" && renderChatbotTab()}
      {activeTab === "faq" && renderFaqTab()}
      {activeTab === "referral" && renderReferralTab()}
      {activeTab === "legal" && renderLegalTab()}
      {activeTab === "blog" && renderBlogTab()}
    </div>
  );

  function renderHeroTab() {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
              <IconFileText size={20} className="text-primary-600" />
              Hero Section
            </h3>
            <Field label="Badge Text">
              <input type="text" value={hero.heroBadgeText || ""} onChange={(e) => setHero({ ...hero, heroBadgeText: e.target.value })}
                className="input-field" placeholder="✨ Didukung VideaClass" />
            </Field>
            <Field label="Headline">
              <textarea rows={2} value={hero.heroHeadline || ""} onChange={(e) => setHero({ ...hero, heroHeadline: e.target.value })}
                className="input-field" placeholder="Administrasi Guru Lebih Cepat dengan AI" />
            </Field>
            <Field label="Sub-headline">
              <textarea rows={3} value={hero.heroSubheadline || ""} onChange={(e) => setHero({ ...hero, heroSubheadline: e.target.value })}
                className="input-field" placeholder="Deskripsi platform..." />
            </Field>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Stats</h4>
            {(hero.heroStats || []).map((stat, i) => (
              <div key={i} className="flex gap-3 items-start bg-neutral-50 rounded-xl p-3">
                <input type="text" value={stat.number} onChange={(e) => {
                  const stats = [...(hero.heroStats || [])];
                  stats[i] = { ...stats[i], number: e.target.value };
                  setHero({ ...hero, heroStats: stats });
                }} className="input-field w-32" placeholder="50.000+" />
                <input type="text" value={stat.label} onChange={(e) => {
                  const stats = [...(hero.heroStats || [])];
                  stats[i] = { ...stats[i], label: e.target.value };
                  setHero({ ...hero, heroStats: stats });
                }} className="input-field flex-1" placeholder="Guru Aktif" />
                <button onClick={() => setHero({ ...hero, heroStats: hero.heroStats?.filter((_, j) => j !== i) })}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                  <IconTrash size={16} />
                </button>
              </div>
            ))}
            <button onClick={() => setHero({ ...hero, heroStats: [...(hero.heroStats || []), { number: "", label: "" }] })}
              className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-xl transition cursor-pointer">
              + Tambah Stat
            </button>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">SEO</h4>
            <Field label="SEO Title">
              <input type="text" value={hero.seoTitle || ""} onChange={(e) => setHero({ ...hero, seoTitle: e.target.value })}
                className="input-field" placeholder="GuruPRO AI - Platform Administrasi Guru" />
            </Field>
            <Field label="SEO Description">
              <textarea rows={2} value={hero.seoDescription || ""} onChange={(e) => setHero({ ...hero, seoDescription: e.target.value })}
                className="input-field" placeholder="Deskripsi SEO..." />
            </Field>
            <Field label="OG Image">
              <div className="flex items-center gap-3">
                {hero.ogImage ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-neutral-200 flex-shrink-0">
                    <Image src={hero.ogImage as string} alt="OG Preview" fill className="object-cover" />
                    <button onClick={() => setHero({ ...hero, ogImage: null })}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center cursor-pointer hover:bg-rose-600">×</button>
                  </div>
                ) : null}
                <label className="flex-1 cursor-pointer">
                  <div className="input-field flex items-center gap-2 text-neutral-400 hover:text-neutral-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {hero.ogImage ? "Ganti Gambar" : "Pilih Gambar OG"}
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("file", file);
                      try {
                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                        if (res.ok) {
                          const data = await res.json();
                          setHero({ ...hero, ogImage: data.url });
                        }
                      } catch {}
                      e.target.value = "";
                    }} />
                </label>
              </div>
            </Field>
          </div>

          <div className="flex justify-end">
            <button onClick={saveHero} disabled={saving === "hero"}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
              <IconDeviceFloppy size={16} />
              {saving === "hero" ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>

        <div className="xl:col-span-1">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm sticky top-6">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Preview Hero</h4>
            <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-4 text-white">
              {hero.heroBadgeText && (
                <span className="inline-block px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold mb-3">{hero.heroBadgeText}</span>
              )}
              {hero.heroHeadline && (
                <h2 className="text-sm font-black leading-tight mb-2">{hero.heroHeadline}</h2>
              )}
              {hero.heroSubheadline && (
                <p className="text-[10px] text-white/80 leading-relaxed">{hero.heroSubheadline}</p>
              )}
              {(hero.heroStats || []).length > 0 && (
                <div className="flex gap-3 mt-3 pt-3 border-t border-white/20">
                  {hero.heroStats?.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-center flex-1">
                      <div className="text-xs font-black">{s.number || "—"}</div>
                      <div className="text-[8px] text-white/70">{s.label || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderFeaturesTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-neutral-900">Fitur Unggulan</h3>
          <button onClick={() => { setEditFeature({ icon: "IconSparkles", title: "", description: "", order: features.length, isActive: true }); setShowFeatureModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">
            <IconPlus size={16} />
            Tambah Fitur
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Icon</th>
                <th className="px-4 py-3">Judul</th>
                <th className="px-4 py-3">Deskripsi</th>
                <th className="px-4 py-3 text-center w-16">Urutan</th>
                <th className="px-4 py-3 text-center w-20">Aktif</th>
                <th className="px-4 py-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {features.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400 italic">Belum ada fitur. Klik "Tambah Fitur" untuk memulai.</td></tr>
              ) : features.map((feat, idx) => (
                <tr key={feat.id} className="hover:bg-neutral-50/50 group">
                  <td className="px-4 py-3 text-neutral-300">
                    <IconGripVertical size={16} className="cursor-grab" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const IconComp = resolveTablerIcon(feat.icon);
                        return <IconComp size={18} className="text-primary-600" />;
                      })()}
                      <span className="font-mono text-neutral-600">{feat.icon}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-neutral-800">{feat.title}</td>
                  <td className="px-4 py-3 text-neutral-500 max-w-xs truncate">{feat.description}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => moveFeature(idx, -1)} disabled={idx === 0}
                        className="p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-30 cursor-pointer">
                        <IconArrowUp size={14} />
                      </button>
                      <span className="text-xs font-bold text-neutral-700 w-4 text-center">{feat.order}</span>
                      <button onClick={() => moveFeature(idx, 1)} disabled={idx === features.length - 1}
                        className="p-1 text-neutral-400 hover:text-neutral-600 disabled:opacity-30 cursor-pointer">
                        <IconArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleFeature(feat)} className="cursor-pointer">
                      {feat.isActive ? (
                        <IconToggleRight size={22} className="text-emerald-500" />
                      ) : (
                        <IconToggleLeft size={22} className="text-neutral-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditFeature(feat); setShowFeatureModal(true); }}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition cursor-pointer">
                        <IconFileText size={16} />
                      </button>
                      <button onClick={() => deleteFeature(feat.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showFeatureModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-lg mx-4 space-y-4">
              <h3 className="text-sm font-black text-neutral-900">{editFeature?.id ? "Edit Fitur" : "Tambah Fitur Baru"}</h3>
              <Field label="Icon">
                <div className="relative">
                  <button onClick={() => setShowIconPicker(!showIconPicker)}
                    className="input-field flex items-center gap-3 w-full cursor-pointer text-left">
                    {editFeature?.icon ? (() => {
                      const IconComp = resolveTablerIcon(editFeature.icon);
                      return <><IconComp size={24} className="text-primary-600 flex-shrink-0" /><span className="text-neutral-600 text-xs">{editFeature.icon}</span></>;
                    })() : <span className="text-neutral-400 text-xs">Klik untuk pilih icon...</span>}
                    <span className="ml-auto text-neutral-300">▼</span>
                  </button>
                  {showIconPicker && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg p-3 max-h-60 overflow-y-auto grid grid-cols-6 gap-1">
                      {iconList.map((ic) => (
                        <button key={ic.name} onClick={() => { setEditFeature({ ...editFeature, icon: ic.name }); setShowIconPicker(false); }}
                          className={`p-2 rounded-lg hover:bg-primary-50 transition flex items-center justify-center cursor-pointer ${editFeature?.icon === ic.name ? "bg-primary-100 ring-2 ring-primary-300" : ""}`}
                          title={ic.name}>
                          <ic.comp size={20} className="text-neutral-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Judul Fitur">
                <input type="text" value={editFeature?.title || ""} onChange={(e) => setEditFeature({ ...editFeature, title: e.target.value })}
                  className="input-field" placeholder="RPP AI" />
              </Field>
              <Field label="Deskripsi">
                <textarea rows={3} value={editFeature?.description || ""} onChange={(e) => setEditFeature({ ...editFeature, description: e.target.value })}
                  className="input-field" placeholder="Deskripsi fitur..." />
              </Field>
              <Field label="Urutan">
                <input type="number" value={editFeature?.order ?? 0} onChange={(e) => setEditFeature({ ...editFeature, order: parseInt(e.target.value) || 0 })}
                  className="input-field w-24" />
              </Field>
              <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                <input type="checkbox" checked={!!editFeature?.isActive} onChange={(e) => setEditFeature({ ...editFeature, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-neutral-300 text-primary-600" />
                Aktif
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowFeatureModal(false); setEditFeature(null); setShowIconPicker(false); }}
                  className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer">
                  Batal
                </button>
                <button onClick={saveFeature} disabled={saving === "feature"}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer">
                  {saving === "feature" ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderWhyTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-neutral-900">Kenapa GuruPRO</h3>
          <button onClick={addWhyPoint} disabled={saving === "why"}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer">
            <IconPlus size={16} />
            Tambah Point
          </button>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Point</th>
                <th className="px-4 py-3 text-center w-16">Urutan</th>
                <th className="px-4 py-3 text-center w-20">Aktif</th>
                <th className="px-4 py-3 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {whyPoints.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-neutral-400 italic">Belum ada point.</td></tr>
              ) : whyPoints.map((point, idx) => (
                <tr key={point.id} className="hover:bg-neutral-50/50 group">
                  <td className="px-4 py-3">
                    <input type="text" value={point.point} onChange={(e) => {
                      const updated = [...whyPoints];
                      updated[idx] = { ...updated[idx], point: e.target.value };
                      setWhyPoints(updated);
                    }} onBlur={() => saveWhyPoint(point)}
                    className="w-full bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-primary-400 outline-none text-xs font-medium text-neutral-800 py-1 transition" />
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-neutral-600">{point.order}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleWhyPoint(point)} className="cursor-pointer">
                      {point.isActive ? <IconToggleRight size={22} className="text-emerald-500" /> : <IconToggleLeft size={22} className="text-neutral-300" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => deleteWhyPoint(point.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                      <IconTrash size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderPricingTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
            <IconCreditCard size={20} className="text-primary-600" />
            Paket Berlangganan
          </h3>
          <button onClick={() => { setEditPricing({ package_name: "", price: 0, duration_days: 30, tokens: 0, features: [""], is_active: true, popular: false }); setShowPricingModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">
            <IconPlus size={16} />
            Tambah Paket
          </button>
        </div>

          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Nama Paket</th>
                <th className="px-4 py-3 text-right">Harga</th>
                <th className="px-4 py-3 text-center">Durasi</th>
                <th className="px-4 py-3 text-center">Token</th>
                <th className="px-4 py-3 text-center">Popular</th>
                <th className="px-4 py-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {pricingPlans.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-neutral-400 italic">Belum ada paket.</td></tr>
              ) : pricingPlans.map((plan, idx) => (
                <tr key={plan.id} className="hover:bg-neutral-50/50">
                  <td className="px-4 py-3 text-neutral-300">
                    <div className="flex flex-col items-center gap-0.5">
                      <button onClick={async () => {
                        if (idx === 0) return;
                        const updated = [...pricingPlans];
                        [updated[idx], updated[idx - 1]] = [updated[idx - 1], updated[idx]];
                        updated.forEach((p, i) => p.sort_order = i);
                        setPricingPlans(updated);
                        await fetch("/api/admin/pricing", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: plan.id, sort_order: idx - 1 }),
                        });
                        await fetch("/api/admin/pricing", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: updated[idx].id, sort_order: idx }),
                        });
                      }} disabled={idx === 0}
                        className="p-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-20 cursor-pointer disabled:cursor-default">
                        <IconArrowUp size={12} />
                      </button>
                      <button onClick={async () => {
                        if (idx === pricingPlans.length - 1) return;
                        const updated = [...pricingPlans];
                        [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                        updated.forEach((p, i) => p.sort_order = i);
                        setPricingPlans(updated);
                        await fetch("/api/admin/pricing", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: plan.id, sort_order: idx + 1 }),
                        });
                        await fetch("/api/admin/pricing", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: updated[idx].id, sort_order: idx }),
                        });
                      }} disabled={idx === pricingPlans.length - 1}
                        className="p-0.5 text-neutral-400 hover:text-neutral-600 disabled:opacity-20 cursor-pointer disabled:cursor-default">
                        <IconArrowDown size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-neutral-800">
                    {plan.package_name}
                    {plan.popular && <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black rounded-full">POPULER</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">
                    {plan.price === 0 ? "GRATIS" : `Rp ${Number(plan.price).toLocaleString("id-ID")}`}
                  </td>
                  <td className="px-4 py-3 text-center text-neutral-600">{plan.duration_days} hari</td>
                  <td className="px-4 py-3 text-center text-neutral-600">{plan.tokens || 0} Token</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => togglePricingPopular(plan)} className="cursor-pointer mx-auto">
                      {plan.popular ? <IconToggleRight size={22} className="text-emerald-500" /> : <IconToggleLeft size={22} className="text-neutral-300" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditPricing(plan); setShowPricingModal(true); }}
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition cursor-pointer">
                        <IconEdit size={16} />
                      </button>
                      <button onClick={() => deletePricing(plan.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showPricingModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-lg mx-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <h3 className="text-sm font-black text-neutral-900">{editPricing?.id ? "Edit Paket" : "Tambah Paket Baru"}</h3>
              <Field label="Nama Paket">
                <input type="text" value={editPricing?.package_name || ""} onChange={(e) => setEditPricing({ ...editPricing, package_name: e.target.value })}
                  className="input-field" placeholder="3 Bulan" />
              </Field>
              <Field label="Harga (Rp)">
                <input type="number" value={editPricing?.price || 0} onChange={(e) => setEditPricing({ ...editPricing, price: parseInt(e.target.value) || 0 })}
                  className="input-field" placeholder="120000" />
              </Field>
              <Field label="Durasi (hari)">
                <input type="number" value={editPricing?.duration_days || 30} onChange={(e) => setEditPricing({ ...editPricing, duration_days: parseInt(e.target.value) || 30 })}
                  className="input-field" placeholder="90" />
              </Field>
              <Field label="Jumlah Token">
                <input type="number" value={editPricing?.tokens || 0} onChange={(e) => setEditPricing({ ...editPricing, tokens: parseInt(e.target.value) || 0 })}
                  className="input-field" placeholder="500" />
              </Field>
              <Field label="Fitur (satu per baris)">
                <textarea rows={5} value={(editPricing?.features || []).join("\n")} onChange={(e) => setEditPricing({ ...editPricing, features: e.target.value.split("\n").filter(f => f.trim()) })}
                  className="input-field" placeholder="Fitur 1&#10;Fitur 2&#10;Fitur 3" />
              </Field>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <input type="checkbox" checked={!!editPricing?.popular} onChange={(e) => setEditPricing({ ...editPricing, popular: e.target.checked })}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-600" />
                  Tandai sebagai Populer
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                  <input type="checkbox" checked={editPricing?.is_active !== false} onChange={(e) => setEditPricing({ ...editPricing, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-neutral-300 text-primary-600" />
                  Aktif
                </label>
              </div>
              <Field label="Urutan (sort_order)">
                <input type="number" value={editPricing?.sort_order ?? 0} onChange={(e) => setEditPricing({ ...editPricing, sort_order: parseInt(e.target.value) || 0 })}
                  className="input-field w-24" placeholder="0" />
              </Field>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowPricingModal(false); setEditPricing(null); }}
                  className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer">
                  Batal
                </button>
                <button onClick={savePricing} disabled={saving === "pricing"}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer">
                  {saving === "pricing" ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderSchoolTab() {
    return (
      <div className="space-y-6">
        <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
          <IconSchool size={20} className="text-primary-600" />
          Untuk Sekolah — Tautan Footer
        </h3>
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
          {schoolLinks.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 italic text-xs">Belum ada tautan.</div>
          ) : schoolLinks.map((link, idx) => (
            <div key={idx} className="flex gap-3 items-center bg-neutral-50 rounded-xl p-3">
              <input type="text" value={link.label} onChange={(e) => updateSchoolLink(idx, "label", e.target.value)}
                className="input-field flex-1" placeholder="Label" />
              <input type="text" value={link.url} onChange={(e) => updateSchoolLink(idx, "url", e.target.value)}
                className="input-field flex-[2]" placeholder="URL" />
              <button onClick={() => removeSchoolLink(idx)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          <button onClick={addSchoolLink}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-xl transition cursor-pointer">
            + Tambah Tautan
          </button>
          <div className="flex justify-end pt-4 border-t border-neutral-100">
            <button onClick={saveFooter} disabled={saving === "footer"}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
              <IconDeviceFloppy size={16} />
              {saving === "footer" ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderCTATab() {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
              <IconPointer size={20} className="text-primary-600" />
              CTA Buttons
            </h3>
            <div className="bg-neutral-50 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Primary CTA</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Label">
                  <input type="text" value={hero.heroCTAPrimary?.label || ""} onChange={(e) => setHero({ ...hero, heroCTAPrimary: { ...hero.heroCTAPrimary, label: e.target.value } })}
                    className="input-field" placeholder="Mulai Gratis Sekarang" />
                </Field>
                <Field label="URL">
                  <input type="text" value={hero.heroCTAPrimary?.url || ""} onChange={(e) => setHero({ ...hero, heroCTAPrimary: { ...hero.heroCTAPrimary, url: e.target.value } })}
                    className="input-field" placeholder="/login?mode=register" />
                </Field>
              </div>
            </div>
            <div className="bg-neutral-50 rounded-xl p-4 space-y-4">
              <h4 className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Secondary CTA</h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Label">
                  <input type="text" value={hero.heroCTASecondary?.label || ""} onChange={(e) => setHero({ ...hero, heroCTASecondary: { ...hero.heroCTASecondary, label: e.target.value } })}
                    className="input-field" placeholder="Lihat Demo" />
                </Field>
                <Field label="URL">
                  <input type="text" value={hero.heroCTASecondary?.url || ""} onChange={(e) => setHero({ ...hero, heroCTASecondary: { ...hero.heroCTASecondary, url: e.target.value } })}
                    className="input-field" placeholder="#demo" />
                </Field>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={saveHero} disabled={saving === "hero"}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
              <IconDeviceFloppy size={16} />
              {saving === "hero" ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
        <div className="xl:col-span-1">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm sticky top-6">
            <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Preview CTA</h4>
            <div className="space-y-3">
              {hero.heroCTAPrimary?.label && (
                <div className="bg-primary-600 text-white text-center py-3 px-4 rounded-xl text-sm font-bold">{hero.heroCTAPrimary.label}</div>
              )}
              {hero.heroCTASecondary?.label && (
                <div className="border-2 border-primary-600 text-primary-700 text-center py-3 px-4 rounded-xl text-sm font-bold">{hero.heroCTASecondary.label}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderFooterTab() {
    const footerLinks = footer.links?.filter((l) => l.column === "links") || [];
    const addNavLink = () => {
      setFooter({ ...footer, links: [...(footer.links || []), { label: "", url: "", column: "links" as const }] });
    };
    const updateNavLink = (idx: number, field: "label" | "url", value: string) => {
      const links = [...(footer.links || [])];
      const navLinks = links.filter((l) => l.column === "links");
      const target = navLinks[idx];
      if (!target) return;
      const realIdx = links.indexOf(target);
      links[realIdx] = { ...links[realIdx], [field]: value };
      setFooter({ ...footer, links });
    };
    const removeNavLink = (idx: number) => {
      const links = footer.links?.filter((l) => l.column !== "links") || [];
      const navItems = footerLinks.filter((_, i) => i !== idx);
      setFooter({ ...footer, links: [...links, ...navItems] });
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
            <IconLayoutBottombar size={20} className="text-primary-600" />
            Footer Content
          </h3>
          <Field label="Deskripsi Footer">
            <textarea rows={3} value={footer.description || ""} onChange={(e) => setFooter({ ...footer, description: e.target.value })}
              className="input-field" placeholder="Deskripsi..." />
          </Field>
          <Field label="Email Kontak">
            <input type="text" value={footer.contactEmail || ""} onChange={(e) => setFooter({ ...footer, contactEmail: e.target.value })}
              className="input-field" placeholder="support@gurupro.id" />
          </Field>
          <Field label="WhatsApp CS">
            <input type="text" value={footer.contactWhatsapp || ""} onChange={(e) => setFooter({ ...footer, contactWhatsapp: e.target.value })}
              className="input-field" placeholder="+62 812-8396-0337" />
          </Field>
          <Field label="Copyright Text">
            <input type="text" value={footer.copyrightText || ""} onChange={(e) => setFooter({ ...footer, copyrightText: e.target.value })}
              className="input-field" placeholder="GuruPRO AI © 2026" />
          </Field>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Navigasi Links</h4>
          {footerLinks.length === 0 ? (
            <div className="text-center py-4 text-neutral-400 italic text-xs">Belum ada link navigasi.</div>
          ) : footerLinks.map((link, idx) => (
            <div key={idx} className="flex gap-3 items-center bg-neutral-50 rounded-xl p-3">
              <input type="text" value={link.label} onChange={(e) => updateNavLink(idx, "label", e.target.value)}
                className="input-field flex-1" placeholder="Label" />
              <input type="text" value={link.url} onChange={(e) => updateNavLink(idx, "url", e.target.value)}
                className="input-field flex-[2]" placeholder="URL" />
              <button onClick={() => removeNavLink(idx)}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          <button onClick={addNavLink}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-xl transition cursor-pointer">
            + Tambah Link
          </button>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Social Media</h4>
          {(footer.socialLinks || []).map((social, idx) => (
            <div key={idx} className="flex gap-3 items-center bg-neutral-50 rounded-xl p-3">
              <select value={social.platform} onChange={(e) => {
                const links = [...(footer.socialLinks || [])];
                links[idx] = { ...links[idx], platform: e.target.value };
                setFooter({ ...footer, socialLinks: links });
              }} className="input-field w-36">
                {["facebook", "instagram", "youtube", "tiktok", "linkedin"].map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
              <input type="text" value={social.url} onChange={(e) => {
                const links = [...(footer.socialLinks || [])];
                links[idx] = { ...links[idx], url: e.target.value };
                setFooter({ ...footer, socialLinks: links });
              }} className="input-field flex-1" placeholder="URL" />
              <button onClick={() => setFooter({ ...footer, socialLinks: footer.socialLinks?.filter((_, j) => j !== idx) })}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          <button onClick={() => setFooter({ ...footer, socialLinks: [...(footer.socialLinks || []), { platform: "facebook", url: "" }] })}
            className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-4 py-2 rounded-xl transition cursor-pointer">
            + Tambah Social Media
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={saveFooter} disabled={saving === "footer"}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
            <IconDeviceFloppy size={16} />
            {saving === "footer" ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    );
  }

  function renderFaqTab() {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
            <IconQuestionMark size={20} className="text-primary-600" />
            Pertanyaan yang Sering Diajukan (FAQ)
          </h3>
          <button onClick={() => setFaqItems([...faqItems, { question: "", answer: "" }])}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">
            <IconPlus size={16} />
            Tambah FAQ
          </button>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
          {faqItems.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 italic text-xs">Belum ada FAQ.</div>
          ) : faqItems.map((item, idx) => (
            <div key={idx} className="bg-neutral-50 rounded-xl p-4 space-y-3 border border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">#{idx + 1}</span>
                <button onClick={() => setFaqItems(faqItems.filter((_, i) => i !== idx))}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                  <IconTrash size={14} />
                </button>
              </div>
              <Field label="Pertanyaan">
                <input type="text" value={item.question}
                  onChange={(e) => {
                    const updated = [...faqItems];
                    updated[idx] = { ...updated[idx], question: e.target.value };
                    setFaqItems(updated);
                  }}
                  className="input-field" placeholder="Tulis pertanyaan..." />
              </Field>
              <Field label="Jawaban">
                <textarea rows={3} value={item.answer}
                  onChange={(e) => {
                    const updated = [...faqItems];
                    updated[idx] = { ...updated[idx], answer: e.target.value };
                    setFaqItems(updated);
                  }}
                  className="input-field" placeholder="Tulis jawaban..." />
              </Field>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={saveFaq} disabled={saving === "faq"}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
            <IconDeviceFloppy size={16} />
            {saving === "faq" ? "Menyimpan..." : "Simpan FAQ"}
          </button>
        </div>
      </div>
    );
  }

  function renderReferralTab() {
    return (
      <div className="space-y-6">
        <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
          <IconGift size={20} className="text-primary-600" />
          Program Kemitraan Guru (Referral)
        </h3>
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
          <Field label="Badge">
            <input type="text" value={referral.badge}
              onChange={(e) => setReferral({ ...referral, badge: e.target.value })}
              className="input-field" placeholder="🎁 Program Kemitraan Guru" />
          </Field>
          <Field label="Judul">
            <input type="text" value={referral.title}
              onChange={(e) => setReferral({ ...referral, title: e.target.value })}
              className="input-field" placeholder="Bagikan GuruPro, Dapatkan Cashback &amp; Token!" />
          </Field>
          <Field label="Deskripsi">
            <textarea rows={3} value={referral.description}
              onChange={(e) => setReferral({ ...referral, description: e.target.value })}
              className="input-field" placeholder="Deskripsi program referral..." />
          </Field>
          <Field label="CTA Text">
            <input type="text" value={referral.ctaText}
              onChange={(e) => setReferral({ ...referral, ctaText: e.target.value })}
              className="input-field" placeholder="Mulai Undang Teman" />
          </Field>
          <Field label="CTA Link (opsional, kosongkan untuk default)">
            <input type="text" value={referral.ctaLink}
              onChange={(e) => setReferral({ ...referral, ctaLink: e.target.value })}
              className="input-field" placeholder="/dashboard (default)" />
          </Field>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Benefit Cards</h4>
            <button onClick={() => setReferral({ ...referral, benefits: [...referral.benefits, { icon: "", title: "", description: "" }] })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 hover:bg-primary-100 text-primary-600 text-[10px] font-bold rounded-xl transition cursor-pointer">
              <IconPlus size={14} />
              Tambah Benefit
            </button>
          </div>
          {referral.benefits.length === 0 ? (
            <div className="text-center py-4 text-neutral-400 italic text-xs">Belum ada benefit card.</div>
          ) : referral.benefits.map((benefit, idx) => (
            <div key={idx} className="bg-neutral-50 rounded-xl p-4 space-y-3 border border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Benefit #{idx + 1}</span>
                <button onClick={() => setReferral({ ...referral, benefits: referral.benefits.filter((_, i) => i !== idx) })}
                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                  <IconTrash size={14} />
                </button>
              </div>
              <Field label="Icon (emoji)">
                <div className="flex items-center gap-3">
                  {benefit.icon ? <span className="text-2xl w-8 text-center flex-shrink-0">{benefit.icon}</span> : null}
                  <input type="text" value={benefit.icon}
                    onChange={(e) => {
                      const updated = [...referral.benefits];
                      updated[idx] = { ...updated[idx], icon: e.target.value };
                      setReferral({ ...referral, benefits: updated });
                    }}
                    className="input-field w-20" placeholder="💰" />
                </div>
              </Field>
              <Field label="Judul">
                <input type="text" value={benefit.title}
                  onChange={(e) => {
                    const updated = [...referral.benefits];
                    updated[idx] = { ...updated[idx], title: e.target.value };
                    setReferral({ ...referral, benefits: updated });
                  }}
                  className="input-field" placeholder="Cashback Saldo Dompet" />
              </Field>
              <Field label="Deskripsi">
                <textarea rows={2} value={benefit.description}
                  onChange={(e) => {
                    const updated = [...referral.benefits];
                    updated[idx] = { ...updated[idx], description: e.target.value };
                    setReferral({ ...referral, benefits: updated });
                  }}
                  className="input-field" placeholder="Deskripsi benefit..." />
              </Field>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={saveReferral} disabled={saving === "referral"}
            className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
            <IconDeviceFloppy size={16} />
            {saving === "referral" ? "Menyimpan..." : "Simpan Referral"}
          </button>
        </div>
      </div>
    );
  }

  function renderLegalTab() {
    const legalKeys = [
      { key: "privacy_policy", label: "Kebijakan Privasi", icon: IconShield },
      { key: "terms_conditions", label: "Syarat & Ketentuan", icon: IconFileText },
      { key: "refund_policy", label: "Kebijakan Refund", icon: IconWallet },
    ];
    return (
      <div className="space-y-6">
        <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
          <IconFileText size={20} className="text-primary-600" />
          Halaman Legal
        </h3>
        {legalKeys.map(({ key, label, icon: Icon }) => {
          const page = legalPages[key] || { title: "", content: "", last_updated: "" };
          return (
            <div key={key} className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-2">
                  <Icon size={16} className="text-primary-600" />
                  {label}
                </h4>
                {page.last_updated && (
                  <span className="text-[10px] text-neutral-400">Diperbarui: {page.last_updated}</span>
                )}
              </div>
              <Field label="Judul Halaman">
                <input type="text" value={page.title} onChange={(e) => setLegalPages({ ...legalPages, [key]: { ...page, title: e.target.value } })}
                  className="input-field" placeholder={label} />
              </Field>
              <Field label="Konten (HTML)">
                <textarea rows={12} value={page.content} onChange={(e) => setLegalPages({ ...legalPages, [key]: { ...page, content: e.target.value } })}
                  className="input-field font-mono text-[11px]" placeholder="<h2>Judul Bagian</h2><p>Isi konten...</p>" />
              </Field>
              <div className="flex justify-end">
                <button onClick={() => saveLegalPage(key)} disabled={saving === "legal"}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
                  <IconDeviceFloppy size={14} />
                  {saving === "legal" ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderChatbotTab() {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
              <IconRobot size={20} className="text-primary-600" />
              Konfigurasi Chatbot
            </h3>
            <Field label="System Prompt AI">
              <textarea rows={8} value={chatbot.systemPrompt || ""} onChange={(e) => setChatbot({ ...chatbot, systemPrompt: e.target.value })}
                className="input-field font-mono text-[11px]" placeholder="Kamu adalah CS assistant GuruPRO AI..." />
            </Field>
            <Field label="Welcome Message">
              <textarea rows={3} value={chatbot.welcomeMessage || ""} onChange={(e) => setChatbot({ ...chatbot, welcomeMessage: e.target.value })}
                className="input-field" placeholder="Halo! Saya asisten AI GuruPRO..." />
            </Field>
            <label className="flex items-center gap-2 text-xs font-semibold text-neutral-700">
              <input type="checkbox" checked={!!chatbot.isEnabled} onChange={(e) => setChatbot({ ...chatbot, isEnabled: e.target.checked })}
                className="w-4 h-4 rounded border-neutral-300 text-primary-600" />
              Aktifkan Chatbot
            </label>
            <Field label="WhatsApp Link CS Manusia">
              <input type="text" value={chatbot.humanCSUrl || ""} onChange={(e) => setChatbot({ ...chatbot, humanCSUrl: e.target.value })}
                className="input-field" placeholder="https://wa.me/6281283960337" />
            </Field>
          </div>
          <div className="flex justify-between items-center">
            <button onClick={() => setTestChatOpen(!testChatOpen)}
              className="px-4 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-bold rounded-xl transition cursor-pointer">
              {testChatOpen ? "Tutup Test Chatbot" : "Test Chatbot ▶"}
            </button>
            <button onClick={saveChatbot} disabled={saving === "chatbot"}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-primary-100 transition disabled:opacity-50 cursor-pointer flex items-center gap-2">
              <IconDeviceFloppy size={16} />
              {saving === "chatbot" ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
        {testChatOpen && (
          <div className="xl:col-span-1">
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm flex flex-col h-[500px] sticky top-6">
              <div className="p-3 border-b border-neutral-100 flex items-center gap-2">
                <IconRobot size={18} className="text-primary-600" />
                <span className="text-xs font-bold text-neutral-700">Test Chatbot</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-center text-neutral-400 text-xs italic py-8">Mulai percakapan dengan chatbot...</div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] px-3 py-2 rounded-xl text-xs ${
                      msg.role === "user"
                        ? "bg-primary-600 text-white rounded-br-sm"
                        : "bg-neutral-100 text-neutral-700 rounded-bl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-neutral-100 flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && chatInput.trim()) {
                      setChatMessages([...chatMessages, { role: "user", content: chatInput }, { role: "assistant", content: "✅ Chatbot terintegrasi. Pesan akan diproses oleh sistem AI saat chatbot aktif." }]);
                      setChatInput("");
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-neutral-200 rounded-xl text-xs outline-none bg-white font-medium" placeholder="Ketik pesan..." />
                <button onClick={() => {
                  if (chatInput.trim()) {
                    setChatMessages([...chatMessages, { role: "user", content: chatInput }, { role: "assistant", content: "✅ Chatbot terintegrasi. Pesan akan diproses oleh sistem AI saat chatbot aktif." }]);
                    setChatInput("");
                  }
                }} className="px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">
                  Kirim
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderBlogTab() {
    const published = blogPosts.filter((p) => p.status === "published");
    const drafts = blogPosts.filter((p) => p.status === "draft" || !p.status);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-neutral-900 flex items-center gap-2">
            <IconNews size={20} className="text-primary-600" />
            Manajemen Blog
          </h3>
          <div className="flex gap-2">
            <button onClick={() => { setEditCategory({ title: "", slug: "", description: "", color: "#4f46e5" }); setShowCategoryModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 border border-neutral-200 hover:bg-neutral-50 text-neutral-600 text-xs font-bold rounded-xl transition cursor-pointer">
              <IconPlus size={16} />
              Kategori
            </button>
            <button onClick={() => { setEditPost({ title: "", slug: "", excerpt: "", content: "", author: "Admin", status: "draft", category_id: null }); setShowPostModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition cursor-pointer">
              <IconPlus size={16} />
              Buat Artikel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Total Artikel</span>
            <p className="text-2xl font-black text-neutral-900 mt-1">{blogPosts.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Publikasi</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{published.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Konsep</span>
            <p className="text-2xl font-black text-amber-600 mt-1">{drafts.length}</p>
          </div>
          <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Kategori</span>
            <p className="text-2xl font-black text-primary-600 mt-1">{blogCategories.length}</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
          {blogLoading ? (
            <div className="text-center py-12 text-neutral-400 font-semibold text-xs">Memuat artikel...</div>
          ) : blogPosts.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 italic text-xs">
              Belum ada artikel. Klik tombol "Buat Artikel" di atas.
            </div>
          ) : (
            <table className="w-full text-xs text-left">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Penulis</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {blogPosts.map((post: any) => (
                  <tr key={post.id} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-bold text-neutral-800 max-w-xs truncate">{post.title}</td>
                    <td className="px-4 py-3 text-neutral-500">
                      {post.category_title || "-"}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">{post.author || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => togglePostStatus(post)} className="cursor-pointer">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase cursor-pointer transition ${
                          post.status === "published"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                        }`}>
                          {post.status === "published" ? "Published" : "Draft"}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-[10px]">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditPost(post); setShowPostModal(true); }}
                          className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition cursor-pointer">
                          <IconEdit size={16} />
                        </button>
                        <button onClick={() => deletePost(post.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-neutral-700 uppercase tracking-wider">Kategori</h4>
            <button onClick={() => { setEditCategory({ title: "", slug: "", description: "", color: "#4f46e5" }); setShowCategoryModal(true); }}
              className="text-[10px] font-bold text-primary-600 hover:text-primary-700 cursor-pointer">
              + Tambah
            </button>
          </div>
          {blogCategories.length === 0 ? (
            <p className="text-xs text-neutral-400 italic">Belum ada kategori.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blogCategories.map((cat: any) => (
                <span key={cat.id} className="inline-flex items-center gap-2 px-3 py-1.5 border border-neutral-200 rounded-xl text-[10px] font-bold">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || "#4f46e5" }}></span>
                  {cat.title}
                  <span className="text-neutral-400">({cat.post_count || 0})</span>
                  <button onClick={() => { setEditCategory(cat); setShowCategoryModal(true); }} className="text-neutral-400 hover:text-primary-600 ml-1 cursor-pointer">
                    <IconEdit size={12} />
                  </button>
                  <button onClick={() => deleteCategory(cat.id)} className="text-neutral-400 hover:text-rose-500 cursor-pointer">
                    <IconTrash size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Post Modal */}
        {showPostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-2xl mx-4 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-sm font-black text-neutral-900">{editPost?.id ? "Edit Artikel" : "Buat Artikel Baru"}</h3>
              <Field label="Judul">
                <input type="text" value={editPost?.title || ""} onChange={(e) => setEditPost({ ...editPost, title: e.target.value })}
                  className="input-field" placeholder="Judul artikel..." />
              </Field>
              <Field label="Slug">
                <input type="text" value={editPost?.slug || ""} onChange={(e) => setEditPost({ ...editPost, slug: e.target.value })}
                  className="input-field" placeholder="slug-artikel (kosongkan untuk generate otomatis)" />
              </Field>
              <Field label="Kategori">
                <select value={editPost?.category_id || ""} onChange={(e) => setEditPost({ ...editPost, category_id: e.target.value ? parseInt(e.target.value) : null })}
                  className="input-field">
                  <option value="">Pilih Kategori</option>
                  {blogCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.title}</option>
                  ))}
                </select>
              </Field>
              <Field label="Excerpt / Ringkasan">
                <textarea rows={2} value={editPost?.excerpt || ""} onChange={(e) => setEditPost({ ...editPost, excerpt: e.target.value })}
                  className="input-field" placeholder="Ringkasan artikel..." />
              </Field>
              <Field label="Konten (HTML)">
                <textarea rows={8} value={editPost?.content || ""} onChange={(e) => setEditPost({ ...editPost, content: e.target.value })}
                  className="input-field font-mono text-[11px]" placeholder="<p>Konten artikel...</p>" />
              </Field>
              <div className="flex items-center gap-4">
                <Field label="Penulis">
                  <input type="text" value={editPost?.author || "Admin"} onChange={(e) => setEditPost({ ...editPost, author: e.target.value })}
                    className="input-field" placeholder="Nama Penulis" />
                </Field>
                <div className="flex items-center gap-2 pt-5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-neutral-600">
                    <input type="checkbox" checked={editPost?.status === "published"} onChange={(e) => setEditPost({ ...editPost, status: e.target.checked ? "published" : "draft" })}
                      className="w-4 h-4 rounded border-neutral-300 text-primary-600" />
                    Publikasi
                  </label>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowPostModal(false); setEditPost(null); }}
                  className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer">
                  Batal
                </button>
                <button onClick={savePost} disabled={saving === "post"}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer">
                  {saving === "post" ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-2xl shadow-modal p-6 w-full max-w-md mx-4 space-y-4">
              <h3 className="text-sm font-black text-neutral-900">{editCategory?.id ? "Edit Kategori" : "Tambah Kategori"}</h3>
              <Field label="Nama Kategori">
                <input type="text" value={editCategory?.title || ""} onChange={(e) => setEditCategory({ ...editCategory, title: e.target.value })}
                  className="input-field" placeholder="Nama kategori..." />
              </Field>
              <Field label="Slug">
                <input type="text" value={editCategory?.slug || ""} onChange={(e) => setEditCategory({ ...editCategory, slug: e.target.value })}
                  className="input-field" placeholder="slug-kategori" />
              </Field>
              <Field label="Deskripsi">
                <textarea rows={2} value={editCategory?.description || ""} onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                  className="input-field" placeholder="Deskripsi kategori..." />
              </Field>
              <Field label="Warna">
                <div className="flex items-center gap-3">
                  <input type="color" value={editCategory?.color || "#4f46e5"} onChange={(e) => setEditCategory({ ...editCategory, color: e.target.value })}
                    className="w-10 h-10 rounded border border-neutral-200 cursor-pointer" />
                  <input type="text" value={editCategory?.color || "#4f46e5"} onChange={(e) => setEditCategory({ ...editCategory, color: e.target.value })}
                    className="input-field flex-1" placeholder="#4f46e5" />
                </div>
              </Field>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowCategoryModal(false); setEditCategory(null); }}
                  className="px-4 py-2 border border-neutral-200 rounded-xl text-xs font-bold text-neutral-600 hover:bg-neutral-50 transition cursor-pointer">
                  Batal
                </button>
                <button onClick={saveCategory} disabled={saving === "category"}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer">
                  {saving === "category" ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
