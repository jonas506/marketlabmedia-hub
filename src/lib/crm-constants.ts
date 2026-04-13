export const CRM_STAGES = [
  { value: 'erstkontakt', label: 'Erstkontakt', color: '#6B7280' },
  { value: 'interessiert', label: 'Interessiert', color: '#8B5CF6' },
  { value: 'gespraech', label: 'Gespräch', color: '#3B82F6' },
  { value: 'angebot', label: 'Angebot', color: '#F59E0B' },
  { value: 'gewonnen', label: 'Gewonnen', color: '#22C55E' },
  { value: 'verloren', label: 'Verloren', color: '#EF4444' },
] as const;

export type CrmStage = typeof CRM_STAGES[number]['value'];

export const CRM_SOURCES = [
  { value: 'outreach', label: 'Outreach', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'netzwerk', label: 'Netzwerk', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'event', label: 'Event', color: 'bg-purple-500/20 text-purple-400' },
  { value: 'inbound', label: 'Inbound', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'social_media', label: 'Social Media', color: 'bg-pink-500/20 text-pink-400' },
] as const;

export type CrmSource = typeof CRM_SOURCES[number]['value'];

export const PIPELINE_STAGES = CRM_STAGES.filter(s => !['gewonnen', 'verloren'].includes(s.value));

export function getStageLabel(value: string) {
  return CRM_STAGES.find(s => s.value === value)?.label ?? value;
}

export function getStageColor(value: string) {
  return CRM_STAGES.find(s => s.value === value)?.color ?? '#6B7280';
}

export function getSourceInfo(value: string | null, savedTags?: { name: string; color: string }[]): { value: string; label: string; color: string; style?: { background: string; color: string } } | null {
  if (!value) return null;
  const found = CRM_SOURCES.find(s => s.value === value);
  if (found) return found;
  // Check saved tags
  const saved = savedTags?.find(t => t.name === value);
  if (saved) {
    return { value, label: value, color: '', style: { background: saved.color + '33', color: saved.color } };
  }
  // Fallback: generate consistent color
  const hash = Array.from(value).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const hue = ((hash % 360) + 360) % 360;
  return {
    value,
    label: value,
    color: '',
    style: { background: `hsla(${hue},60%,40%,0.2)`, color: `hsl(${hue},60%,65%)` },
  };
}
