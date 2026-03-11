import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Pencil, Check, X, Upload, Trash2, FileImage, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface CIAsset {
  name: string;
  url: string;
  path: string;
  type: string;
}

interface BrandingSectionProps {
  client: {
    id: string;
    name: string;
    logo_url: string | null;
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

  const downloadFile = async (url: string, filename: string) => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast.error("Download fehlgeschlagen");
    }
  };

  const save = async () => {
    await supabase.from("clients").update(values).eq("id", client.id);
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    setEditing(false);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-6"
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept="image/*,.svg,.pdf,.ai,.eps,.ttf,.otf,.woff,.woff2"
        onChange={(e) => handleUpload(e.target.files)}
      />

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
            <FileImage className="h-4.5 w-4.5 text-primary" />
          </div>
          <h2 className="font-display text-base font-semibold">Branding & CI</h2>
        </div>
        <div className="flex gap-1.5">
          {canEdit && !editing && (
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Bearbeiten
            </Button>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Hochladen
            </Button>
          )}
          {editing && (
            <>
              <Button variant="default" size="sm" className="h-8 gap-1" onClick={save}><Check className="h-3.5 w-3.5" /> Speichern</Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
            </>
          )}
        </div>
      </div>

      {/* Logo prominent display */}
      {client.logo_url && (
        <div className="mb-5 flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
          <img
            src={client.logo_url}
            alt={`${client.name} Logo`}
            className="h-16 w-16 rounded-xl object-contain bg-background p-2 ring-1 ring-border"
          />
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-semibold">{client.name} — Logo</p>
            <p className="text-xs text-muted-foreground mt-0.5">Automatisch von Website extrahiert</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={() => downloadFile(client.logo_url!, `${client.name}-logo.png`)}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      )}

      {/* CI Assets Grid */}
      {(ciAssets.length > 0 || loadingAssets) && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">CI-Dateien</p>
          {loadingAssets ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Laden...
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {ciAssets.map((asset) => (
                <div
                  key={asset.path}
                  className="group relative flex flex-col items-center gap-2 rounded-xl border border-border bg-background p-4 hover:border-primary/30 transition-all cursor-pointer"
                  onClick={() => downloadFile(asset.url, asset.name.replace(/^\d+-/, ""))}
                >
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      className="h-14 w-14 rounded-lg object-contain bg-muted"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                      <FileImage className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-xs text-center truncate w-full text-foreground font-medium">{asset.name.replace(/^\d+-/, "")}</span>
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="h-6 w-6 rounded-md bg-background/80 border border-border flex items-center justify-center hover:bg-muted"
                      onClick={(e) => { e.stopPropagation(); downloadFile(asset.url, asset.name.replace(/^\d+-/, "")); }}
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteAsset(asset); }}
                        className="h-6 w-6 rounded-md bg-destructive/10 border border-destructive/20 flex items-center justify-center hover:bg-destructive/20"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick upload drop zone when empty */}
      {ciAssets.length === 0 && !loadingAssets && !client.logo_url && canEdit && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full mb-5 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors p-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <Upload className="h-6 w-6" />
          <span className="text-sm font-medium">CI-Dateien hochladen</span>
          <span className="text-xs text-muted-foreground">Logo, Styleguide, Schriften, etc.</span>
        </button>
      )}

      {/* External Links */}
      <div className="flex flex-wrap gap-3">
        {links.map(({ key, label }) =>
          editing ? (
            <div key={key} className="flex-1 min-w-[200px] space-y-1.5">
              <label className="font-body text-xs font-medium text-muted-foreground">{label}</label>
              <Input
                value={values[key]}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                placeholder="https://..."
                className="bg-background border-border font-body text-sm h-10"
              />
            </div>
          ) : (
            values[key] || client[key] ? (
              <a
                key={key}
                href={client[key] ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-lg border border-border bg-background px-4 py-2.5 font-body text-sm text-foreground hover:border-primary/30 hover:bg-muted/30 transition-all"
              >
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                {label}
              </a>
            ) : null
          )
        )}
      </div>
    </motion.section>
  );
};

export default BrandingSection;
