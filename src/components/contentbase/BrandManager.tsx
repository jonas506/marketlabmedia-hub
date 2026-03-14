import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Brand {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  colors: string[];
  logos: string[];
  guides: string[];
  created_at: string;
  updated_at: string;
}

interface Props {
  userId: string;
  onClose: () => void;
}

export default function BrandManager({ userId, onClose }: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const guideRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("cb_brands").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    const list = (data as Brand[]) || [];
    setBrands(list);
    if (!activeBrand && list.length > 0) setActiveBrand(list[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createBrand = async () => {
    const { data } = await supabase.from("cb_brands").insert({ user_id: userId, name: "Neue Marke" } as any).select("*").single();
    if (data) { const b = data as Brand; setBrands((prev) => [b, ...prev]); setActiveBrand(b); }
  };

  const saveBrand = async (b: Brand) => {
    setSaving(true);
    await supabase.from("cb_brands").update({ name: b.name, description: b.description, colors: b.colors as any, logos: b.logos, guides: b.guides } as any).eq("id", b.id);
    setBrands((prev) => prev.map((x) => (x.id === b.id ? b : x)));
    setSaving(false);
  };

  const deleteBrand = async (id: string) => {
    if (!confirm("Marke wirklich löschen?")) return;
    await supabase.from("cb_brands").delete().eq("id", id);
    setBrands((prev) => prev.filter((x) => x.id !== id));
    if (activeBrand?.id === id) setActiveBrand(brands.length > 1 ? brands.find((x) => x.id !== id) || null : null);
  };

  const uploadFile = async (file: File, type: "logos" | "guides") => {
    if (!activeBrand) return;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${activeBrand.id}/${type}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file);
    if (error) { console.error("Upload error:", error); return; }
    const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
    const updated = { ...activeBrand, [type]: [...activeBrand[type], data.publicUrl] };
    setActiveBrand(updated);
    saveBrand(updated);
  };

  const removeFile = (type: "logos" | "guides", idx: number) => {
    if (!activeBrand) return;
    const updated = { ...activeBrand, [type]: activeBrand[type].filter((_: any, i: number) => i !== idx) };
    setActiveBrand(updated);
    saveBrand(updated);
  };

  const updateField = (field: string, value: any) => {
    if (!activeBrand) return;
    setActiveBrand({ ...activeBrand, [field]: value });
  };

  const addColor = () => { if (!activeBrand) return; setActiveBrand({ ...activeBrand, colors: [...activeBrand.colors, "#3b82f6"] }); };
  const updateColor = (idx: number, val: string) => { if (!activeBrand) return; const colors = [...activeBrand.colors]; colors[idx] = val; setActiveBrand({ ...activeBrand, colors }); };
  const removeColor = (idx: number) => { if (!activeBrand) return; setActiveBrand({ ...activeBrand, colors: activeBrand.colors.filter((_: any, i: number) => i !== idx) }); };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="w-56 border-r border-border bg-background flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Marken / CI</h2>
            <button className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground border-none cursor-pointer hover:opacity-85" onClick={createBrand}>+ Neu</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {loading && <span className="text-xs text-muted-foreground p-2">Laden…</span>}
            {brands.map((b) => (
              <button key={b.id} className={`text-left px-3 py-2 rounded-lg text-xs font-medium border-none cursor-pointer transition-all ${activeBrand?.id === b.id ? "bg-primary/10 text-primary" : "bg-transparent text-muted-foreground hover:bg-muted/20 hover:text-foreground"}`} onClick={() => setActiveBrand(b)}>
                <div className="flex items-center gap-2">
                  {b.logos.length > 0 ? <img src={b.logos[0]} alt="" className="w-5 h-5 rounded object-contain" /> : <span className="w-5 h-5 rounded bg-muted/30 flex items-center justify-center text-[10px]">●</span>}
                  <span className="truncate">{b.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">{activeBrand ? activeBrand.name : "Marke auswählen"}</h3>
            <div className="flex items-center gap-2">
              {saving && <span className="text-[10px] text-muted-foreground">Speichern…</span>}
              {activeBrand && (
                <>
                  <button className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground border-none cursor-pointer hover:opacity-85" onClick={() => activeBrand && saveBrand(activeBrand)}>Speichern</button>
                  <button className="text-xs px-2 py-1 rounded bg-destructive/10 text-destructive border border-destructive/20 cursor-pointer hover:bg-destructive/20" onClick={() => activeBrand && deleteBrand(activeBrand.id)}>✕</button>
                </>
              )}
              <button className="text-xs text-muted-foreground hover:text-foreground cursor-pointer bg-transparent border-none" onClick={onClose}>✕</button>
            </div>
          </div>
          {activeBrand ? (
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Markenname</label>
                <input className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-primary" value={activeBrand.name} onChange={(e) => updateField("name", e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Brand Guide / Textbeschreibung</label>
                <textarea className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm outline-none focus:border-primary resize-y" rows={5} placeholder="Beschreibe Tonalität, Zielgruppe, Markenwerte…" value={activeBrand.description || ""} onChange={(e) => updateField("description", e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Markenfarben</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {activeBrand.colors.map((c: string, i: number) => (
                    <div key={i} className="flex items-center gap-1 group/color">
                      <input type="color" value={c} onChange={(e) => updateColor(i, e.target.value)} className="w-8 h-8 rounded cursor-pointer border border-border" />
                      <span className="text-[10px] text-muted-foreground font-mono">{c}</span>
                      <button className="text-[10px] text-muted-foreground hover:text-destructive cursor-pointer bg-transparent border-none opacity-0 group-hover/color:opacity-100" onClick={() => removeColor(i)}>✕</button>
                    </div>
                  ))}
                  <button className="w-8 h-8 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer bg-transparent" onClick={addColor}>+</button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Logos & SVGs</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {activeBrand.logos.map((url: string, i: number) => (
                    <div key={i} className="relative group/logo w-16 h-16 rounded-lg border border-border overflow-hidden bg-white flex items-center justify-center">
                      <img src={url} alt="" className="max-w-full max-h-full object-contain" />
                      <button className="absolute inset-0 bg-black/50 text-white text-xs opacity-0 group-hover/logo:opacity-100 cursor-pointer border-none flex items-center justify-center" onClick={() => removeFile("logos", i)}>✕</button>
                    </div>
                  ))}
                  <button className="w-16 h-16 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer bg-transparent flex-col gap-0.5" onClick={() => logoRef.current?.click()}>
                    <span className="text-lg">+</span><span className="text-[9px]">Logo</span>
                  </button>
                </div>
                <input ref={logoRef} type="file" accept="image/*,.svg" multiple className="hidden" onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach((f) => uploadFile(f, "logos")); e.target.value = ""; }} />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">Brand Guides / Dokumente</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {activeBrand.guides.map((url: string, i: number) => (
                    <div key={i} className="relative group/guide">
                      <div className="w-20 h-20 rounded-lg border border-border bg-muted/10 flex flex-col items-center justify-center gap-1">
                        <span className="text-lg">📄</span>
                        <span className="text-[8px] text-muted-foreground truncate max-w-[70px]">{url.split("/").pop()?.split("?")[0]}</span>
                      </div>
                      <button className="absolute inset-0 bg-black/50 text-white text-xs opacity-0 group-hover/guide:opacity-100 cursor-pointer border-none rounded-lg flex items-center justify-center" onClick={() => removeFile("guides", i)}>✕</button>
                    </div>
                  ))}
                  <button className="w-20 h-20 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary cursor-pointer bg-transparent flex-col gap-0.5" onClick={() => guideRef.current?.click()}>
                    <span className="text-lg">+</span><span className="text-[9px]">Guide</span>
                  </button>
                </div>
                <input ref={guideRef} type="file" accept="image/*,.svg,.pdf,.doc,.docx" multiple className="hidden" onChange={(e) => { if (e.target.files) Array.from(e.target.files).forEach((f) => uploadFile(f, "guides")); e.target.value = ""; }} />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center"><p className="text-sm text-muted-foreground">Erstelle eine Marke, um zu starten</p></div>
          )}
        </div>
      </div>
    </div>
  );
}
