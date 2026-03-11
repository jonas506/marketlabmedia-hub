import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Globe, Plus, ExternalLink, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { motion } from "framer-motion";
import TemplatePickerDialog from "./TemplatePickerDialog";

interface LandingPagesListProps {
  clientId: string;
  canEdit: boolean;
}

const LandingPagesList = ({ clientId, canEdit }: LandingPagesListProps) => {
  const qc = useQueryClient();

  const { data: pages, isLoading } = useQuery({
    queryKey: ["landing-pages", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deletePage = async (id: string) => {
    if (!confirm("Landing Page wirklich löschen?")) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) toast.error("Fehler beim Löschen");
    else {
      toast.success("Landing Page gelöscht");
      qc.invalidateQueries({ queryKey: ["landing-pages", clientId] });
    }
  };

  const togglePublish = async (id: string, current: boolean) => {
    const { error } = await supabase.from("landing_pages").update({ is_published: !current }).eq("id", id);
    if (error) toast.error("Fehler");
    else {
      qc.invalidateQueries({ queryKey: ["landing-pages", clientId] });
      toast.success(!current ? "Landing Page veröffentlicht" : "Landing Page auf Entwurf gesetzt");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <h2 className="font-display text-base font-semibold">Landing Pages</h2>
        </div>
        {canEdit && (
          <Link to={`/client/${clientId}/landing-page`}>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Neue Landing Page
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <div className="p-6 flex justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : !pages?.length ? (
        <div className="p-8 text-center">
          <Globe className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Noch keine Landing Pages erstellt</p>
          {canEdit && (
            <Link to={`/client/${clientId}/landing-page`}>
              <Button size="sm" variant="outline" className="mt-3 h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Erste Landing Page erstellen
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {pages.map((page, i) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors group"
            >
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-muted shrink-0">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  to={`/client/${clientId}/landing-page?page=${page.id}`}
                  className="text-sm font-medium hover:text-primary transition-colors truncate block"
                >
                  {page.title}
                </Link>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(page.created_at), "dd. MMM yyyy", { locale: de })}</span>
                  {page.custom_domain && (
                    <span className="font-mono text-[10px]">• {page.custom_domain}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => togglePublish(page.id, page.is_published)}
                    >
                      {page.is_published ? (
                        <Eye className="h-3.5 w-3.5 text-[hsl(var(--runway-green))]" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => deletePage(page.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
              <div
                className={`h-2 w-2 rounded-full shrink-0 ${
                  page.is_published ? "bg-[hsl(var(--runway-green))]" : "bg-muted-foreground/30"
                }`}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LandingPagesList;
