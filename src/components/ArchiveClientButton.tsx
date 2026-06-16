import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

interface ArchiveClientButtonProps {
  clientId: string;
  clientName: string;
  isArchived: boolean;
}

const ArchiveClientButton: React.FC<ArchiveClientButtonProps> = ({ clientId, clientName, isArchived }) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({ status: isArchived ? "active" : "archived" })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-dashboard"] });
      toast.success(isArchived ? `"${clientName}" wiederhergestellt` : `"${clientName}" archiviert`);
    },
    onError: () => toast.error("Aktion fehlgeschlagen"),
  });

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
      title={isArchived ? "Kunde wiederherstellen" : "Kunde archivieren"}
    >
      {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
    </button>
  );
};

export default ArchiveClientButton;
