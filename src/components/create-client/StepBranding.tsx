import React, { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Globe, Folder, FileImage, BookOpen, Upload, X, Image } from "lucide-react";

interface StepBrandingProps {
  data: {
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    websiteUrl: string;
    driveBrandingLink: string;
    driveLogoLink: string;
    driveStyleguideLink: string;
  };
  onUpdate: (field: string, value: string) => void;
  brandingFiles: File[];
  onBrandingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBrandingFile: (index: number) => void;
}

const StepBranding: React.FC<StepBrandingProps> = ({ data, onUpdate, brandingFiles, onBrandingUpload, onRemoveBrandingFile }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-5">
      <div>
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          <User className="h-3.5 w-3.5" /> Kontaktdaten
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ansprechpartner</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={data.contactName} onChange={(e) => onUpdate("contactName", e.target.value)} placeholder="Max Mustermann" className="pl-9 bg-background/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">E-Mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={data.contactEmail} onChange={(e) => onUpdate("contactEmail", e.target.value)} placeholder="max@firma.de" type="email" className="pl-9 bg-background/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telefon</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={data.contactPhone} onChange={(e) => onUpdate("contactPhone", e.target.value)} placeholder="+49 123 456789" className="pl-9 bg-background/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={data.websiteUrl} onChange={(e) => onUpdate("websiteUrl", e.target.value)} placeholder="https://firma.de" className="pl-9 bg-background/50" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          <Image className="h-3.5 w-3.5" /> Branding & CI
        </Label>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Branding-Ordner</Label>
              <div className="relative">
                <Folder className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={data.driveBrandingLink} onChange={(e) => onUpdate("driveBrandingLink", e.target.value)} placeholder="Drive-Link" className="pl-9 bg-background/50 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Logo</Label>
              <div className="relative">
                <FileImage className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={data.driveLogoLink} onChange={(e) => onUpdate("driveLogoLink", e.target.value)} placeholder="Logo-Link" className="pl-9 bg-background/50 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Style Guide</Label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={data.driveStyleguideLink} onChange={(e) => onUpdate("driveStyleguideLink", e.target.value)} placeholder="Styleguide-Link" className="pl-9 bg-background/50 text-xs" />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">CI-Assets hochladen (PDFs, SVGs, Bilder)</Label>
            <div className="relative">
              <input ref={fileRef} type="file" accept=".pdf,.svg,.png,.jpg,.jpeg,.webp" multiple onChange={onBrandingUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 p-3 text-sm text-muted-foreground hover:bg-muted/30 transition-colors">
                <Upload className="h-4 w-4" /> Dateien hochladen
              </div>
            </div>
            {brandingFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {brandingFiles.map((f, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    <FileImage className="h-3 w-3" /> {f.name}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => onRemoveBrandingFile(i)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(StepBranding);
