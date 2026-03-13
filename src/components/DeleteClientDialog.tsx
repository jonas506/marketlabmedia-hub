import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DeleteClientDialogProps {
  clientId: string;
  clientName: string;
}

const DeleteClientDialog: React.FC<DeleteClientDialogProps> = ({ clientId, clientName }) => {
  const [showAlert, setShowAlert] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients-dashboard"] });
      toast.success(`"${clientName}" wurde gelöscht`);
      setShowConfirmDialog(false);
      setNameInput("");
    },
    onError: () => {
      toast.error("Fehler beim Löschen des Kunden");
    },
  });

  const nameMatches = nameInput.trim().toLowerCase() === clientName.trim().toLowerCase();

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShowAlert(true);
        }}
        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
        title="Kunde löschen"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Step 1: Initial confirmation */}
      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kunde wirklich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du bist dabei, <strong className="text-foreground">{clientName}</strong> und alle zugehörigen Daten
              (Content, Aufgaben, Checklisten, etc.) unwiderruflich zu löschen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowConfirmDialog(true);
              }}
            >
              Ja, weiter zur Bestätigung
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: Type name to confirm */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        if (!open) {
          setShowConfirmDialog(false);
          setNameInput("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Endgültige Bestätigung</DialogTitle>
            <DialogDescription>
              Gib den Namen des Kunden ein, um das Löschen zu bestätigen:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm font-medium text-destructive text-center">
              {clientName}
            </div>
            <Input
              placeholder="Kundenname eingeben…"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmDialog(false);
                setNameInput("");
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={!nameMatches || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Wird gelöscht…" : "Unwiderruflich löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DeleteClientDialog;
