import React from 'react';

/**
 * StatCard v3 — the ONE stat/KPI/summary card design for the whole app.
 *
 * "Number-first, icon-rail": a tone-coloured gradient accent bar across the
 * top, then the big value on the left with a circular soft-tinted icon badge
 * on the right, the label under the value, and the hint below a hairline
 * divider (with a tone dot). Clickable cards render as <button> and lift on
 * hover; read-only cards render as <div>.
 *
 * Content is supplied by the caller — label, value, hint, icon and the
 * navigation target never change here. Tones: violet (default), emerald,
 * amber, rose, blue, teal, slate. `attention` turns the accent bar and the
 * value amber (used for "needs attention" KPIs). Sizes: default / compact /
 * mini (mini skips the divider and shrinks everything for dense grids).
 *
 * All classes are literal Tailwind strings (no dynamic `bg-${tone}` builds)
 * so Tailwind's scanner picks them up. Dark mode uses the `.dark` class
 * variant like the rest of the app.
 */

export type StatCardTone = 'violet' | 'emerald' | 'amber' | 'rose' | 'blue' | 'teal' | 'slate';
export type StatCardSize = 'default' | 'compact' | 'mini';

export interface StatCardProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: StatCardTone;
  /** Needs-attention state: amber accent bar + amber value. */
  attention?: boolean;
  /** When set the card renders as a <button> and navigates on click. */
  onClick?: () => void;
  size?: StatCardSize;
  /** Colour the value itself (e.g. money in/out). Overridden by `attention`. */
  valueTone?: StatCardTone;
  /** Extra classes on the value. When set it REPLACES the default value size,
   *  so pass a complete size (e.g. `text-xl sm:text-2xl`) — plain `text-xl`
   *  would otherwise lose to the default size class in the generated CSS. */
  valueClassName?: string;
  /** Hide the icon badge (dense mini grids). */
  hideIcon?: boolean;
  /** Extra content rendered below the hint (e.g. a date chip). */
  extra?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

const toneStyles: Record<StatCardTone, { accent: string; icon: string; dot: string; value: string }> = {
  violet: {
    accent: 'from-violet-600 via-violet-500 to-fuchsia-400',
    icon: 'bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30',
    dot: 'bg-violet-500',
    value: 'text-violet-700 dark:text-violet-300',
  },
  emerald: {
    accent: 'from-emerald-600 via-emerald-500 to-teal-400',
    icon: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    dot: 'bg-emerald-500',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  amber: {
    accent: 'from-amber-500 via-amber-400 to-yellow-400',
    icon: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    dot: 'bg-amber-500',
    value: 'text-amber-700 dark:text-amber-300',
  },
  rose: {
    accent: 'from-rose-600 via-rose-500 to-orange-400',
    icon: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
    dot: 'bg-rose-500',
    value: 'text-rose-700 dark:text-rose-300',
  },
  blue: {
    accent: 'from-blue-600 via-blue-500 to-sky-400',
    icon: 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
    dot: 'bg-blue-500',
    value: 'text-blue-700 dark:text-blue-300',
  },
  teal: {
    accent: 'from-teal-600 via-teal-500 to-cyan-400',
    icon: 'bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/30',
    dot: 'bg-teal-500',
    value: 'text-teal-700 dark:text-teal-300',
  },
  slate: {
    accent: 'from-slate-500 via-slate-400 to-slate-300',
    icon: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30',
    dot: 'bg-slate-400',
    value: 'text-slate-700 dark:text-slate-300',
  },
};

const attentionStyles = {
  accent: 'from-amber-500 via-amber-400 to-yellow-400',
  value: 'text-amber-700 dark:text-amber-300',
};

const sizeStyles: Record<StatCardSize, {
  card: string;
  value: string;
  icon: string;
  iconSvg: string;
  label: string;
  hint: string;
}> = {
  default: {
    card: 'p-2.5',
    value: 'text-xl leading-7 sm:text-[22px] sm:leading-7',
    icon: 'h-8 w-8',
    iconSvg: '[&>svg]:h-4 [&>svg]:w-4',
    label: 'mt-1 text-xs leading-4',
    hint: 'mt-1.5 pt-1.5 text-[11px] leading-4',
  },
  compact: {
    card: 'p-2.5',
    value: 'text-lg leading-6 sm:text-xl sm:leading-6',
    icon: 'h-7 w-7',
    iconSvg: '[&>svg]:h-3.5 [&>svg]:w-3.5',
    label: 'mt-1 text-xs leading-5',
    hint: 'mt-1 pt-1 text-[11px] leading-4',
  },
  mini: {
    card: 'p-2',
    value: 'text-sm leading-5',
    icon: 'h-5 w-5',
    iconSvg: '[&>svg]:h-2.5 [&>svg]:w-2.5',
    label: 'mt-0.5 text-[11px] leading-4',
    hint: 'mt-0.5 text-[10px] leading-3.5',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  hint,
  tone = 'violet',
  attention = false,
  onClick,
  size = 'default',
  valueTone,
  valueClassName = '',
  hideIcon = false,
  extra,
  className = '',
  style,
  ariaLabel,
}) => {
  const t = toneStyles[tone];
  const s = sizeStyles[size];
  const accent = attention ? attentionStyles.accent : t.accent;
  const valueColour = attention
    ? attentionStyles.value
    : valueTone
      ? toneStyles[valueTone].value
      : 'text-slate-900 dark:text-white';
  const clickable = typeof onClick === 'function';
  const Tag = (clickable ? 'button' : 'div') as React.ElementType;
  return (
    <Tag
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      style={style}
      aria-label={ariaLabel}
      className={[
        'relative min-w-0 overflow-hidden rounded-2xl border border-violet-100',
        'bg-linear-to-b from-white to-violet-50/60',
        'shadow-[0_1px_2px_rgba(76,29,149,0.06),0_10px_28px_-14px_rgba(76,29,149,0.25)]',
        'dark:border-violet-500/20 dark:from-slate-900 dark:to-violet-950/30 dark:shadow-none',
        s.card,
        clickable
          ? 'flex cursor-pointer flex-col text-left transition hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-[0_2px_4px_rgba(76,29,149,0.08),0_16px_32px_-14px_rgba(76,29,149,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 dark:hover:border-violet-500/40'
          : 'flex flex-col text-left',
        className,
      ].join(' ')}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] bg-linear-to-r ${accent}`} />
      <span className="flex items-start justify-between gap-2">
        <span className={`min-w-0 truncate font-extrabold tracking-tight tabular-nums ${valueClassName || s.value} ${valueColour}`}>
          {value}
        </span>
        {!hideIcon && (
          <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${s.icon} ${s.iconSvg} ${t.icon}`}>
            {icon}
          </span>
        )}
      </span>
      <span className={`block font-semibold text-slate-700 dark:text-slate-200 ${s.label}`}>{label}</span>
      {hint ? (
        <span
          className={`flex items-center gap-1.5 text-slate-500 dark:text-slate-400 ${s.hint} ${
            size === 'mini' ? '' : 'border-t border-slate-200/70 dark:border-slate-700/60'
          }`}
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${attention ? 'bg-amber-500' : t.dot}`} />
          <span className="min-w-0 line-clamp-2">{hint}</span>
        </span>
      ) : null}
      {extra}
    </Tag>
  );
};

/** Loading placeholder matching the v3 card shape (value bar, icon circle, label + hint bars). */
export const StatCardSkeleton: React.FC<{ size?: StatCardSize; className?: string; style?: React.CSSProperties }> = ({
  size = 'default',
  className = '',
  style,
}) => {
  const s = sizeStyles[size];
  return (
    <div
      aria-hidden="true"
      style={style}
      className={`relative min-w-0 animate-pulse overflow-hidden rounded-2xl border border-violet-100 bg-linear-to-b from-white to-violet-50/60 dark:border-violet-500/20 dark:from-slate-900 dark:to-violet-950/30 ${s.card} ${className}`}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-violet-200 dark:bg-violet-500/30" />
      <span className="flex items-start justify-between gap-2">
        <span className="h-6 w-20 rounded-lg bg-slate-200/80 dark:bg-slate-700/70 sm:h-7" />
        <span className={`shrink-0 rounded-full bg-slate-200/80 dark:bg-slate-700/70 ${s.icon}`} />
      </span>
      <span className="mt-1 block h-3.5 w-20 rounded bg-slate-200/80 dark:bg-slate-700/70" />
      <span className="mt-1.5 block border-t border-slate-200/70 pt-2 dark:border-slate-700/60">
        <span className="block h-3 w-28 rounded bg-slate-200/80 dark:bg-slate-700/70" />
      </span>
    </div>
  );
};
