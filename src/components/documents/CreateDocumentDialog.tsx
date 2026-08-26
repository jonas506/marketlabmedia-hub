import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { FileText, Loader2, Search, Send, Upload, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  name: string | null;
  contact_name: string | null;
  contact_email: string | null;
}

async function sha256(file: File) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const DEFAULT_BODY = `anbei findest du unser Angebot als PDF.

Wenn alles passt, kannst du es direkt über den Button unten verbindlich annehmen — ganz ohne Ausdrucken oder Unterschrift.

Bei Fragen melde dich jederzeit.`;

export default function CreateDocumentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(DEFAULT_BODY);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("crm_leads")
      .select("id, name, contact_name, contact_email")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setLeads((data as Lead[]) ?? []));
  }, [open]);

  const reset = () => {
    setFile(null);
    setTitle("");
    setSubject("");
    setBody(DEFAULT_BODY);
    setRecipientName("");
    setRecipientEmail("");
    setLeadId(null);
    setExpiresAt("");
  };

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ title: "Nur PDF-Dateien", variant: "destructive" });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: "Datei zu groß (max. 50 MB)", variant: "destructive" });
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
    if (!subject) setSubject(`Dein Angebot: ${f.name.replace(/\.pdf$/i, "")}`);
  };

  const submit = async (send: boolean) => {
    if (!file) return toast({ title: "Bitte PDF auswählen", variant: "destructive" });
    if (!title.trim()) return toast({ title: "Titel fehlt", variant: "destructive" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim()))
      return toast({ title: "Gültige E-Mail nötig", variant: "destructive" });
    if (!subject.trim()) return toast({ title: "Betreff fehlt", variant: "destructive" });

    setBusy(true);
    try {
      const hash = await sha256(file);
      const path = `${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data: userData } = await supabase.auth.getUser();
      const { data: doc, error: insErr } = await supabase
        .from("signature_documents")
        .insert({
          title: title.trim(),
          file_path: path,
          file_name: file.name,
          file_hash: hash,
          file_size: file.size,
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientEmail.trim(),
          lead_id: leadId,
          subject: subject.trim(),
          message_body: body,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          created_by: userData.user?.id ?? null,
          status: "draft",
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      if (send) {
        const { data, error } = await supabase.functions.invoke("document-send", {
          body: { documentId: doc.id, appUrl: window.location.origin },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        toast({ title: "Dokument versendet", description: recipientEmail });
      } else {
        toast({ title: "Als Entwurf gespeichert" });
      }

      reset();
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast({ title: "Fehler", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neues Dokument zur Freigabe</DialogTitle>
          <DialogDescription>
            PDF hochladen, Empfänger wählen und per Mail zur verbindlichen Annahme verschicken.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Upload */}
          {file ? (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-4">
              <FileText className="h-5 w-5 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFile(null)} className="h-9 w-9">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-sm transition-colors ${
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="font-medium">PDF hierher ziehen oder klicken</span>
              <span className="text-xs text-muted-foreground">max. 50 MB</span>
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          <div>
            <Label htmlFor="doc-title">Titel</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="mt-1.5"
              placeholder="Angebot Basic — Muster GmbH"
            />
          </div>

          {/* Recipient */}
          <div className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <Label>Empfänger</Label>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                    <Search className="h-3.5 w-3.5" /> Aus CRM wählen
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[320px] p-0" align="end">
                  <Command>
                    <CommandInput placeholder="Lead suchen..." />
                    <CommandList>
                      <CommandEmpty>Kein Lead gefunden.</CommandEmpty>
                      {leads.map((l) => (
                        <CommandItem
                          key={l.id}
                          value={`${l.name ?? ""} ${l.contact_name ?? ""} ${l.contact_email ?? ""}`}
                          onSelect={() => {
                            setLeadId(l.id);
                            setRecipientName(l.contact_name || l.name || "");
                            setRecipientEmail(l.contact_email || "");
                            setPickerOpen(false);
                          }}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm">{l.name || l.contact_name || "Ohne Namen"}</div>
                            <div className="truncate text-xs text-muted-foreground">{l.contact_email || "keine E-Mail"}</div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="rec-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="rec-name"
                  value={recipientName}
                  onChange={(e) => {
                    setRecipientName(e.target.value);
                    setLeadId(null);
                  }}
                  maxLength={120}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="rec-mail" className="text-xs text-muted-foreground">
                  E-Mail
                </Label>
                <Input
                  id="rec-mail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    setLeadId(null);
                  }}
                  maxLength={255}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="doc-subject">E-Mail-Betreff</Label>
            <Input
              id="doc-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="doc-body">Begleittext</Label>
            <Textarea
              id="doc-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={3000}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="doc-exp">Gültig bis (optional)</Label>
            <Input
              id="doc-exp"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Abbrechen
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={busy}>
            Als Entwurf speichern
          </Button>
          <Button onClick={() => submit(true)} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Senden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
