import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Filter, Plus, Sparkles, ListPlus, icons } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PipelineConfig, TeamMember } from "./types";

interface PipelineFilterBarProps {
  filterPerson: string;
  onFilterChange: (person: string) => void;
  team: TeamMember[];
  selectedCount: number;
  canBulkMove: boolean;
  onBulkMove: () => void;
  bulkMovePending: boolean;
  nextPhaseEmoji: string;
  nextPhaseLabel: string;

  canEdit: boolean;
  onAddPiece: () => void;
  addPiecePending: boolean;
  config: PipelineConfig;
  // Bulk create
  bulkOpen: boolean;
  onBulkOpenChange: (open: boolean) => void;
  bulkTitles: string;
  onBulkTitlesChange: (titles: string) => void;
  onBulkCreate: () => void;
  bulkCreatePending: boolean;
  firstPhaseLabel: string;
}

const PipelineFilterBar: React.FC<PipelineFilterBarProps> = React.memo(({
  filterPerson,
  onFilterChange,
  team,
  selectedCount,
  canBulkMove,
  onBulkMove,
  bulkMovePending,
  nextPhaseEmoji,
  nextPhaseLabel,
  canEdit,
  onAddPiece,
  addPiecePending,
  config,
  bulkOpen,
  onBulkOpenChange,
  bulkTitles,
  onBulkTitlesChange,
  onBulkCreate,
  bulkCreatePending,
  firstPhaseLabel,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={filterPerson} onValueChange={onFilterChange}>
        <SelectTrigger className="h-8 sm:h-9 w-28 sm:w-40 text-xs sm:text-sm"><SelectValue placeholder="Person" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Alle</SelectItem>
          {team.map((t) => (
            <SelectItem key={t.user_id} value={t.user_id}>{t.name || t.email}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1" />

      <AnimatePresence>
        {selectedCount > 0 && canBulkMove && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 text-xs sm:text-sm font-semibold shadow-lg shadow-primary/20"
              onClick={onBulkMove}
              disabled={bulkMovePending}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{selectedCount} →</span>
              <span className="sm:hidden">{selectedCount}→</span>
              {(() => { const NIcon = icons[nextPhaseEmoji as keyof typeof icons]; return NIcon ? <NIcon size={14} /> : null; })()}{" "}
              <span className="hidden sm:inline">{nextPhaseLabel}</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {canEdit && (
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm h-8 sm:h-9" onClick={onAddPiece} disabled={addPiecePending}>
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{config.addLabel}</span><span className="sm:hidden">Neu</span>
          </Button>
          <Dialog open={bulkOpen} onOpenChange={onBulkOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" title="Mehrere auf einmal erstellen">
                <ListPlus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                 <DialogTitle className="flex items-center gap-2">
                   {(() => { const TIcon = icons[config.emoji as keyof typeof icons]; return TIcon ? <TIcon size={18} /> : null; })()} Mehrere {config.label} erstellen
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ein Titel pro Zeile. Kopiere z.B. die Titel aus deinem Google Sheet.
                </p>
                <Textarea
                  placeholder={"Karussell 1: Thema A\nKarussell 2: Thema B\nKarussell 3: Thema C\n..."}
                  value={bulkTitles}
                  onChange={(e) => onBulkTitlesChange(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
                {bulkTitles.trim() && (
                  <p className="text-xs text-muted-foreground font-mono">
                    {bulkTitles.split("\n").filter(l => l.trim()).length} Pieces werden erstellt → Phase „{firstPhaseLabel}"
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => onBulkOpenChange(false)}>Abbrechen</Button>
                <Button onClick={onBulkCreate} disabled={bulkCreatePending} className="gap-2">
                  <ListPlus className="h-4 w-4" />
                  {bulkCreatePending ? "Erstelle..." : "Alle erstellen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
});

PipelineFilterBar.displayName = "PipelineFilterBar";

export default PipelineFilterBar;
