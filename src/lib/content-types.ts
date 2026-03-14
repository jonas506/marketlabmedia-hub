export const CTYPES = [
  { id: "linkedin", label: "LinkedIn Post", icon: "Li", color: "#0077b5", isImage: false },
  { id: "instagram", label: "Insta Caption", icon: "Ig", color: "#e1306c", isImage: false },
  { id: "carousel", label: "Insta Carousel", icon: "Ca", color: "#f97316", isImage: false },
  { id: "story", label: "Insta Story", icon: "St", color: "#a855f7", isImage: false },
  { id: "tweet", label: "Tweet / X", icon: "X", color: "#1da1f2", isImage: false },
  { id: "image", label: "KI-Bild", icon: "Img", color: "#ea580c", isImage: true },
] as const;

export type ContentTypeId = typeof CTYPES[number]["id"];

export const DEMOS: Record<string, (i: string) => string> = {
  linkedin: (i) =>
    `Ich möchte heute offen über "${i}" sprechen.\n\nNach intensiver Auseinandersetzung damit sind mir 3 Dinge klar geworden:\n\n1. Die Basics sind alles\n2. Konsistenz > Kreativität\n3. Community multipliziert\n\nWas ist eure Erfahrung?`,
  instagram: (i) =>
    `${i} hat alles verändert.\n\nManchmal braucht es nur eine Idee.\n\n#${i.split(" ")[0].toLowerCase()} #inspiration #content`,
  carousel: (i) =>
    `Slide 1: "${i}" – Was du wissen musst\nAlles beginnt mit einem Schritt.\n\nSlide 2: Das Problem\nViele kennen es, wenige lösen es.\n\nSlide 3: Die Lösung\n${i} gibt den Rahmen.\n\nSlide 4: Der Beweis\nZahlen & Fakten überzeugen.\n\nSlide 5: Dein nächster Schritt\nJetzt handeln!`,
  story: (i) => `${i}\nKennst du das?\n→ Swipe up`,
  tweet: (i) =>
    `1. ${i} ist der Gamechanger 2025. Wer nicht handelt, verpasst den Zug.\n\n2. Das Geheimnis von ${i}? Einfacher als gedacht. Schwieriger als gewollt.\n\n3. Nicht fragen warum ${i}. Fragen wie. Der Rest folgt.`,
  image: (i) =>
    `Cinematic wide shot, "${i}" concept. Golden hour light, dramatic shadows, shallow depth of field. Editorial photography, rich color grading, high contrast, rule of thirds. Shot on Hasselblad medium format, 8K.`,
};

export const PROMPTS: Record<string, (i: string) => string> = {
  linkedin: (i) =>
    `Schreibe einen professionellen LinkedIn-Post auf Deutsch zum Thema: "${i}". Starker Einstieg, 3 Punkte, CTA. Ca. 200 Wörter.`,
  instagram: (i) =>
    `Instagram-Caption auf Deutsch zu: "${i}". Emotional, mit Hashtags, max. 250 Zeichen.`,
  carousel: (i) =>
    `5 Slide-Texte für Instagram Carousel auf Deutsch zu: "${i}". Je kurze Überschrift + 1-2 Sätze. Nummeriert.`,
  story: (i) =>
    `Instagram Story Text auf Deutsch zu: "${i}". Max. 3 Zeilen, CTA, emoji-freundlich.`,
  tweet: (i) =>
    `3 Tweets auf Deutsch zu: "${i}". Max. 280 Zeichen je. Nummeriert 1. 2. 3.`,
  image: (i) =>
    `Detailed Midjourney/Stable Diffusion prompt in English for: "${i}". Include lighting, style, mood, composition. 60-80 words.`,
};

export interface CanvasNode {
  id: string;
  type: "idea" | "content" | "image" | "htmlimage" | "model" | "text" | "sticky" | "zone";
  x: number;
  y: number;
  idea?: string;
  content?: string;
  ctype?: string;
  model?: string;
  loading?: boolean;
  imageUrl?: string | null;
  prompt?: string;
  width?: number;
  height?: number;
  color?: string;
  label?: string;
  referenceImages?: string[];
  brandId?: string;
  text?: string;
  zoneLabel?: string;
  fontSize?: number;
  stickyColor?: string;
  format?: string;
}

export interface Connection {
  id: string;
  f: string;
  t: string;
}

export const NODE_W: Record<string, number> = { idea: 270, content: 250, image: 200, htmlimage: 300, model: 185, text: 200, sticky: 160, zone: 280 };
export const NODE_H: Record<string, number> = { idea: 170, content: 160, image: 220, htmlimage: 340, model: 90, text: 40, sticky: 140, zone: 600 };

let _nid = Date.now();
export const genId = () => `n${++_nid}`;
