import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { icons } from "lucide-react";
import { PIPELINE_CONFIG } from "./constants";
import type { ContentPiece } from "./types";

interface PipelineTypeTabsProps {
  activeType: string;
  onTypeChange: (type: string) => void;
  contentPieces: ContentPiece[];
  month: number;
  year: number;
}

const PipelineTypeTabs: React.FC<PipelineTypeTabsProps> = React.memo(({
  activeType,
  onTypeChange,
  contentPieces,
  month,
  year,
}) => {
  return (
    <Tabs value={activeType} onValueChange={onTypeChange} className="mb-4">
      <TabsList className="h-auto flex-wrap bg-muted/50 gap-0.5 p-1">
        {Object.entries(PIPELINE_CONFIG).map(([key, cfg]) => {
          const typeCount = contentPieces.filter((c) => c.type === key && c.target_month === month && c.target_year === year).length;
          const Icon = icons[cfg.emoji as keyof typeof icons];
          return (
            <TabsTrigger key={key} value={key} className="text-xs sm:text-sm gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {Icon && <Icon size={15} />}
              <span className="hidden sm:inline">{cfg.label}</span>
              <span className="rounded-full bg-background/50 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-mono">{typeCount}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
});

PipelineTypeTabs.displayName = "PipelineTypeTabs";

export default PipelineTypeTabs;
