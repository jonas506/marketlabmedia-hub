import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Pencil, Check, X } from "lucide-react";

interface BrandingSectionProps {
  client: {
    id: string;
    drive_branding_link: string | null;
    drive_logo_link: string | null;
    drive_styleguide_link: string | null;
  };
  canEdit: boolean;
}

const links = [
  { key: "drive_branding_link" as const, label: "Branding-Ordner" },
  { key: "drive_logo_link" as const, label: "Logo" },
  { key: "drive_styleguide_link" as const, label: "Style Guide" },
];

const BrandingSection: React.FC<BrandingSectionProps> = ({ client, canEdit }) => {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({
    drive_branding_link: client.drive_branding_link ?? "",
    drive_logo_link: client.drive_logo_link ?? "",
    drive_styleguide_link: client.drive_styleguide_link ?? "",
  });
  const qc = useQueryClient();

  const save = async () => {
    await supabase.from("clients").update(values).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    setEditing(false);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground">BRANDING</h2>
        {canEdit && !editing && (
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {editing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={save}><Check className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {links.map(({ key, label }) =>
          editing ? (
            <div key={key} className="flex-1 min-w-[200px] space-y-1">
              <label className="font-body text-xs text-muted-foreground">{label}</label>
              <Input
                value={values[key]}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                placeholder="https://..."
                className="bg-background border-border font-body text-sm"
              />
            </div>
          ) : (
            values[key] || client[key] ? (
              <a
                key={key}
                href={client[key] ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 font-body text-sm text-foreground hover:border-primary/30 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                {label}
              </a>
            ) : null
          )
        )}
        {!editing && !client.drive_branding_link && !client.drive_logo_link && !client.drive_styleguide_link && (
          <p className="font-mono text-xs text-muted-foreground">KEINE LINKS HINTERLEGT</p>
        )}
      </div>
    </section>
  );
};

export default BrandingSection;
