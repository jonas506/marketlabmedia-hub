export type PositioningFormData = { industry: string; revenue: string; company: string; name: string; email: string; phone: string };

export function isStepComplete(step: number, form: PositioningFormData) {
  if (step === 1) return Boolean(form.industry.trim());
  if (step === 2) return Boolean(form.revenue.trim());
  if (step === 3) return [form.company, form.name, form.phone].every(value => Boolean(value.trim())) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  return false;
}