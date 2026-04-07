export const ACTIVITY_TYPES = [
  { value: 'scripting', label: 'Scripting' },
  { value: 'editing', label: 'Editing' },
  { value: 'shooting', label: 'Shooting' },
  { value: 'strategy', label: 'Strategie' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'admin', label: 'Admin' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Sonstige' },
] as const;

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
