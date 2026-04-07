export const CRM_STAGES = [
  { value: 'erstkontakt', label: 'Erstkontakt', color: '#6B7280' },
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

export function getSourceInfo(value: string | null) {
  return CRM_SOURCES.find(s => s.value === value) ?? null;
}
