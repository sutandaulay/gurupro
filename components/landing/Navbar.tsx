"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { IconSparklesFilled, IconMenu2, IconX } from "@tabler/icons-react";
import ThemeToggle from "@/components/ThemeToggle";

export interface NavItem {
  label: string; // CMS: navbar item label
  href: string; // CMS: navbar item href
}

export interface NavbarProps {
  navItems: NavItem[];
  isLoggedIn?: boolean;
  refCode?: string | null;
  brandingConfig?: {
    app_name: string;
    app_logo?: string;
  };
}

export default function Navbar({
  navItems,
  isLoggedIn = false,
  refCode = null,
  brandingConfig,
}: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const appName = brandingConfig?.app_name || "GuruPRO"; // CMS: app name

  const loginHref = refCode ? `/login?ref=${refCode}` : "/login";
  const registerHref = refCode
    ? `/register?ref=${refCode}`
    : "/register";

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-neutral-200/80 z-40">
      <div className="container-page h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group shrink-0">
          {brandingConfig?.app_logo ? ( // CMS: app logo
            <Image
              src={brandingConfig.app_logo}
              alt={appName}
              width={36}
              height={36}
              className="object-contain"
            />
          ) : (
            <span className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-primary-200 group-hover:shadow-lg group-hover:shadow-primary-300 transition-shadow">
              <IconSparklesFilled size={20} />
            </span>
          )}
          <span className="text-2xl font-black tracking-tight text-primary-600">
            {appName}
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item, idx) => (
            <a
              key={idx}
              href={item.href}
              className="text-sm font-semibold text-neutral-600 hover:text-primary-600 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle variant="icon" />
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-2xl shadow-sm shadow-primary-100 transition"
            >
              Buka Dashboard {/* CMS: logged in CTA */}
            </Link>
          ) : (
            <>
              <Link
                href={loginHref}
                className="px-4 py-2.5 text-sm font-bold text-neutral-700 hover:text-primary-600 transition"
              >
                Masuk {/* CMS: login link text */}
              </Link>
              <Link
                href={registerHref}
                className="px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm rounded-2xl shadow-sm shadow-primary-100 transition"
              >
                Coba Gratis {/* CMS: CTA button text */}
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="md:hidden p-2 text-neutral-700 hover:text-primary-600 transition"
          aria-label={isOpen ? "Tutup menu" : "Buka menu"}
        >
          {isOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
        </button>
      </div>

      {/* Mobile Slide Drawer */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-10 md:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-0 right-0 h-full w-72 max-w-[80vw] bg-white shadow-2xl z-20 md:hidden flex flex-col animate-slide-in">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b border-neutral-100">
              <span className="font-bold text-lg text-primary-600">
                {appName}
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-neutral-500 hover:text-primary-600 rounded-lg transition"
              >
                <IconX size={20} />
              </button>
            </div>

            {/* Drawer Nav Links */}
            <nav className="flex-1 py-4 overflow-y-auto">
              {navItems.map((item, idx) => (
                <a
                  key={idx}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-6 py-3 text-sm font-semibold text-neutral-700 hover:text-primary-600 hover:bg-primary-50 transition"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            {/* Drawer CTA */}
            <div className="p-6 border-t border-neutral-100 space-y-3">
              <ThemeToggle variant="segmented" className="w-full justify-center" />
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white text-center font-bold text-sm rounded-2xl transition"
                >
                  Buka Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href={loginHref}
                    onClick={() => setIsOpen(false)}
                    className="block w-full py-3 text-center font-bold text-sm text-neutral-700 border border-neutral-200 hover:border-primary-200 hover:text-primary-600 rounded-2xl transition"
                  >
                    Masuk
                  </Link>
                  <Link
                    href={registerHref}
                    onClick={() => setIsOpen(false)}
                    className="block w-full py-3 bg-primary-600 hover:bg-primary-700 text-white text-center font-bold text-sm rounded-2xl shadow-sm transition"
                  >
                    Coba Gratis
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
