import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Tag, X } from "lucide-react";

interface StepContractProps {
  contractStart: string;
  setContractStart: (v: string) => void;
  contractDuration: string;
  setContractDuration: (v: string) => void;
  monthlyPrice: number | "";
  setMonthlyPrice: (v: number | "") => void;
  additionalProducts: string[];
  setAdditionalProducts: React.Dispatch<React.SetStateAction<string[]>>;
  services: string[];
  setServices: React.Dispatch<React.SetStateAction<string[]>>;
  reels: number; setReels: (v: number) => void;
  carousels: number; setCarousels: (v: number) => void;
  stories: number; setStories: (v: number) => void;
  youtubeLongform: number; setYoutubeLongform: (v: number) => void;
}

const SERVICE_OPTIONS = [
  { key: "shortform", label: "Shortform / Reels", emoji: "🎬" },
  { key: "carousels", label: "Karussells", emoji: "🖼️" },
  { key: "stories", label: "Story Ads", emoji: "📱" },
  { key: "youtube_longform", label: "YouTube Longform", emoji: "🎥" },
  { key: "website", label: "Website", emoji: "🌐" },
];

const StepContract: React.FC<StepContractProps> = ({
  contractStart, setContractStart, contractDuration, setContractDuration,
  monthlyPrice, setMonthlyPrice, additionalProducts, setAdditionalProducts,
  services, setServices, reels, setReels, carousels, setCarousels,
  stories, setStories, youtubeLongform, setYoutubeLongform,
}) => {
  const [productInput, setProductInput] = React.useState("");

  const addProduct = () => {
    const v = productInput.trim();
    if (v) { setAdditionalProducts(prev => [...prev, v]); setProductInput(""); }
  };

  return (
    <div className="space-y-5">
      <div>
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          <Calendar className="h-3.5 w-3.5" /> Vertragsdaten
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Vertragsbeginn</Label>
            <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className="bg-background/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Laufzeit</Label>
            <Input value={contractDuration} onChange={(e) => setContractDuration(e.target.value)} placeholder="z.B. 12 Monate" className="bg-background/50" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Preis / Monat (€)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value ? Number(e.target.value) : "")} placeholder="0" className="pl-9 bg-background/50" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          <Tag className="h-3.5 w-3.5" /> Zusatzprodukte
        </Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {additionalProducts.map((p, i) => (
            <Badge key={i} variant="secondary" className="gap-1 text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={() => setAdditionalProducts(prev => prev.filter((_, j) => j !== i))}>
              {p} <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
        <Input value={productInput} onChange={(e) => setProductInput(e.target.value)} placeholder="Neues Produkt + Enter"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addProduct(); } }} className="bg-background/50" />
      </div>

      <div>
        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Leistungen</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SERVICE_OPTIONS.map(({ key, label, emoji }) => {
            const active = services.includes(key);
            return (
              <button key={key} type="button"
                onClick={() => setServices(prev => active ? prev.filter(s => s !== key) : [...prev, key])}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-all ${
                  active ? "border-primary bg-primary/10 text-foreground shadow-sm shadow-primary/10"
                    : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:border-border"
                }`}>
                <span className="text-base">{emoji}</span>
                <span className="font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {services.length > 0 && (
        <div>
          <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Monatliches Kontingent</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {services.includes("shortform") && (
              <div className="rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-600/5 border border-border/30 p-3 space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reels / Monat</Label>
                <Input type="number" min={0} value={reels} onChange={(e) => setReels(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
              </div>
            )}
            {services.includes("carousels") && (
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-border/30 p-3 space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Karussells / Monat</Label>
                <Input type="number" min={0} value={carousels} onChange={(e) => setCarousels(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
              </div>
            )}
            {services.includes("stories") && (
              <div className="rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-600/5 border border-border/30 p-3 space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Story Ads / Monat</Label>
                <Input type="number" min={0} value={stories} onChange={(e) => setStories(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
              </div>
            )}
            {services.includes("youtube_longform") && (
              <div className="rounded-xl bg-gradient-to-br from-red-500/15 to-red-600/5 border border-border/30 p-3 space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">YouTube Videos / Monat</Label>
                <Input type="number" min={0} value={youtubeLongform} onChange={(e) => setYoutubeLongform(Number(e.target.value))} className="bg-background/50 text-center text-lg font-bold h-10" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(StepContract);
