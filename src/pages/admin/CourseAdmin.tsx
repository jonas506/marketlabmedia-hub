import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Mail, Loader2 } from "lucide-react";

interface Module {
  id: string;
  title: string;
  description: string | null;
  drive_file_id: string | null;
  thumbnail_url: string | null;
  sort_order: number;
  duration_seconds: number | null;
  is_published: boolean;
}

function extractDriveId(input: string): string {
  if (!input) return "";
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const p of patterns) {
    const m = input.match(p);
    if (m) return m[1];
  }
  return input.trim();
}

const CourseAdmin = () => {
  const { user, role, loading } = useAuth();
  const [modules, setModules] = useState<Module[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Module | null>(null);
  const [form, setForm] = useState({ title: "", description: "", drive_file_id: "", thumbnail_url: "", duration_seconds: "", is_published: true });
  const [invite, setInvite] = useState({ email: "", full_name: "", client_id: "" });
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const [{ data: mods }, { data: studs }, { data: cls }] = await Promise.all([
      supabase.from("course_modules").select("*").order("sort_order"),
      supabase.from("course_students").select("*").order("invited_at", { ascending: false }),
      supabase.from("clients").select("id,name").order("name"),
    ]);
    setModules((mods || []) as Module[]);
    setStudents(studs || []);
    setClients(cls || []);
  };

  useEffect(() => { if (user && role === "admin") refresh(); }, [user, role]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== "admin") return <div className="p-8 text-muted-foreground">Nur für Admins.</div>;

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", drive_file_id: "", thumbnail_url: "", duration_seconds: "", is_published: true });
    setDlgOpen(true);
  };
  const openEdit = (m: Module) => {
    setEditing(m);
    setForm({
      title: m.title, description: m.description || "", drive_file_id: m.drive_file_id || "",
      thumbnail_url: m.thumbnail_url || "",
      duration_seconds: m.duration_seconds ? String(m.duration_seconds) : "",
      is_published: m.is_published,
    });
    setDlgOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Titel erforderlich");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      drive_file_id: extractDriveId(form.drive_file_id) || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      duration_seconds: form.duration_seconds ? Number(form.duration_seconds) : null,
      is_published: form.is_published,
    };
    if (editing) {
      const { error } = await supabase.from("course_modules").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const nextOrder = modules.length ? Math.max(...modules.map((m) => m.sort_order)) + 1 : 0;
      const { error } = await supabase.from("course_modules").insert({ ...payload, sort_order: nextOrder });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    toast.success("Gespeichert");
    setSaving(false);
    setDlgOpen(false);
    refresh();
  };

  const del = async (m: Module) => {
    if (!confirm(`Modul „${m.title}" löschen?`)) return;
    await supabase.from("course_modules").delete().eq("id", m.id);
    refresh();
  };

  const move = async (m: Module, dir: -1 | 1) => {
    const idx = modules.findIndex((x) => x.id === m.id);
    const swap = modules[idx + dir];
    if (!swap) return;
    await Promise.all([
      supabase.from("course_modules").update({ sort_order: swap.sort_order }).eq("id", m.id),
      supabase.from("course_modules").update({ sort_order: m.sort_order }).eq("id", swap.id),
    ]);
    refresh();
  };

  const doInvite = async () => {
    if (!invite.email.trim()) return toast.error("E-Mail erforderlich");
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("invite-course-student", {
      body: { email: invite.email.trim(), full_name: invite.full_name.trim() || null, client_id: invite.client_id || null },
    });
    setSaving(false);
    if (error || data?.error) return toast.error(error?.message || data?.error);
    toast.success(data?.existing ? "Teilnehmer freigeschaltet" : "Einladung verschickt");
    setInviteOpen(false);
    setInvite({ email: "", full_name: "", client_id: "" });
    refresh();
  };

  const removeStudent = async (userId: string) => {
    if (!confirm("Teilnehmer entfernen?")) return;
    await supabase.from("course_students").delete().eq("user_id", userId);
    refresh();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-display font-semibold mb-6">Videokurs</h1>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">Module</TabsTrigger>
          <TabsTrigger value="students">Teilnehmer</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={openNew} size="sm" className="gap-1"><Plus className="h-4 w-4" /> Neues Modul</Button>
          </div>
          <div className="space-y-2">
            {modules.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <span className="font-mono text-xs text-muted-foreground w-8">{String(i + 1).padStart(2, "0")}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(m)} className="text-sm font-semibold hover:underline truncate">{m.title}</button>
                    {!m.is_published && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">ENTWURF</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.drive_file_id || "Kein Video verknüpft"}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => move(m, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => move(m, 1)} disabled={i === modules.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => del(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
            {modules.length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">Noch keine Module.</p>}
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setInviteOpen(true)} size="sm" className="gap-1"><Mail className="h-4 w-4" /> Einladen</Button>
          </div>
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {students.map((s) => {
              const client = clients.find((c) => c.id === s.client_id);
              return (
                <div key={s.user_id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name || s.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}{client ? ` · ${client.name}` : ""}</p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{s.activated_at ? "Aktiv" : "Eingeladen"}</span>
                  <Button size="icon" variant="ghost" onClick={() => removeStudent(s.user_id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              );
            })}
            {students.length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">Noch keine Teilnehmer.</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Module dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Modul bearbeiten" : "Neues Modul"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label className="text-xs">Beschreibung</Label><Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label className="text-xs">Google Drive Link oder File-ID</Label><Input value={form.drive_file_id} onChange={(e) => setForm({ ...form, drive_file_id: e.target.value })} placeholder="https://drive.google.com/file/d/..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Thumbnail-URL</Label><Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
              <div><Label className="text-xs">Dauer (Sek.)</Label><Input type="number" value={form.duration_seconds} onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} /><Label className="text-sm">Veröffentlicht</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Abbrechen</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Teilnehmer einladen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">E-Mail</Label><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></div>
            <div><Label className="text-xs">Name (optional)</Label><Input value={invite.full_name} onChange={(e) => setInvite({ ...invite, full_name: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Kunde (optional)</Label>
              <select className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm" value={invite.client_id} onChange={(e) => setInvite({ ...invite, client_id: e.target.value })}>
                <option value="">–</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">Der Teilnehmer bekommt eine Einladungs-E-Mail zum Passwort setzen.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Abbrechen</Button>
            <Button onClick={doInvite} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Einladung senden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CourseAdmin;
