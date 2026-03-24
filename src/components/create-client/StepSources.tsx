import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, FileText, Upload, X } from "lucide-react";

interface StepSourcesProps {
  urls: string[];
  onAddUrl: (url: string) => void;
  onRemoveUrl: (index: number) => void;
  pdfNames: string[];
  onPdfUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemovePdf: (index: number) => void;
  freeText: string;
  onFreeTextChange: (text: string) => void;
}

const StepSources: React.FC<StepSourcesProps> = ({ urls, onAddUrl, onRemoveUrl, pdfNames, onPdfUpload, onRemovePdf, freeText, onFreeTextChange }) => {
  const [currentUrl, setCurrentUrl] = React.useState("");

  const addUrl = () => {
    const trimmed = currentUrl.trim();
    if (!trimmed) return;
    const formatted = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    onAddUrl(formatted);
    setCurrentUrl("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Globe className="h-3.5 w-3.5" /> Website-Links</Label>
        <div className="flex gap-2">
          <Input value={currentUrl} onChange={(e) => setCurrentUrl(e.target.value)} placeholder="https://beispiel.de"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addUrl())} className="bg-background/50" />
          <button type="button" onClick={addUrl} className="px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">+</button>
        </div>
        {urls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {urls.map((url, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                {new URL(url).hostname}
                <X className="h-3 w-3 cursor-pointer" onClick={() => onRemoveUrl(i)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><FileText className="h-3.5 w-3.5" /> PDF-Dokumente</Label>
        <div className="relative">
          <input type="file" accept=".pdf" multiple onChange={onPdfUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
            <Upload className="h-4 w-4" /> PDFs hier ablegen oder klicken
          </div>
        </div>
        {pdfNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pdfNames.map((name, i) => (
              <Badge key={i} variant="secondary" className="gap-1 text-xs">
                {name}
                <X className="h-3 w-3 cursor-pointer" onClick={() => onRemovePdf(i)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><FileText className="h-3.5 w-3.5" /> Eigene Notizen</Label>
        <Textarea value={freeText} onChange={(e) => onFreeTextChange(e.target.value)} placeholder="Was weißt du bereits über den Kunden?" rows={4} className="bg-background/50" />
      </div>
    </div>
  );
};

export default React.memo(StepSources);
