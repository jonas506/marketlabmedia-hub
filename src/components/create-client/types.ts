import { Building2, Users, Trophy, MessageSquare, Lightbulb } from "lucide-react";

export interface ClientProfile {
  name: string;
  industry: string;
  target_audience: string;
  usps: string;
  tonality: string;
  content_topics: string;
  summary: string;
  logo_url?: string;
}

export const PROFILE_SECTIONS = [
  { key: "industry", label: "Branche", icon: Building2, color: "from-blue-500/20 to-blue-600/10", iconColor: "text-blue-400" },
  { key: "target_audience", label: "Zielgruppe", icon: Users, color: "from-emerald-500/20 to-emerald-600/10", iconColor: "text-emerald-400" },
  { key: "usps", label: "USPs", icon: Trophy, color: "from-amber-500/20 to-amber-600/10", iconColor: "text-amber-400" },
  { key: "tonality", label: "Tonalität", icon: MessageSquare, color: "from-purple-500/20 to-purple-600/10", iconColor: "text-purple-400" },
  { key: "content_topics", label: "Content-Themen", icon: Lightbulb, color: "from-pink-500/20 to-pink-600/10", iconColor: "text-pink-400" },
] as const;

export const TOTAL_STEPS = 5;

export const STEP_TITLES: Record<number, string> = {
  1: "Quellen hinzufügen",
  2: "KI-Kundenprofil",
  3: "Basis & Branding",
  4: "Vertrag & Kontingent",
  5: "Strategie & Abschluss",
};

export const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Lade PDFs, Links oder Notizen hoch – die KI analysiert den Kunden.",
  2: "Das KI-generierte Profil. Klicke auf ein Feld zum Bearbeiten.",
  3: "Kontaktdaten und Branding-Material des Kunden.",
  4: "Leistungen, Kontingente und Vertragsdetails festlegen.",
  5: "Strategie definieren, Freigabe-Benachrichtigungen und Status.",
};
