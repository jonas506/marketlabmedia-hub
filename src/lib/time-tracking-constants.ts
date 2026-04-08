export const ACTIVITY_TYPES = [
  { value: 'scripting', label: 'Scripting', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
  { value: 'editing', label: 'Editing', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  { value: 'shooting', label: 'Shooting', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  { value: 'strategy', label: 'Strategie', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  { value: 'publishing', label: 'Publishing', color: 'bg-pink-500/15 text-pink-600 dark:text-pink-400' },
  { value: 'admin', label: 'Admin', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
  { value: 'meeting', label: 'Meeting', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  { value: 'research', label: 'Research', color: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400' },
  { value: 'content_creation', label: 'Contenterstellung (Slides)', color: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
  { value: 'reporting', label: 'Reporting', color: 'bg-teal-500/15 text-teal-600 dark:text-teal-400' },
  { value: 'other', label: 'Sonstige', color: 'bg-gray-500/15 text-gray-600 dark:text-gray-400' },
] as const;

export const ACTIVITY_BAR_COLORS: Record<string, string> = {
  scripting: 'bg-violet-500',
  editing: 'bg-blue-500',
  shooting: 'bg-orange-500',
  strategy: 'bg-emerald-500',
  publishing: 'bg-pink-500',
  admin: 'bg-slate-400',
  meeting: 'bg-amber-500',
  research: 'bg-cyan-500',
  content_creation: 'bg-indigo-500',
  reporting: 'bg-teal-500',
  other: 'bg-gray-400',
};

export function formatHoursMinutes(decimal: number): string {
  const h = Math.floor(decimal);
  const m = Math.round((decimal - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export const VACATION_TYPES = [
  { value: 'vacation', label: 'Urlaub' },
  { value: 'sick', label: 'Krank' },
  { value: 'personal', label: 'Persönlich' },
] as const;

export const VACATION_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

export const VACATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};
