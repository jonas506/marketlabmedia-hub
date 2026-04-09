import React, { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { FolderDown, Loader2, FileVideo, Image, FileText, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { PIPELINE_CONFIG } from "./constants";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  thumbnailLink?: string;
  size?: string;
  folder?: string | null;
}

interface DriveImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  activeType: string;
  onImportComplete: () => void;
}

const extractFolderId = (input: string): string | null => {
  const trimmed = input.trim();
  // Direct ID (no slashes, no dots)
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  // URL patterns
  const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
};

const fileIcon = (mime: string) => {
  if (mime.startsWith("video/")) return <FileVideo className="h-4 w-4 text-rose-500" />;
  if (mime.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf") return <FileText className="h-4 w-4 text-amber-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
};

const formatSize = (bytes: string | undefined) => {
  if (!bytes) return "";
  const mb = parseInt(bytes) / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(parseInt(bytes) / 1024).toFixed(0)} KB`;
};

const DriveImportDialog: React.FC<DriveImportDialogProps> = ({
  open, onOpenChange, clientId, activeType, onImportComplete,
}) => {
  const [folderUrl, setFolderUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [alreadyImported, setAlreadyImported] = useState<Set<string>>(new Set());
  const [targetPhase, setTargetPhase] = useState("review");
  const [targetType, setTargetType] = useState(activeType);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const phases = PIPELINE_CONFIG[targetType]?.phases ?? [];

  const fetchFiles = useCallback(async () => {
    const folderId = extractFolderId(folderUrl);
    if (!folderId) {
      toast.error("Ungültiger Drive-Link", { description: "Bitte einen Google Drive Ordner-Link einfügen" });
      return;
    }
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) { toast.error("Nicht eingeloggt"); setLoading(false); return; }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/drive-list-files?folder_id=${encodeURIComponent(folderId)}`,
        { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
      );
      const result = await res.json();
      if (result.error) { toast.error(result.error); setLoading(false); return; }
      
      // Show Drive API error if present
      if (result.drive_error) {
        const errMsg = result.drive_error?.message || JSON.stringify(result.drive_error);
        if (errMsg.includes("notFound") || errMsg.includes("404")) {
          toast.error("Ordner nicht gefunden oder kein Zugriff", {
            description: result.service_account_email 
              ? `Teile den Ordner mit: ${result.service_account_email}`
              : "Stelle sicher, dass der Ordner mit dem Service Account geteilt ist.",
            duration: 10000,
          });
          setLoading(false);
          return;
        }
      }
      
      const allFiles = result.files ?? [];
      const mediaFiles = allFiles.filter((f: DriveFile) =>
        f.mimeType.startsWith("video/") || 
        f.mimeType.startsWith("image/") || 
        f.mimeType === "application/pdf" ||
        f.mimeType === "application/postscript" ||
        f.mimeType === "application/x-photoshop" ||
        f.mimeType === "application/octet-stream" ||
        f.mimeType === "application/vnd.google-apps.video" ||
        f.mimeType === "application/vnd.google-apps.photo" ||
        f.mimeType === "application/vnd.google-apps.drawing"
      );
      const filesToShow = mediaFiles.length > 0 ? mediaFiles : allFiles;

      // Check which files are already imported
      const driveIds = filesToShow.map((f: DriveFile) => f.id);
      const { data: existingPieces } = await supabase
        .from("content_pieces")
        .select("drive_file_id")
        .eq("client_id", clientId)
        .in("drive_file_id", driveIds);
      
      const alreadySet = new Set((existingPieces ?? []).map(p => p.drive_file_id).filter(Boolean) as string[]);
      setAlreadyImported(alreadySet);

      setFiles(filesToShow);
      // Only pre-select NEW files
      setSelectedFiles(new Set(filesToShow.filter((f: DriveFile) => !alreadySet.has(f.id)).map((f: DriveFile) => f.id)));
      
      const newCount = filesToShow.length - alreadySet.size;
      if (allFiles.length === 0) {
        toast.error("Keine Dateien im Ordner gefunden", {
          description: result.service_account_email 
            ? `Stelle sicher, dass der Ordner mit ${result.service_account_email} geteilt ist.`
            : "Stelle sicher, dass der Ordner mit dem Service Account geteilt ist.",
          duration: 10000,
        });
      } else if (alreadySet.size > 0 && newCount > 0) {
        toast.success(`${newCount} neue Dateien gefunden`, {
          description: `${alreadySet.size} bereits importiert`,
        });
      } else if (alreadySet.size > 0 && newCount === 0) {
        toast.info("Alle Dateien wurden bereits importiert");
      }
    } catch (err: any) {
      toast.error("Fehler beim Laden", { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [folderUrl]);

  const handleImport = useCallback(async () => {
    const toImport = files.filter(f => selectedFiles.has(f.id));
    if (toImport.length === 0) { toast.error("Keine Dateien ausgewählt"); return; }

    setImporting(true);
    try {
      const rows = toImport.map(f => ({
        client_id: clientId,
        type: targetType,
        phase: targetPhase,
        target_month: currentMonth,
        target_year: currentYear,
        title: f.name.replace(/\.[^/.]+$/, ""),
        preview_link: f.webViewLink,
        drive_file_id: f.id,
        drive_file_name: f.name,
        drive_uploaded_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from("content_pieces").insert(rows);
      if (error) throw error;

      toast.success(`🎬 ${toImport.length} Pieces importiert`, {
        description: `In "${phases.find(p => p.key === targetPhase)?.label ?? targetPhase}"`,
      });
      onImportComplete();
      onOpenChange(false);
      setFiles([]);
      setFolderUrl("");
      setSelectedFiles(new Set());
    } catch (err: any) {
      toast.error("Import fehlgeschlagen", { description: err.message });
    } finally {
      setImporting(false);
    }
  }, [files, selectedFiles, clientId, targetType, targetPhase, currentMonth, currentYear, phases, onImportComplete, onOpenChange]);

  const toggleFile = (id: string) => {
    setSelectedFiles(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const selectableFiles = files.filter(f => !alreadyImported.has(f.id));

  const toggleAll = () => {
    if (selectedFiles.size === selectableFiles.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(selectableFiles.map(f => f.id)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderDown className="h-5 w-5 text-primary" />
            Aus Drive importieren
          </DialogTitle>
          <DialogDescription>
            Füge einen Google Drive Ordner-Link ein — jede Datei wird als eigenes Piece erstellt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Step 1: Folder URL */}
          <div className="flex gap-2">
            <Input
              placeholder="https://drive.google.com/drive/folders/..."
              value={folderUrl}
              onChange={(e) => setFolderUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchFiles()}
              className="flex-1 text-sm"
            />
            <Button onClick={fetchFiles} disabled={loading || !folderUrl.trim()} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Laden"}
            </Button>
          </div>

          {/* Step 2: Configure */}
          {files.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Typ</label>
                  <Select value={targetType} onValueChange={(v) => {
                    setTargetType(v);
                    setTargetPhase(PIPELINE_CONFIG[v]?.phases[0]?.key ?? "script");
                  }}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PIPELINE_CONFIG).map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Ziel-Phase</label>
                  <Select value={targetPhase} onValueChange={setTargetPhase}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map(p => (
                        <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* File list */}
              <div className="flex items-center justify-between">
                <button onClick={toggleAll} className="text-xs text-primary hover:underline">
                  {selectedFiles.size === selectableFiles.length ? "Keine auswählen" : "Alle neuen auswählen"}
                </button>
                <span className="text-xs text-muted-foreground">
                  {selectedFiles.size} neu / {alreadyImported.size} bereits importiert
                </span>
              </div>

              <div className="overflow-y-auto flex-1 space-y-1 max-h-[300px] pr-1">
                {files.map(f => {
                  const isImported = alreadyImported.has(f.id);
                  return (
                    <label
                      key={f.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        isImported 
                          ? "bg-muted/20 border border-transparent opacity-60 cursor-default"
                          : selectedFiles.has(f.id) 
                            ? "bg-primary/5 border border-primary/20 cursor-pointer" 
                            : "bg-muted/30 border border-transparent hover:bg-muted/50 cursor-pointer"
                      )}
                    >
                      <Checkbox
                        checked={isImported || selectedFiles.has(f.id)}
                        disabled={isImported}
                        onCheckedChange={() => !isImported && toggleFile(f.id)}
                      />
                      {fileIcon(f.mimeType)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{f.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          {isImported && <span className="bg-green-500/10 text-green-600 px-1.5 py-0.5 rounded font-medium">✓ Importiert</span>}
                          {f.folder && <span className="bg-muted px-1.5 py-0.5 rounded">{f.folder}</span>}
                          {f.size && <span>{formatSize(f.size)}</span>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <Button onClick={handleImport} disabled={importing || selectedFiles.size === 0} className="w-full">
                {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FolderDown className="h-4 w-4 mr-2" />}
                {selectedFiles.size} Pieces importieren
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DriveImportDialog;
