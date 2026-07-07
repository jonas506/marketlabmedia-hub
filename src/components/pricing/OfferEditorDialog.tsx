import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Send, Save, Eye } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  offerId: string | null;
}

export default function OfferEditorDialog({ open, onClose, offerId }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!open || !offerId) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("offers").select("*").eq("id", offerId).single();
      if (data) {
        setSubject(data.subject);
        setBody(data.custom_body);
        setRecipientEmail(data.recipient_email);
      }
      setLoading(false);
    })();
  }, [open, offerId]);

  const save = async () => {
    if (!offerId) return;
    const { error } = await supabase.from("offers").update({
      subject, custom_body: body, recipient_email: recipientEmail,
    }).eq("id", offerId);
    if (error) toast({ title: "Fehler", description: error.message, variant: "destructive" });
    else toast({ title: "Entwurf gespeichert" });
  };

  const send = async () => {
    if (!offerId) return;
    setSending(true);
    try {
      await save();
      const { data, error } = await supabase.functions.invoke("offer-send", {
        body: { offerId, appUrl: window.location.origin },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Angebot gesendet", description: `An ${recipientEmail}` });
      onClose();
    } catch (e: any) {
      toast({ title: "Senden fehlgeschlagen", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Angebot bearbeiten & senden</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Lade Entwurf…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Empfänger E-Mail</Label>
                <Input value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} type="email" />
              </div>
              <div>
                <Label className="text-xs">Betreff</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="text-xs">Angebotstext (HTML)</Label>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setPreview((p) => !p)}>
                  <Eye className="mr-1 h-3 w-3" /> {preview ? "Bearbeiten" : "Vorschau"}
                </Button>
              </div>
              {preview ? (
                <div
                  className="min-h-[320px] rounded-md border bg-background p-4 text-sm prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              ) : (
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={18}
                  className="font-mono text-xs"
                />
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">
                HTML erlaubt. Der „Angebot annehmen"-Button wird automatisch am Ende ergänzt.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Abbrechen</Button>
          <Button variant="secondary" onClick={save} disabled={sending}>
            <Save className="mr-2 h-4 w-4" /> Als Entwurf speichern
          </Button>
          <Button onClick={send} disabled={sending || !recipientEmail}>
            <Send className="mr-2 h-4 w-4" /> {sending ? "Sendet…" : "An Kunde senden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
