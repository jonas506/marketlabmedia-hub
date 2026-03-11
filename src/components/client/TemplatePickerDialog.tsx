import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Layout, Globe, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: { id: string; name: string; html_content: string }) => void;
  onBlank: () => void;
}

const TemplatePickerDialog = ({ open, onOpenChange, onSelect, onBlank }: TemplatePickerDialogProps) => {
  const { data: templates, isLoading } = useQuery({
    queryKey: ["landing-page-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_page_templates" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" />
            Landing Page erstellen
          </DialogTitle>
          <DialogDescription>
            Starte mit einer Vorlage oder erstelle eine leere Seite.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 max-h-[400px] overflow-y-auto">
          {/* Blank page option */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBlank}
            className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/20 transition-all min-h-[160px]"
          >
            <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Leere Seite</p>
              <p className="text-[11px] text-muted-foreground">Mit KI-Chat starten</p>
            </div>
          </motion.button>

          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[160px] rounded-xl bg-muted/50 animate-pulse" />
            ))
          ) : (
            templates?.map((tpl) => (
              <motion.button
                key={tpl.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(tpl)}
                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/20 transition-all min-h-[160px] text-left"
              >
                {tpl.preview_image_url ? (
                  <img
                    src={tpl.preview_image_url}
                    alt={tpl.name}
                    className="w-full h-20 object-cover rounded-lg bg-muted"
                  />
                ) : (
                  <div className="w-full h-20 rounded-lg bg-muted/50 flex items-center justify-center">
                    <Globe className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="w-full">
                  <p className="text-sm font-medium truncate">{tpl.name}</p>
                  {tpl.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{tpl.description}</p>
                  )}
                  {tpl.category && (
                    <span className="inline-block mt-1.5 text-[10px] bg-muted rounded-full px-2 py-0.5">
                      {tpl.category}
                    </span>
                  )}
                </div>
              </motion.button>
            ))
          )}
        </div>

        {!isLoading && (!templates || templates.length === 0) && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Noch keine Vorlagen gespeichert. Erstelle eine Landing Page und speichere sie als Vorlage.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TemplatePickerDialog;
