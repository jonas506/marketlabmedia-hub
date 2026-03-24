import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCategories } from "./useCategories";
import { CATEGORY_COLORS, COLOR_CLASSES } from "./constants";

interface CategoryManagerProps {
  clientId: string;
}

const CategoryManager: React.FC<CategoryManagerProps> = React.memo(({ clientId }) => {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(clientId);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");

  const addCat = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) return;
      const { error } = await supabase.from("story_categories" as any).insert({ client_id: clientId, name: newName.trim(), color: newColor, scope: "sequence" } as any);
      if (error) throw error;
    },
    onSuccess: () => { setNewName(""); qc.invalidateQueries({ queryKey: ["story-categories", clientId] }); toast.success("Kategorie erstellt"); },
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("story_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["story-categories", clientId] }),
  });

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground"><Settings className="h-3.5 w-3.5" /></Button></DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle className="font-display text-sm">Kategorien</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", COLOR_CLASSES[cat.color] || "bg-muted text-muted-foreground")}>{cat.name}</span>
              <button onClick={() => deleteCat.mutate(cat.id)} className="text-muted-foreground hover:text-destructive transition-colors"><X className="h-3 w-3" /></button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Keine Kategorien.</p>}
          <div className="space-y-2 border-t border-border pt-3">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name..." className="h-7 text-xs" onKeyDown={(e) => e.key === "Enter" && addCat.mutate()} />
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-1">
                {CATEGORY_COLORS.map(c => (
                  <button key={c} onClick={() => setNewColor(c)} className={cn("h-4 w-4 rounded-full transition-all", COLOR_CLASSES[c]?.split(" ")[0], newColor === c ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "")} />
                ))}
              </div>
              <Button size="sm" className="text-xs h-7 gap-1" onClick={() => addCat.mutate()} disabled={!newName.trim()}><Plus className="h-3 w-3" /> Hinzufügen</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

CategoryManager.displayName = "CategoryManager";

export default CategoryManager;
