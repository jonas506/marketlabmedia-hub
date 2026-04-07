export const BLOCK_TYPES = [
  { value: 'fokus', label: 'Fokus-Work', icon: '🎯', color: '#3B82F6', description: 'Deep Work ohne Unterbrechungen' },
  { value: 'admin', label: 'Admin', icon: '📋', color: '#6B7280', description: 'Emails, Buchhaltung, Orga' },
  { value: 'content', label: 'Content', icon: '✏️', color: '#22C55E', description: 'Scripting, Review, Publishing' },
] as const;

export const DURATION_PRESETS = [
  { value: 30, label: '30min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1.5h' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
] as const;

export type BlockType = typeof BLOCK_TYPES[number]['value'];

export interface TimeBlockData {
  id: string;
  type: BlockType;
  label: string;
  duration_minutes: number;
  task_ids: string[];
  started_at: string | null;
  completed_at: string | null;
  sort_order: number;
}

export const getBlockType = (value: string) =>
  BLOCK_TYPES.find(b => b.value === value) || BLOCK_TYPES[0];
