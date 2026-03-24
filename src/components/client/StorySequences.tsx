import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "lucide-react";
import { motion } from "framer-motion";
import { SequenceList, SequenceEditor, CategoryManager, StoryDashboard } from "./stories";

interface Props {
  clientId: string;
  canEdit: boolean;
}

export default function StorySequences({ clientId, canEdit }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sequences");

  if (selectedId) {
    return <SequenceEditor sequenceId={selectedId} clientId={clientId} canEdit={canEdit} onBack={() => setSelectedId(null)} />;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5 shadow-lg">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <h3 className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">STORIES</h3>
          </div>
          <div className="flex items-center gap-2">
            <TabsList className="bg-muted/50 h-7">
              <TabsTrigger value="sequences" className="text-[10px] h-6 px-2.5">Sequenzen</TabsTrigger>
              <TabsTrigger value="dashboard" className="text-[10px] h-6 px-2.5">Dashboard</TabsTrigger>
            </TabsList>
            {canEdit && <CategoryManager clientId={clientId} />}
          </div>
        </div>
        <TabsContent value="sequences" className="mt-0">
          <SequenceList clientId={clientId} canEdit={canEdit} onSelect={setSelectedId} />
        </TabsContent>
        <TabsContent value="dashboard" className="mt-0">
          <StoryDashboard clientId={clientId} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
