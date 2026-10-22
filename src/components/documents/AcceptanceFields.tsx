import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PAYMENT_VARIANTS } from '@/lib/offer-acceptance';

export default function AcceptanceFields({ role, onRoleChange, payment, onPaymentChange }: {
  role: string; onRoleChange: (value: string) => void;
  payment: string; onPaymentChange: (value: string) => void;
}) {
  return <div className="mt-4 space-y-4 text-foreground">
    <div>
      <Label htmlFor="company-role">Funktion im Unternehmen *</Label>
      <Input id="company-role" required maxLength={120} value={role} onChange={(event) => onRoleChange(event.target.value)} placeholder="z. B. Geschäftsführer" className="mt-2 h-12" />
    </div>
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Zahlungsvariante *</legend>
      <RadioGroup aria-label="Zahlungsvariante" value={payment} onValueChange={onPaymentChange} required>
        {Object.entries(PAYMENT_VARIANTS).map(([value, label]) => <Label key={value} htmlFor={`payment-${value}`} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border bg-background p-3 leading-relaxed">
          <RadioGroupItem id={`payment-${value}`} value={value} className="shrink-0" />
          <span>{label}</span>
        </Label>)}
      </RadioGroup>
    </fieldset>
  </div>;
}