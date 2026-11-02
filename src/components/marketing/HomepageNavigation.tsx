'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpenText,
  ChevronRight,
  CircleHelp,
  Menu,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react';
import { productBrand } from '../../config/brand';

const navigationItems = [
  { label: 'Features', href: '#features', icon: Sparkles },
  { label: 'How it works', href: '#how-it-works', icon: Workflow },
  { label: 'FAQ', href: '#faq', icon: CircleHelp },
  { label: 'Privacy & Data', href: '/legal/privacy', icon: ShieldCheck },
];

export function HomepageNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutsideClick);
    };
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-8">
        <Link
          href="/"
          aria-label="XolveManager home"
          className="inline-flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600"
          onClick={closeMenu}
        >
          <Image
            src={productBrand.wordmarkLightUrl}
            alt=""
            width={1080}
            height={200}
            priority
            className="h-auto w-[142px] sm:w-[164px]"
          />
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-6 lg:flex">
          {navigationItems.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md text-sm font-semibold text-slate-600 transition-colors hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-bold text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-violet-700 px-4 text-sm font-bold text-white shadow-sm shadow-violet-900/15 transition hover:-translate-y-0.5 hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
          >
            Get started free
          </Link>
        </div>

        <div ref={menuRef} className="relative lg:hidden">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-sm shadow-slate-900/5 transition duration-200 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isOpen}
            aria-controls="mobile-home-navigation"
            onClick={() => setIsOpen(value => !value)}
          >
            {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
          {isOpen && (
            <nav
              id="mobile-home-navigation"
              aria-label="Mobile navigation"
              className="absolute right-0 top-12 z-50 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-[1.35rem] border border-white/90 bg-white/95 p-2.5 shadow-2xl shadow-slate-950/15 ring-1 ring-violet-950/5 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between px-3 pb-2 pt-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Explore</p>
                <BookOpenText aria-hidden="true" className="h-4 w-4 text-violet-500" />
              </div>
              <nav className="flex flex-col gap-0.5" aria-label="Explore">
                {navigationItems.map(({ label, href, icon: Icon }) => (
                  <a
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-700 transition duration-150 hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-violet-600"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-500 transition-colors group-hover:bg-white group-hover:text-violet-700">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="flex-1">{label}</span>
                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-violet-500" />
                  </a>
                ))}
              </nav>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 px-1 pt-3">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm shadow-slate-900/5 transition-colors hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-2 focus-visible:outline-violet-600"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMenu}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-700 to-violet-800 px-3 text-sm font-bold text-white shadow-md shadow-violet-900/20 transition duration-200 hover:-translate-y-0.5 hover:from-violet-600 hover:to-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                >
                  Get started
                </Link>
              </div>
            </nav>
          )}
        </div>
      </div>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-violet-600"
      />
    </header>
  );
}
