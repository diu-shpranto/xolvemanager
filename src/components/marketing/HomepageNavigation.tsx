'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { productBrand } from '../../config/brand';

const navigationItems = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Privacy & Data', href: '/legal/privacy' },
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
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
              className="absolute right-0 top-12 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col gap-1 rounded-2xl border border-violet-100 bg-white p-3 shadow-xl shadow-violet-950/10"
            >
              {navigationItems.map(item => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={closeMenu}
                  className="rounded-xl px-3 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-2 focus-visible:outline-violet-600"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-1 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 focus-visible:outline-2 focus-visible:outline-violet-600"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMenu}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-700 px-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-violet-600"
                >
                  Get started
                </Link>
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
