import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Pencil, Check, X, Upload, Trash2, FileImage, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CIAsset {
  name: string;
  url: string;
  path: string;
  type: string;
}

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
  const [ciAssets, setCiAssets] = useState<CIAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // Load existing CI assets from storage
  useEffect(() => {
    loadCIAssets();
  }, [client.id]);

  const loadCIAssets = async () => {
    setLoadingAssets(true);
    try {
      const { data, error } = await supabase.storage
        .from("landing-page-assets")
        .list(`${client.id}/ci`, { limit: 100 });

      if (error) throw error;

      const assets: CIAsset[] = (data || [])
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((file) => {
          const path = `${client.id}/ci/${file.name}`;
          const { data: urlData } = supabase.storage.from("landing-page-assets").getPublicUrl(path);
          return {
            name: file.name,
            url: urlData.publicUrl,
            path,
            type: file.metadata?.mimetype?.startsWith("image/") ? "image" : "file",
          };
        });

      setCiAssets(assets);
    } catch {
      // Folder might not exist yet
      setCiAssets([]);
    } finally {
      setLoadingAssets(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    let uploaded = 0;
    for (const file of Array.from(files)) {
      const path = `${client.id}/ci/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("landing-page-assets").upload(path, file);
      if (error) {
        toast.error(`Upload fehlgeschlagen: ${file.name}`);
        continue;
      }
      uploaded++;
    }

    if (uploaded > 0) {
      toast.success(`${uploaded} Datei(en) hochgeladen`);
      await loadCIAssets();
    }
    setIsUploading(false);
  };

  const deleteAsset = async (asset: CIAsset) => {
    const { error } = await supabase.storage.from("landing-page-assets").remove([asset.path]);
    if (error) {
      toast.error("Fehler beim Löschen");
      return;
    }
    setCiAssets((prev) => prev.filter((a) => a.path !== asset.path));
    toast.success("Datei gelöscht");
  };

  const save = async () => {
    await supabase.from("clients").update(values).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    setEditing(false);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.svg,.pdf,.ai,.eps,.ttf,.otf,.woff,.woff2"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold tracking-widest text-muted-foreground">BRANDING & CI</h2>
        <div className="flex gap-1">
          {canEdit && !editing && (
            <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </Button>
          )}
          {editing && (
            <>
              <Button variant="ghost" size="icon" onClick={save}><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setEditing(false)}><X className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      </div>

      {/* CI Assets Grid */}
      {(ciAssets.length > 0 || loadingAssets) && (
        <div className="mb-4">
          <p className="text-[11px] font-medium text-muted-foreground mb-2">CI-Dateien</p>
          {loadingAssets ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Laden...
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {ciAssets.map((asset) => (
                <div
                  key={asset.path}
                  className="group relative flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs"
                >
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="h-8 w-8 rounded object-contain bg-muted"
                    />
                  ) : (
                    <FileImage className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="max-w-[120px] truncate text-foreground">{asset.name.replace(/^\d+-/, "")}</span>
                  {canEdit && (
                    <button
                      onClick={() => deleteAsset(asset)}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick upload drop zone when empty */}
      {ciAssets.length === 0 && !loadingAssets && canEdit && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mb-4 rounded-lg border-2 border-dashed border-border hover:border-primary/40 transition-colors p-4 flex flex-col items-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-5 w-5" />
          <span className="text-xs">CI-Dateien hochladen (Logo, Styleguide, Schriften…)</span>
        </button>
      )}

      {/* External Links */}
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
      </div>
    </section>
  );
};

export default BrandingSection;
