import { z } from 'zod';

export type Weg = 'a' | 'b';
export interface Station { key: string; name: string; q: string; a: [string, string, string]; t: [string, string, string]; }
export interface WegDef { label: string; score: string; leck: string; call: { h: string; t: string }; questions: Station[]; typ: (t: number) => { name: string; text: string }; }

export const VC = {
  weiche: {
    q: 'Schaltet ihr schon Werbung auf Instagram oder Facebook?',
    a: ['Ja, die laufen schon', 'Noch nicht, wir wollen anfangen', 'Nein, kommt für uns nicht infrage'],
  },
  wege: {
    a: {
      label: 'Weg A (schaltet Ads)',
      score: 'Social-Media-Score', leck: 'Größtes Leck',
      call: { h: 'Eure Kampagnen live durchgehen', t: 'In 30 Minuten schauen wir uns eure Kampagnen gemeinsam im Werbekonto an und ich gehe mit euch die konkreten Lösungsvorschläge für eure roten Stationen durch. Kostenlos und unverbindlich.' },
      questions: [
        { key: 'anzeigen', name: 'Anzeigen', q: 'Wie oft bringt ihr neue Anzeigen raus?', a: ['Selten bis nie', 'Alle paar Monate', 'Jeden Monat'], t: [
          'Dieselben Anzeigen laufen zu lange. Meta spielt sie immer teurer aus, jede Anfrage kostet mehr.',
          'Alle paar Monate ist zu selten. Die besten Vertriebe testen jeden Monat neue Hooks und Videos.',
          'Ihr testet regelmäßig. Damit findet ihr Gewinner-Anzeigen schneller als die meisten.'] },
        { key: 'cockpit', name: 'Cockpit', q: 'Woran messt ihr, ob eure Anzeigen gut laufen?', a: ['Gar nicht genau', 'An den Kosten pro Lead', 'An den Kosten pro Termin oder Verkauf'], t: [
          'Ihr wisst nicht, ob eure Anzeigen gut sind. Damit lässt sich nichts gezielt verbessern.',
          'Kosten pro Lead sagen wenig. Entscheidend ist, was ein Termin kostet, der stattfindet.',
          'Ihr steuert nach Zahlen. Damit lässt sich jeder Euro Werbung skalieren.'] },
        { key: 'filter', name: 'Filter', q: 'Wie viele Anfragen passen wirklich zu eurem Angebot?', a: ['Kaum welche', 'Etwa die Hälfte', 'Die meisten'], t: [
          'Eure Anzeigen ziehen die falschen Leute an. Eure Berater telefonieren Interessenten hinterher, die nie kaufen können.',
          'Jede zweite Anfrage ist umsonst. Das sind Stunden, die euren Beratern für echte Kunden fehlen.',
          'Eure Anfragen passen. Damit seid ihr weiter als die meisten.'] },
        { key: 'vertrauen', name: 'Vertrauen', q: 'Was sieht ein Interessent vor dem ersten Anruf von euch?', a: ['Nichts', 'Unser Profil', 'Videos und Kundenstimmen'], t: [
          'Euer Berater ist beim ersten Anruf ein Fremder. Genau da springen die meisten Interessenten ab.',
          'Euer Profil ist da, aber es bereitet niemanden gezielt auf das Gespräch vor.',
          'Eure Interessenten kennen euch vor dem Gespräch. Das merkt man an der Abschlussquote.'] },
        { key: 'tempo', name: 'Tempo', q: 'Wann ruft ihr neue Anfragen an?', a: ['Am nächsten Tag', 'Am selben Tag', 'In der ersten Stunde'], t: [
          'Wer erst am nächsten Tag anruft, hat den Interessenten oft schon an einen anderen Vertrieb verloren.',
          'Am selben Tag ist gut. In der ersten Stunde ist die Chance aber um ein Vielfaches höher.',
          'Schnell genug. Jetzt muss der Rest mithalten.'] },
      ],
      typ(t: number) {
        if (t <= 3) return { name: 'Blindflug', text: 'Ihr zahlt für Anzeigen, wisst aber nicht, was sie bringen.' };
        if (t <= 7) return { name: 'Lead-Hamsterrad', text: 'Anfragen sind da. Bis zum Abschluss schaffen es zu wenige.' };
        return { name: 'Kurz vor Marktführer', text: 'Ein, zwei Stationen fehlen euch noch.' };
      },
    },
    b: {
      label: 'Weg B (will starten)',
      score: 'Startklar-Score', leck: 'Größte Baustelle',
      call: { h: 'Eure ersten 90 Tage planen', t: 'In 30 Minuten plane ich mit euch den Start: welche Videos, welches Budget, wer die Anfragen anruft. Dazu gehe ich die konkreten Lösungsvorschläge für eure Baustellen mit euch durch. Kostenlos und unverbindlich.' },
      questions: [
        { key: 'sichtbarkeit', name: 'Sichtbarkeit', q: 'Was gibt es schon von euch zu sehen?', a: ['Noch nichts', 'Website oder Profil', 'Videos mit unseren Beratern'], t: [
          'Wer euch sucht, findet nichts. Bevor die erste Anzeige läuft, braucht es Inhalte, die Vertrauen aufbauen.',
          'Ein Profil ist eine Basis. Für Anzeigen fehlen noch Videos, in denen eure Berater zu sehen sind.',
          'Ihr habt Material. Daraus lassen sich direkt die ersten Anzeigen bauen.'] },
        { key: 'kamera', name: 'Gesichter', q: 'Würden eure Berater vor die Kamera gehen?', a: ['Eher nicht', 'Einzelne schon', 'Ja'], t: [
          'Ohne Gesichter wird es schwer. Bei Geld und Immobilien kaufen Kunden bei Menschen, die sie schon gesehen haben.',
          'Ein, zwei Gesichter reichen für den Start. Damit lässt sich der erste Drehtag planen.',
          'Beste Voraussetzung. Eure Berater werden zum Grund, warum Kunden bei euch anfragen.'] },
        { key: 'tempo', name: 'Tempo', q: 'Wer würde neue Anfragen anrufen?', a: ['Noch offen', 'Die Berater nebenbei', 'Ein fester Ansprechpartner'], t: [
          'Ohne festen Rückruf verpufft das Werbebudget. Wer nicht in der ersten Stunde anruft, verliert die meisten Anfragen.',
          'Nebenbei klappt am Anfang. Ab 20 Anfragen pro Woche bleibt dann aber etwas liegen.',
          'Ein fester Ansprechpartner ist der wichtigste Baustein. Damit seid ihr bereit.'] },
        { key: 'kapazitaet', name: 'Kapazität', q: 'Wie viele zusätzliche Termine schafft euer Team pro Woche?', a: ['Unter 5', '5 bis 15', 'Über 15'], t: [
          'Für wenige Termine lohnen sich Anzeigen selten. Erst Beraterzeit schaffen, dann starten.',
          'Genug für einen sauberen Start mit überschaubarem Budget.',
          'Viel Kapazität. Hier lohnt sich ein Start mit mehr Budget.'] },
        { key: 'zielgruppe', name: 'Zielgruppe', q: 'Wisst ihr, welche Kunden ihr ansprechen wollt?', a: ['Noch nicht', 'Grob', 'Genau'], t: [
          'Ohne klare Zielgruppe zahlt ihr für Klicks von Leuten, die nie kaufen.',
          'Grob reicht für den Start. Genauer wird es mit Einkommen, Eigenkapital und Region.',
          'Ihr kennt euren Kunden. Damit lassen sich die Anzeigen von Tag eins an scharf stellen.'] },
      ],
      typ(t: number) {
        if (t <= 3) return { name: 'Erst Grundlagen', text: 'Bevor die erste Anzeige läuft, fehlen noch ein paar Bausteine.' };
        if (t <= 7) return { name: 'Fast startklar', text: 'Mit zwei, drei Bausteinen könnt ihr in wenigen Wochen starten.' };
        return { name: 'Startklar', text: 'Ihr könnt direkt mit den ersten Anzeigen loslegen.' };
      },
    },
  } as Record<Weg, WegDef>,
  hero: {
    '': { l: 'Wie gut funktioniert', b: 'Social Media für euren Vertrieb?', t: '6 Fragen, 2 Minuten. Ihr bekommt sofort:' },
    ads: { l: 'Ihr schaltet Anzeigen.', b: 'Aber sind sie gut?', t: '6 kurze Fragen, 2 Minuten. Danach seht ihr, was eure Anzeigen bringen und an welcher Stelle Kunden abspringen.' },
    start: { l: 'Andere Vertriebe sind auf Instagram.', b: 'Seid ihr startklar?', t: '6 kurze Fragen, 2 Minuten. Danach seht ihr, was euch für den Start noch fehlt und womit ihr anfangen solltet.' },
    leads: { l: 'Schluss mit gekauften Leads.', b: 'Eure eigenen Anfragen.', t: '6 kurze Fragen, 2 Minuten. Danach seht ihr, wie viele eurer Anfragen euch wirklich gehören und was euch zu eigenen Anfragen noch fehlt.' },
    marke: { l: 'Kunden kaufen bei Gesichtern, die sie kennen.', b: 'Kennt man eure Berater?', t: '6 kurze Fragen, 2 Minuten. Danach seht ihr, wie sichtbar euer Vertrieb ist und wo Kunden abspringen, bevor sie euch kennen.' },
    alles: { l: 'Idee, Dreh, Schnitt, Anzeigen.', b: 'Ihr telefoniert nur noch.', t: '6 kurze Fragen, 2 Minuten. Danach seht ihr, was ein System für eigene Anfragen bei euch bräuchte und was wir euch komplett abnehmen.' },
  } as Record<string, { l: string; b: string; t: string }>,
};

export const heroFor = (v: string | null) => VC.hero[v ?? ''] ?? VC.hero[''];
export const heroBullets = ['euren Score von 0 bis 100', 'die Stelle, an der ihr die meisten Kunden verliert', 'den ersten Schritt zu mehr eigenen Anfragen'];
export const answerSchema = z.array(z.number().int().min(0).max(2)).length(5);

export function evaluate(weg: Weg, answers: number[]) {
  answerSchema.parse(answers);
  const def = VC.wege[weg];
  const total = answers.reduce((a, b) => a + b, 0);
  const cards = def.questions.map((s, i) => ({ ...s, index: i, score: answers[i], text: s.t[answers[i]] }));
  // Stable sort keeps question order inside the same colour.
  const sorted = [...cards].sort((a, b) => a.score - b.score || a.index - b.index);
  const weakest = sorted[0].score === 2 ? null : sorted[0];
  return { total, score: Math.round((total / 10) * 100), type: def.typ(total), cards: sorted, weakest, def };
}

export const contactSchema = z.object({
  first_name: z.string().trim().min(1, 'Bitte euren Vornamen eingeben.').max(100),
  company: z.string().trim().min(1, 'Bitte eure Firma eingeben.').max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ()/\-]{7,32}$/, 'Bitte eine gültige Handynummer eingeben.').refine(v => v.replace(/\D/g, '').length >= 7, 'Bitte eine gültige Handynummer eingeben.'),
  email: z.string().trim().email('Bitte eine gültige E-Mail-Adresse eingeben.').max(255),
  postcode: z.string().regex(/^\d{5}$/, 'Bitte die PLZ mit 5 Ziffern eingeben.'),
  whatsapp_consent: z.boolean(),
  email_consent: z.boolean(),
  privacy: z.literal(true, { errorMap: () => ({ message: 'Bitte bestätigt, dass ihr die Datenschutzerklärung gelesen habt.' }) }),
});

export const sequenceDays = [1, 2, 4, 6, 9, 14];
export const maySendSequence = (consent: boolean, status: string, unsubscribed: boolean) => consent && status === 'neu' && !unsubscribed;
