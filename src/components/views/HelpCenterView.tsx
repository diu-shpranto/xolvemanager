'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  DatabaseBackup,
  ExternalLink,
  Landmark,
  LifeBuoy,
  Lightbulb,
  ReceiptText,
  Rocket,
  Search,
  Settings,
  ShieldAlert,
  Tv,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  getLocalizedHelpArticle,
  getHelpArticle,
  helpArticles,
  helpCategories,
  searchHelpArticles,
  type HelpCategory,
} from '../../data/helpCenter';
import { helpArticlesBn, helpCategoriesBn, helpCenterTextBn } from '../../i18n/helpCenterBn';
import { useApp } from '../../context/AppContext';
import type { NavSection } from '../navigation/Sidebar';

interface HelpCenterViewProps {
  articleId: string | null;
  onSelectArticle: (articleId: string | null) => void;
  onNavigate: (section: NavSection, articleId?: string) => void;
}

const suggestedArticles = ['daily-work', 'getting-started', 'payment-partial', 'due-collection'];

/** One recognisable icon per category, so a card can be scanned at a glance. */
const categoryIcons: Record<HelpCategory, LucideIcon> = {
  'Getting Started': Rocket,
  'Customer Management': Users,
  'Service Management': Tv,
  'Sales & Invoices': ReceiptText,
  'Payments & Due Collection': Banknote,
  'Money & Accounts': Landmark,
  Reports: BarChart3,
  'Backup & Restore': DatabaseBackup,
  'Settings & Privacy': Settings,
};

export const HelpCenterView: React.FC<HelpCenterViewProps> = ({
  articleId,
  onSelectArticle,
  onNavigate,
}) => {
  const { language } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HelpCategory | 'All'>('All');
  const sourceArticle = getHelpArticle(articleId);
  const article = useMemo(
    () => sourceArticle ? getLocalizedHelpArticle(sourceArticle, language) : undefined,
    [sourceArticle, language]
  );
  const labels = language === 'bn' ? helpCenterTextBn : null;
  const results = useMemo(() => searchHelpArticles(query, category, language), [query, category, language]);
  const formatCount = (value: number) => value.toLocaleString(language === 'bn' ? 'bn-BD' : 'en-US');
  const suggested = useMemo(() => suggestedArticles
    .map(getHelpArticle)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter(item => category === 'All' || item.category === category), [category]);

  useEffect(() => {
    if (articleId && !article) onSelectArticle(null);
  }, [article, articleId, onSelectArticle]);

  const openArticle = (id: string) => {
    onSelectArticle(id);
    document.getElementById('help-center-content')?.focus();
  };

  const selectCategory = (nextCategory: HelpCategory | 'All') => {
    setCategory(nextCategory);
    if (articleId) onSelectArticle(null);
  };

  return (
    <main className="help-view--v2 section-layout-shell mx-auto w-full max-w-[1600px] space-y-5 px-3 py-3 sm:px-6 sm:py-6 lg:px-8" data-section="help">
      {/* Hero: solid violet help-desk band with the search inside it. */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-600 to-fuchsia-600 shadow-lg shadow-violet-600/25 dark:from-violet-900 dark:via-violet-800 dark:to-fuchsia-900 dark:shadow-black/40">
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-32 h-36 w-36 rounded-full bg-white/10" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white ring-1 ring-inset ring-white/25">
              <LifeBuoy aria-hidden="true" className="h-3.5 w-3.5" />
              {labels?.brand || 'XolveManager Help Center'}
            </span>
            {article && (
              <button
                type="button"
                onClick={() => onSelectArticle(null)}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                {labels?.allHelpTopics || 'All help topics'}
              </button>
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
            {article ? article.title : labels?.heading || 'What would you like help with?'}
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-violet-100">
            {article
              ? article.introduction
              : labels?.introduction || 'Search verified guides, follow common workflows, or find a next step when something is missing.'}
          </p>
          <div className="relative mt-4 max-w-2xl">
            <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
            <label htmlFor="help-search" className="sr-only">{labels?.articleSearchLabel || 'Search help articles'}</label>
            <input
              id="help-search"
              type="search"
              value={query}
              onChange={event => {
                setQuery(event.target.value);
                if (articleId) onSelectArticle(null);
              }}
              placeholder={labels?.searchPlaceholder || 'Search guides and answers'}
              className="min-h-11 w-full rounded-full border border-transparent bg-white pl-11 pr-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-white focus:ring-2 focus:ring-white/70 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-400 dark:hover:bg-slate-800"
                aria-label={labels?.clearSearch || 'Clear help search'}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="min-w-0 space-y-5">
        {/* Category rail: pill chips with a count badge. */}
        <nav aria-label={labels?.browseTopics || 'Help categories'} className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
          <button
            type="button"
            onClick={() => selectCategory('All')}
            aria-pressed={category === 'All'}
            className={`flex min-h-9 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-600 ${category === 'All' ? 'bg-violet-700 text-white shadow-sm shadow-violet-600/30' : 'border border-violet-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-400/30 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-400/50 dark:hover:bg-violet-950/40'}`}
          >
            {labels?.allTopics || 'All topics'}
            <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${category === 'All' ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>{formatCount(helpArticles.length)}</span>
          </button>
          {helpCategories.map(item => {
            const count = helpArticles.filter(helpArticle => helpArticle.category === item).length;
            const active = category === item;
            return (
              <button
                type="button"
                key={item}
                onClick={() => selectCategory(item)}
                aria-pressed={active}
                className={`flex min-h-9 shrink-0 items-center rounded-full px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-600 ${active ? 'bg-violet-700 text-white shadow-sm shadow-violet-600/30' : 'border border-violet-200 bg-white text-slate-700 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-400/30 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-400/50 dark:hover:bg-violet-950/40'}`}
              >
                {language === 'bn' ? helpCategoriesBn[item] : item}
                <span className={`ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>{formatCount(count)}</span>
              </button>
            );
          })}
        </nav>

        <section id="help-center-content" tabIndex={-1} aria-live="polite" className="min-w-0 outline-none">
          {article ? (
            <article className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border border-violet-200 bg-linear-to-b from-white to-violet-100/70 p-4 shadow-[0_1px_3px_rgba(76,29,149,0.10),0_12px_24px_-10px_rgba(76,29,149,0.30)] dark:border-violet-400/30 dark:from-[#1b1830] dark:to-violet-950/40 dark:shadow-[0_1px_3px_rgba(0,0,0,0.45),0_12px_24px_-12px_rgba(0,0,0,0.7)] sm:p-6 lg:p-8">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-violet-600 via-violet-500 to-fuchsia-400" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">{language === 'bn' ? helpCategoriesBn[article.category] : article.category}</span>
                {article.destination && <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{labels?.workspace || 'Workspace'}: {article.destinationLabel?.replace(/^Open /, '').replace(/ খুলুন$/, '') || 'in app'}</span>}
              </div>

              {article.problem && (
                <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900/70 dark:bg-amber-950/30">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                      <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="space-y-2 text-sm leading-6">
                      <p><strong className="text-amber-950 dark:text-amber-100">{labels?.why || 'Why this can happen:'}</strong> <span className="text-amber-900 dark:text-amber-200">{article.problem}</span></p>
                      {article.nextAction && <p><strong className="text-amber-950 dark:text-amber-100">{labels?.whatToDo || 'What to do:'}</strong> <span className="text-amber-900 dark:text-amber-200">{article.nextAction}</span></p>}
                    </div>
                  </div>
                </div>
              )}

              <section className="mt-6" aria-labelledby="help-steps-heading">
                <h2 id="help-steps-heading" className="section-title">{labels?.stepsHeading || 'Step by step'}</h2>
                <ol className="mt-4 space-y-2.5">
                  {article.steps.map((step, index) => (
                    <li key={`${article.id}-step-${index}`} className="relative flex min-w-0 gap-3">
                      {index < article.steps.length - 1 && (
                        <span aria-hidden="true" className="absolute -bottom-2.5 left-4 top-8 w-px bg-violet-200 dark:bg-violet-800" />
                      )}
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-700 text-sm font-bold text-white shadow-sm ring-4 ring-white dark:ring-[#1b1830]">{index + 1}</span>
                      <p className="min-w-0 flex-1 rounded-xl border border-violet-100 bg-violet-50/70 px-3 py-2 text-sm leading-6 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>

              {article.note && (
                <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-violet-200 bg-violet-50 p-3.5 dark:border-violet-800/60 dark:bg-violet-950/30">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30">
                    <Lightbulb aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <p className="text-sm leading-6 text-violet-950 dark:text-violet-100">
                    <strong>{labels?.goodToKnow || 'Good to know:'}</strong> {article.note}
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200/70 pt-4 dark:border-slate-700/60">
                {article.destination && (
                  <button
                    type="button"
                    onClick={() => onNavigate(article.destination!, article.id)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  >
                    {article.destinationLabel || labels?.openWorkspace || 'Open workspace'}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
                {article.externalHref && (
                  <a
                    href={article.externalHref}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Privacy &amp; Data Notice <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                )}
              </div>

              {article.related.length > 0 && (
                <section className="mt-7 border-t border-slate-200/70 pt-5 dark:border-slate-700/60" aria-labelledby="related-help-heading">
                  <h2 id="related-help-heading" className="text-sm font-bold text-slate-900 dark:text-white">{labels?.related || 'Related guides'}</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {article.related.map(relatedId => getHelpArticle(relatedId)).filter((item): item is NonNullable<typeof item> => Boolean(item)).map(related => {
                      const CategoryIcon = categoryIcons[related.category];
                      return (
                        <button
                          key={related.id}
                          type="button"
                          onClick={() => openArticle(related.id)}
                          className="group relative flex min-h-14 items-center justify-between gap-3 overflow-hidden rounded-2xl border border-violet-200 bg-linear-to-b from-white to-violet-100/70 px-3.5 py-2.5 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-violet-400/30 dark:from-[#1b1830] dark:to-violet-950/40 dark:hover:border-violet-400/50"
                        >
                          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-violet-600 via-violet-500 to-fuchsia-400" />
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30">
                              <CategoryIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[10px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">{language === 'bn' ? helpCategoriesBn[related.category] : related.category}</span>
                              <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{getLocalizedHelpArticle(related, language).title}</span>
                            </span>
                          </span>
                          <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-600 transition-transform group-hover:translate-x-0.5 dark:text-violet-300" />
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </article>
          ) : results.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {query
                    ? language === 'bn'
                      ? `${formatCount(results.length)} ${results.length === 1 ? labels?.result : labels?.results}`
                      : `${results.length} ${results.length === 1 ? 'result' : 'results'}`
                    : category === 'All'
                      ? labels?.popular || 'Popular and recently useful'
                      : language === 'bn' ? helpCategoriesBn[category] : category}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">{labels?.guidanceNote || 'Guidance based on the current app workflows'}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(query ? results : category === 'All' ? [
                  ...suggested,
                  ...results.filter(item => !suggestedArticles.includes(item.id)),
                ] : results).map(item => {
                  const CategoryIcon = categoryIcons[item.category];
                  const localized = getLocalizedHelpArticle(item, language);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => openArticle(item.id)}
                      className="group relative flex min-h-44 flex-col overflow-hidden rounded-2xl border border-violet-200 bg-linear-to-b from-white to-violet-100/70 p-4 text-left shadow-[0_1px_3px_rgba(76,29,149,0.10),0_12px_24px_-10px_rgba(76,29,149,0.30)] transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-[0_2px_5px_rgba(76,29,149,0.12),0_18px_30px_-12px_rgba(76,29,149,0.38)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-violet-400/30 dark:from-[#1b1830] dark:to-violet-950/40 dark:shadow-[0_1px_3px_rgba(0,0,0,0.45),0_12px_24px_-12px_rgba(0,0,0,0.7)] dark:hover:border-violet-400/50"
                    >
                      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-violet-600 via-violet-500 to-fuchsia-400" />
                      <span className="flex items-start justify-between gap-3">
                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold text-violet-800 dark:bg-violet-500/15 dark:text-violet-300">{language === 'bn' ? helpCategoriesBn[item.category] : item.category}</span>
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30">
                          <CategoryIcon className="h-4 w-4" />
                        </span>
                      </span>
                      <span className="mt-2.5 block text-sm font-bold leading-6 text-slate-900 dark:text-white">{localized.title}</span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-400">{localized.introduction}</span>
                      <span className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 dark:border-slate-700/60">
                        <span className="inline-flex items-center gap-1.5 pt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                          {formatCount(item.steps.length)} {language === 'bn' ? 'ধাপ' : item.steps.length === 1 ? 'step' : 'steps'}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-violet-700 group-hover:underline dark:text-violet-300">
                          {labels?.readGuide || 'Read guide'} <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border-2 border-dashed border-violet-200 bg-white px-5 py-10 text-center dark:border-violet-400/30 dark:bg-slate-900">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30">
                <CircleHelp aria-hidden="true" className="h-6 w-6" />
              </span>
              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{labels?.noResults || 'No matching guides'}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                {labels?.noResultsHelp || 'Try a shorter keyword or choose another category. You can also browse these common guides.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggested.slice(0, 3).map(item => (
                  <button key={item.id} type="button" onClick={() => openArticle(item.id)} className="min-h-10 rounded-full border border-violet-200 bg-white px-3 text-xs font-semibold text-violet-800 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-violet-400/30 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/30">
                    {getLocalizedHelpArticle(item, language).title}
                  </button>
                ))}
                <button type="button" onClick={() => { setQuery(''); setCategory('All'); }} className="min-h-10 rounded-full bg-violet-700 px-3 text-xs font-semibold text-white shadow-sm hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600">
                  {labels?.browseAll || 'Browse all guides'}
                </button>
              </div>
              <a href="/support" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300">
                {labels?.support || 'Visit the Support Center'} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-violet-400/30 dark:bg-slate-900/70 dark:text-slate-400">
            <span className="inline-flex items-center gap-2"><CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {labels?.verified || 'Instructions reflect current XolveManager screens.'}</span>
            <button type="button" onClick={() => onNavigate('dashboard')} className="shrink-0 font-semibold text-violet-700 hover:underline focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-300">
              {labels?.backToApp || 'Back to app'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};
