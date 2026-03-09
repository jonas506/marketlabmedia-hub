import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";

const CreateClientDialog = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reels, setReels] = useState(0);
  const [carousels, setCarousels] = useState(0);
  const [stories, setStories] = useState(0);
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").insert({
        name,
        monthly_reels: reels,
        monthly_carousels: carousels,
        monthly_stories: stories,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients-dashboard"] });
      toast.success("Kunde erstellt");
      setOpen(false);
      setName("");
      setReels(0);
      setCarousels(0);
      setStories(0);
    },
    onError: (err: Error) => {
      toast.error("Fehler: " + err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Kunde
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuen Kunden anlegen</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kundenname"
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="reels">Reels / Monat</Label>
              <Input
                id="reels"
                type="number"
                min={0}
                value={reels}
                onChange={(e) => setReels(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carousels">Carousels / Monat</Label>
              <Input
                id="carousels"
                type="number"
                min={0}
                value={carousels}
                onChange={(e) => setCarousels(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stories">Stories / Monat</Label>
              <Input
                id="stories"
                type="number"
                min={0}
                value={stories}
                onChange={(e) => setStories(Number(e.target.value))}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending || !name.trim()}>
            {mutation.isPending ? "Wird erstellt…" : "Kunde anlegen"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateClientDialog;
