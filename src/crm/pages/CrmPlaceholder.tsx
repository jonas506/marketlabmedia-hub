import { Construction } from "lucide-react";

export default function CrmPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-crm-muted">
      <Construction className="w-12 h-12 mb-4 opacity-30" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm mt-1">Coming soon</p>
    </div>
  );
}
