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

// Smart suggestion: tag-based classification
const ADMIN_TAGS = ['admin', 'buchhaltung', 'email', 'orga', 'invoice', 'rechnung'];
const CONTENT_TAGS = ['script', 'reel', 'carousel', 'story', 'content', 'publishing', 'review', 'schnitt', 'skript', 'veröffentlichen'];

export function classifyTask(task: { tag?: string | null; title: string; priority?: string | null }): BlockType {
  const tag = (task.tag || '').toLowerCase();
  const title = task.title.toLowerCase();
  if (ADMIN_TAGS.some(t => tag.includes(t) || title.includes(t))) return 'admin';
  if (CONTENT_TAGS.some(t => tag.includes(t) || title.includes(t))) return 'content';
  if (task.priority === 'low') return 'admin';
  return 'fokus';
}

export function roundToHalfHour(minutes: number): number {
  const rounded = Math.ceil(minutes / 30) * 30;
  return Math.max(30, Math.min(180, rounded));
}

// Web Audio beep for timer end
export function playTimerBeep() {
  try {
    if (document.hidden) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 500);
  } catch { /* silent fail */ }
}
