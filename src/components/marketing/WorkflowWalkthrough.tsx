'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from '../../../app/homepage.module.css';
import type { LandingLanguage } from './landingLanguage';

type WalkthroughStep = {
  number: string;
  title: string;
  description: string;
  screenshot: {
    src: string;
    alt: string;
    caption: string;
    width: number;
  };
  relatedScreenshot?: {
    src: string;
    alt: string;
    caption: string;
    width: number;
  };
};

function getSteps(language: LandingLanguage): WalkthroughStep[] {
  const bn = language === 'bn';
  return [
    {
      number: '01',
      title: bn ? 'কাস্টমার যোগ করুন' : 'Add Customers',
      description: bn
        ? 'কাস্টমারের নাম, ফোন নম্বর লিখে রাখুন — পরে তার সব হিসাব এক জায়গায় দেখতে পারবেন।'
        : 'Store customer details and return to customer records to review related activity.',
      screenshot: {
        src: '/images/xolvemanager-walkthrough-customers.png',
        alt: bn
          ? 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল কাস্টমার পাতা — কাস্টমারের সারাংশ, মোট হিসাব আর খোঁজার জায়গা।'
          : 'Actual XolveManager customer module with sample data, showing customer summary, activity totals, and record search.',
        caption: bn ? 'কাস্টমারের হিসাব' : 'Customer records',
        width: 615,
      },
    },
    {
      number: '02',
      title: bn ? 'সার্ভিস আর প্ল্যান বানান' : 'Create Services & Plans',
      description: bn
        ? 'আপনি যা বিক্রি করেন — সার্ভিস আর তার প্ল্যান, দাম আর মেয়াদ লিখে সাজিয়ে রাখুন।'
        : 'Set up services and plans with the prices, durations, and availability you offer.',
      screenshot: {
        src: '/images/xolvemanager-walkthrough-services.png',
        alt: bn
          ? 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল সার্ভিসের তালিকা — সার্ভিস আর চালু প্ল্যানের সারাংশ।'
          : 'Actual XolveManager service catalog with sample data, showing service and active-plan summaries.',
        caption: bn ? 'সার্ভিসের তালিকা' : 'Service catalog',
        width: 615,
      },
      relatedScreenshot: {
        src: '/images/xolvemanager-walkthrough-service-setup.png',
        alt: bn
          ? 'আসল সার্ভিস যোগ করার ফর্ম — প্ল্যানের নাম, দাম, মুদ্রা, মেয়াদ আর মেয়াদের একক লেখার জায়গা।'
          : 'Actual Add Service plan form showing plan name, price, currency, duration, and duration unit fields.',
        caption: bn ? 'প্ল্যান বানানো' : 'Plan setup',
        width: 855,
      },
    },
    {
      number: '03',
      title: bn ? 'বিক্রি আর ইনভয়েস লিখুন' : 'Manage Sales & Invoices',
      description: bn
        ? 'বিক্রি হলে লিখে রাখুন, ইনভয়েস বানান, আর কে কত টাকা দিয়েছে দেখে নিন।'
        : 'Record a sale, create its invoice, and review payment progress.',
      screenshot: {
        src: '/images/xolvemanager-walkthrough-sales.png',
        alt: bn
          ? 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল বিক্রির পাতা — মোট বিক্রি, পেমেন্টের অবস্থা আর নতুন বিক্রির বোতাম।'
          : 'Actual XolveManager Sales module with sample data, showing sale totals, payment status summaries, and the New Sale action.',
        caption: bn ? 'বিক্রি' : 'Sales',
        width: 615,
      },
      relatedScreenshot: {
        src: '/images/xolvemanager-walkthrough-invoices.png',
        alt: bn
          ? 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল ইনভয়েস আর রসিদের পাতা — বিল, পাওয়া টাকা আর বাকি টাকা।'
          : 'Actual XolveManager Invoices and receipts module with sample data, showing billed, collected, and outstanding amounts.',
        caption: bn ? 'ইনভয়েস' : 'Invoices',
        width: 615,
      },
    },
    {
      number: '04',
      title: bn ? 'টাকা আর রিপোর্ট দেখুন' : 'Track Payments & Reports',
      description: bn
        ? 'bKash, নগদ বা ব্যাংকে টাকা পেলে লিখে রাখুন, বাকি কত আছে দেখুন, আর রিপোর্টে পুরো হিসাব মিলিয়ে নিন।'
        : 'Record payments, check balances, and review business records and reports.',
      screenshot: {
        src: '/images/xolvemanager-walkthrough-payments.png',
        alt: bn
          ? 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল পেমেন্টের পাতা — টাকার হিসাব, বাকি তোলার কাজ আর ব্যালান্স।'
          : 'Actual XolveManager Payments module with sample data, showing payment history, collection actions, and balances.',
        caption: bn ? 'পেমেন্ট' : 'Payments',
        width: 615,
      },
      relatedScreenshot: {
        src: '/images/xolvemanager-walkthrough-reports.png',
        alt: bn
          ? 'নমুনা হিসাব দিয়ে দেখানো XolveManager-এর আসল ব্যবসার রিপোর্ট — লেখা হিসাব আর লাভের সারাংশ।'
          : 'Actual XolveManager business report with sample data, showing recorded activity and profitability summaries.',
        caption: bn ? 'ব্যবসার রিপোর্ট' : 'Business reports',
        width: 615,
      },
    },
  ];
}

export function WorkflowWalkthrough({ language }: { language: LandingLanguage }) {
  const listRef = useRef<HTMLOListElement>(null);
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(() => new Set());
  const steps = getSteps(language);
  const bn = language === 'bn';

  useEffect(() => {
    const list = listRef.current;
    if (!list || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(entries => {
      setRevealedSteps(current => {
        const next = new Set(current);
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.stepIndex);
            if (Number.isInteger(index)) next.add(index);
            observer.unobserve(entry.target);
          }
        }
        return next;
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.15 });

    list.querySelectorAll<HTMLElement>('[data-step-index]').forEach(step => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how-it-works" className={`scroll-mt-24 py-16 sm:py-20 ${styles.workflowSection}`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            {bn ? 'XolveManager কীভাবে কাজ করে' : 'How XolveManager Works'}
          </h2>
          <p className="mt-4 leading-7 text-slate-600">
            {bn ? 'ব্যবসা গোছাতে মাত্র চারটা সহজ ধাপ।' : 'Four simple steps to organize your business.'}
          </p>
        </div>

        <ol ref={listRef} className={styles.workflowList}>
          {steps.map((step, index) => (
            <li
              key={step.number}
              data-step-index={index}
              className={`${styles.workflowStep} ${revealedSteps.has(index) ? styles.workflowStepRevealed : ''}`}
            >
              <span className={styles.workflowStepNumber} aria-hidden="true">{step.number}</span>
              <article className={styles.workflowCard}>
                <h3 className="text-lg font-bold text-slate-950">{step.title}</h3>
                <p className="mt-2 min-h-[3.25rem] text-sm leading-6 text-slate-600">{step.description}</p>

                <figure className={styles.workflowScreenshot}>
                  <Image
                    src={step.screenshot.src}
                    alt={step.screenshot.alt}
                    width={step.screenshot.width}
                    height={538}
                    sizes="(max-width: 639px) calc(100vw - 6rem), (max-width: 1023px) 42vw, 22vw"
                    className="block h-auto w-full"
                  />
                  <figcaption className={styles.workflowScreenshotCaption}>
                    <span>{step.screenshot.caption}</span>
                    <span>{bn ? 'নমুনা হিসাব' : 'Sample data'}</span>
                  </figcaption>
                </figure>

                {step.relatedScreenshot && (
                  <figure className={styles.workflowRelatedScreenshot}>
                    <Image
                      src={step.relatedScreenshot.src}
                      alt={step.relatedScreenshot.alt}
                      width={step.relatedScreenshot.width}
                      height={538}
                      sizes="(max-width: 639px) calc(100vw - 6rem), (max-width: 1023px) 42vw, 22vw"
                      className="block h-auto w-full"
                    />
                    <figcaption>{step.relatedScreenshot.caption}</figcaption>
                  </figure>
                )}
              </article>
            </li>
          ))}
        </ol>

        <p className={styles.workflowNote}>
          {bn
            ? 'ছবিগুলো অ্যাপের আসল স্ক্রিন, নমুনা হিসাব দিয়ে দেখানো। টাকা এখানে শুধু লিখে রাখা যায় — পেমেন্ট নেওয়া যায় না; সাবস্ক্রিপশনের মেয়াদ দেখা যায় — নিজে থেকে বিল হয় না।'
            : 'Screenshots show sample records from the app. Payments are recorded—not processed, and subscriptions are tracked—not automatically billed.'}
        </p>
      </div>
    </section>
  );
}
