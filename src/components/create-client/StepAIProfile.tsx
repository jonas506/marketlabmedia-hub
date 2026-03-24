import React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Building2, PenLine, Target } from "lucide-react";
import { motion } from "framer-motion";
import { ClientProfile, PROFILE_SECTIONS } from "./types";

interface StepAIProfileProps {
  profile: ClientProfile;
  onProfileChange: (profile: ClientProfile) => void;
  editingField: string | null;
  onEditField: (field: string | null) => void;
}

const StepAIProfile: React.FC<StepAIProfileProps> = ({ profile, onProfileChange, editingField, onEditField }) => {
  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            {editingField === "name" ? (
              <Input value={profile.name} onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
                onBlur={() => onEditField(null)} onKeyDown={(e) => e.key === "Enter" && onEditField(null)}
                autoFocus className="text-lg font-bold bg-background/50 h-9" />
            ) : (
              <h3 className="text-lg font-display font-bold cursor-pointer hover:text-primary transition-colors group flex items-center gap-2"
                onClick={() => onEditField("name")}>
                {profile.name}
                <PenLine className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </h3>
            )}
            <p className="text-[11px] text-muted-foreground mt-0.5">KI-generiertes Kundenprofil</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROFILE_SECTIONS.map(({ key, label, icon: Icon, color, iconColor }, i) => (
          <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-xl bg-gradient-to-br ${color} border border-border/30 p-3.5 group cursor-pointer hover:border-border/60 transition-all`}
            onClick={() => editingField !== key && onEditField(key)}>
            <div className="flex items-start gap-2.5 mb-2">
              <div className="w-7 h-7 rounded-lg bg-background/40 flex items-center justify-center flex-shrink-0">
                <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
                <PenLine className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
              </div>
            </div>
            {editingField === key ? (
              <Input value={profile[key]} onChange={(e) => onProfileChange({ ...profile, [key]: e.target.value })}
                onBlur={() => onEditField(null)} onKeyDown={(e) => e.key === "Enter" && onEditField(null)}
                autoFocus className="text-sm bg-background/50 h-8" />
            ) : (
              <p className="text-sm leading-relaxed text-foreground/90">
                {profile[key] || <span className="text-muted-foreground italic">Nicht erkannt</span>}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-xl bg-gradient-to-br from-muted/50 to-muted/20 border border-border/30 p-4 group cursor-pointer hover:border-border/60 transition-all"
        onClick={() => editingField !== "summary" && onEditField("summary")}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-background/40 flex items-center justify-center">
            <Target className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Zusammenfassung</span>
          <PenLine className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
        {editingField === "summary" ? (
          <Textarea value={profile.summary} onChange={(e) => onProfileChange({ ...profile, summary: e.target.value })}
            onBlur={() => onEditField(null)} autoFocus rows={3} className="text-sm bg-background/50" />
        ) : (
          <p className="text-sm leading-relaxed text-foreground/80">
            {profile.summary || <span className="text-muted-foreground italic">Keine Zusammenfassung</span>}
          </p>
        )}
      </motion.div>
    </div>
  );
};

export default React.memo(StepAIProfile);
