'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ExternalLink,
  LifeBuoy,
  Search,
  ShieldAlert,
  X,
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

const suggestedArticles = ['getting-started', 'customer-create', 'payment-partial', 'backup-restore'];

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
    <main className="section-layout-shell mx-auto w-full max-w-[1600px] space-y-5 px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <header className="overflow-hidden rounded-3xl border border-violet-200/80 bg-gradient-to-br from-white via-violet-50 to-indigo-50 p-5 shadow-sm dark:border-violet-900/60 dark:from-slate-900 dark:via-violet-950/30 dark:to-slate-900 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-violet-800 dark:border-violet-800 dark:bg-slate-900/70 dark:text-violet-200">
              <LifeBuoy aria-hidden="true" className="h-4 w-4" />
              {labels?.brand || 'XolveManager Help Center'}
            </span>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
              {article ? article.title : labels?.heading || 'What would you like help with?'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              {article
                ? article.introduction
                : labels?.introduction || 'Search verified guides, follow common workflows, or find a next step when something is missing.'}
            </p>
          </div>
          {article && (
            <button
              type="button"
              onClick={() => onSelectArticle(null)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-violet-800 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/50"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {labels?.allHelpTopics || 'All help topics'}
            </button>
          )}
        </div>
      </header>

      <div className="min-w-0 space-y-5">
        <section aria-label={labels?.browseTopics || 'Browse help topics'} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900 sm:p-4">
          <div className="relative max-w-2xl">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-sm text-slate-900 shadow-xs outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-violet-600 dark:hover:bg-slate-800"
                aria-label={labels?.clearSearch || 'Clear help search'}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>

          <nav aria-label={labels?.browseTopics || 'Help categories'} className="mt-3 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
            <button
              type="button"
              onClick={() => selectCategory('All')}
              aria-pressed={category === 'All'}
            className={`min-h-10 shrink-0 rounded-xl px-3 text-left text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-600 ${category === 'All' ? 'bg-violet-700 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-violet-950/30'}`}
            >
              {labels?.allTopics || 'All topics'} <span className="ml-1 opacity-70">({formatCount(helpArticles.length)})</span>
            </button>
            {helpCategories.map(item => {
              const count = helpArticles.filter(helpArticle => helpArticle.category === item).length;
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => selectCategory(item)}
                  aria-pressed={category === item}
                  className={`min-h-10 shrink-0 rounded-xl px-3 text-left text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-violet-600 ${category === item ? 'bg-violet-700 text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-violet-200 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-violet-950/30'}`}
                >
                  {language === 'bn' ? helpCategoriesBn[item] : item} <span className="ml-1 opacity-70">({formatCount(count)})</span>
                </button>
              );
            })}
          </nav>
        </section>

        <section id="help-center-content" tabIndex={-1} aria-live="polite" className="min-w-0 outline-none">
          {article ? (
            <article className="mx-auto max-w-5xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6 lg:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{language === 'bn' ? helpCategoriesBn[article.category] : article.category}</span>
                {article.destination && <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300">{labels?.workspace || 'Workspace'}: {article.destinationLabel?.replace(/^Open /, '').replace(/ খুলুন$/, '') || 'in app'}</span>}
              </div>

              {article.problem && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
                  <div className="flex items-start gap-2">
                    <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                    <div className="space-y-2 text-sm leading-6">
                      <p><strong className="text-amber-950 dark:text-amber-100">{labels?.why || 'Why this can happen:'}</strong> <span className="text-amber-900 dark:text-amber-200">{article.problem}</span></p>
                      {article.nextAction && <p><strong className="text-amber-950 dark:text-amber-100">{labels?.whatToDo || 'What to do:'}</strong> <span className="text-amber-900 dark:text-amber-200">{article.nextAction}</span></p>}
                    </div>
                  </div>
                </div>
              )}

              <section className="mt-6" aria-labelledby="help-steps-heading">
                <h2 id="help-steps-heading" className="section-title">{labels?.stepsHeading || 'Step by step'}</h2>
                <ol className="mt-4 space-y-3">
                  {article.steps.map((step, index) => (
                    <li key={`${article.id}-step-${index}`} className="flex min-w-0 gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">{index + 1}</span>
                      <p className="min-w-0 pt-0.5 text-sm leading-6 text-slate-700 dark:text-slate-300">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>

              {article.note && (
                <p className="mt-5 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-sm leading-6 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/25 dark:text-blue-200">
                  <strong>{labels?.goodToKnow || 'Good to know:'}</strong> {article.note}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {article.destination && (
                  <button
                    type="button"
                    onClick={() => onNavigate(article.destination!, article.id)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
                  >
                    {article.destinationLabel || labels?.openWorkspace || 'Open workspace'}
                    <ArrowRight aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
                {article.externalHref && (
                  <a
                    href={article.externalHref}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Privacy &amp; Data Notice <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                )}
              </div>

              {article.related.length > 0 && (
                <section className="mt-7 border-t border-slate-100 pt-5 dark:border-slate-800" aria-labelledby="related-help-heading">
                  <h2 id="related-help-heading" className="text-sm font-bold text-slate-900 dark:text-white">{labels?.related || 'Related guides'}</h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {article.related.map(relatedId => getHelpArticle(relatedId)).filter((item): item is NonNullable<typeof item> => Boolean(item)).map(related => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => openArticle(related.id)}
                        className="group flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50/50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-violet-800 dark:hover:bg-violet-950/20"
                      >
                        <span className="min-w-0">{getLocalizedHelpArticle(related, language).title}</span>
                        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-600 transition-transform group-hover:translate-x-0.5 dark:text-violet-300" />
                      </button>
                    ))}
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
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {(query ? results : category === 'All' ? [
                  ...suggested,
                  ...results.filter(item => !suggestedArticles.includes(item.id)),
                ] : results).map(item => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => openArticle(item.id)}
                    className="group flex min-h-40 flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-violet-800 sm:p-5"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-violet-50 px-2 py-1 text-[10px] font-bold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">{language === 'bn' ? helpCategoriesBn[item.category] : item.category}</span>
                      <BookOpen aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-500" />
                    </span>
                    <span className="mt-3 text-sm font-bold text-slate-900 dark:text-white">{getLocalizedHelpArticle(item, language).title}</span>
                    <span className="mt-1 line-clamp-3 text-xs leading-5 text-slate-600 dark:text-slate-400">{getLocalizedHelpArticle(item, language).introduction}</span>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-violet-700 group-hover:underline dark:text-violet-300">
                      {labels?.readGuide || 'Read guide'} <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <CircleHelp aria-hidden="true" className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">{labels?.noResults || 'No matching guides'}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
                {labels?.noResultsHelp || 'Try a shorter keyword or choose another category. You can also browse these common guides.'}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggested.slice(0, 3).map(item => (
                  <button key={item.id} type="button" onClick={() => openArticle(item.id)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-violet-800 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-violet-600 dark:border-slate-700 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/30">
                    {getLocalizedHelpArticle(item, language).title}
                  </button>
                ))}
                <button type="button" onClick={() => { setQuery(''); setCategory('All'); }} className="min-h-10 rounded-xl bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-600 focus-visible:outline-2 focus-visible:outline-violet-600">
                  {labels?.browseAll || 'Browse all guides'}
                </button>
              </div>
              <a href="/support" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-slate-300">
                {labels?.support || 'Visit the Support Center'} <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
          <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
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
