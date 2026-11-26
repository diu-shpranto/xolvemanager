'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import styles from '../../../app/homepage.module.css';

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

const steps: WalkthroughStep[] = [
  {
    number: '01',
    title: 'Add Customers',
    description: 'Store customer details and return to customer records to review related activity.',
    screenshot: {
      src: '/images/xolvemanager-walkthrough-customers.png',
      alt: 'Actual XolveManager customer module with sample data, showing customer summary, activity totals, and record search.',
      caption: 'Customer records',
      width: 615,
    },
  },
  {
    number: '02',
    title: 'Create Services & Plans',
    description: 'Set up services and plans with the prices, durations, and availability you offer.',
    screenshot: {
      src: '/images/xolvemanager-walkthrough-services.png',
      alt: 'Actual XolveManager service catalog with sample data, showing service and active-plan summaries.',
      caption: 'Service catalog',
      width: 615,
    },
    relatedScreenshot: {
      src: '/images/xolvemanager-walkthrough-service-setup.png',
      alt: 'Actual Add Service plan form showing plan name, price, currency, duration, duration unit, and status fields.',
      caption: 'Plan setup',
      width: 855,
    },
  },
  {
    number: '03',
    title: 'Manage Sales & Invoices',
    description: 'Record a sale, create its invoice, and review payment progress.',
    screenshot: {
      src: '/images/xolvemanager-walkthrough-sales.png',
      alt: 'Actual XolveManager Sales module with sample data, showing sale totals, payment status summaries, and the New Sale action.',
      caption: 'Sales',
      width: 615,
    },
    relatedScreenshot: {
      src: '/images/xolvemanager-walkthrough-invoices.png',
      alt: 'Actual XolveManager Invoices and receipts module with sample data, showing billed, collected, and outstanding amounts.',
      caption: 'Invoices',
      width: 615,
    },
  },
  {
    number: '04',
    title: 'Track Payments & Reports',
    description: 'Record payments, check balances, and review business records and reports.',
    screenshot: {
      src: '/images/xolvemanager-walkthrough-payments.png',
      alt: 'Actual XolveManager Payments module with sample data, showing payment history, collection actions, and balances.',
      caption: 'Payments',
      width: 615,
    },
    relatedScreenshot: {
      src: '/images/xolvemanager-walkthrough-reports.png',
      alt: 'Actual XolveManager business report with sample data, showing recorded activity and profitability summaries.',
      caption: 'Business reports',
      width: 615,
    },
  },
];

export function WorkflowWalkthrough() {
  const listRef = useRef<HTMLOListElement>(null);
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(() => new Set());

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
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">How XolveManager Works</h2>
          <p className="mt-4 leading-7 text-slate-600">Four simple steps to organize your business.</p>
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
                    <span>Sample data</span>
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
          Screenshots show fictional sample records. Your business records stay in your browser.
          Payments are recorded—not processed, and subscriptions are tracked—not automatically billed.
        </p>
      </div>
    </section>
  );
}
