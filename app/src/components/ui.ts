/** Shared Tailwind class strings so screens look the same. */
export const ui = {
  input:
    'w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 dark:border-slate-700 dark:bg-slate-900',
  /** Looks like text until hovered or focused ("edit in place"). */
  inline:
    'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 hover:border-slate-300 focus:border-orange-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 dark:hover:border-slate-700 dark:focus:bg-slate-900',
  label: 'block text-xs font-medium text-slate-500 dark:text-slate-400',
  primary:
    'inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500',
  secondary:
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700',
  icon: 'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  card: 'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800',
  sectionHeading: 'text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
} as const;
