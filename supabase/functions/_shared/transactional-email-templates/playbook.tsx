import * as React from 'npm:react@18.3.1';
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from 'npm:@react-email/components@0.0.22';
import type { TemplateEntry } from './registry.ts';

interface Props { name?: string; url?: string }
const main = { backgroundColor: '#05060B', fontFamily: 'Arial, sans-serif', color: '#ECEEF4', padding: '24px 0' };
const container = { padding: '32px 28px', maxWidth: '560px', backgroundColor: '#0A0D15', border: '1px solid #242832' };
const text = { color: '#C7CBD5', fontSize: '16px', lineHeight: '1.65' };
const cta = { backgroundColor: '#1A52CC', color: '#ffffff', padding: '15px 24px', textDecoration: 'none', fontWeight: 500, clipPath: 'polygon(0 0,calc(100% - 16px) 0,100% 16px,100% 100%,0 100%)' };
const PlaybookMail = ({ name, url }: Props) => <Html lang="de"><Head /><Preview>Dein persönliches Leads-Playbook 2027</Preview><Body style={main}><Container style={container}><Text style={{ color: '#9AA1B2', fontSize: '13px', letterSpacing: '1px' }}>MARKETLAB MEDIA</Text><Heading style={{ color: '#ECEEF4', fontSize: '28px', fontWeight: 500 }}>Dein Leads-Playbook 2027</Heading><Text style={text}>Hallo {name || 'dort'},</Text><Text style={text}>hier ist dein persönliches Leads-Playbook 2027. Darin findest du die 7 Phasen des Marktführer-Funnels, mit denen du über Social Media an Leads kommst, die nur dir gehören.</Text><Button style={cta} href={url}>Playbook herunterladen</Button><Text style={text}>Wir rufen dich in den nächsten Tagen kurz an und schauen mit dir, welche Phase dir noch fehlt.</Text><Text style={text}>Viele Grüße<br />Jonas Fesser<br />Marketlab Media</Text><Text style={{ color: '#7B8395', fontSize: '11px', marginTop: '28px' }}>Marketlab Media · <a href="https://marketlab-media.de/impressum" style={{ color: '#9AA1B2' }}>Impressum</a> · <a href="https://marketlab-media.de/datenschutz" style={{ color: '#9AA1B2' }}>Datenschutz</a></Text></Container></Body></Html>;

export const playbookTemplate = {
  component: PlaybookMail,
  subject: (data: Record<string, any>) => `${data.name || 'Hallo'}, dein Leads-Playbook 2027`,
  displayName: 'Leads-Playbook: Persönlicher Download',
  previewData: { name: 'Maximilian', url: 'https://hub.marketlab-media.de/playbook/download/00000000-0000-4000-8000-000000000000' },
} satisfies TemplateEntry;

const PlaybookOwnerMail = ({ name, email, phone, source }: { name?: string; email?: string; phone?: string; source?: string }) => <Html lang="de"><Head /><Preview>Neuer Playbook-Eintrag</Preview><Body style={main}><Container style={container}><Heading style={{ color: '#ECEEF4', fontSize: '26px', fontWeight: 500 }}>Neuer Playbook-Eintrag</Heading><Text style={text}>{name || 'Neuer Kontakt'}<br />{email}<br />{phone}</Text><Text style={text}>Quelle: {source || 'direkt'}</Text></Container></Body></Html>;
export const playbookOwnerTemplate = {
  component: PlaybookOwnerMail,
  to: 'jonas@marketlab-media.de',
  subject: (data: Record<string, any>) => `Neues Playbook: ${data.name || 'Neuer Kontakt'}`,
  displayName: 'Leads-Playbook: Interner Hinweis',
  previewData: { name: 'Maximilian Mustermann', email: 'max@example.com', phone: '+4915112345678', source: 'direkt' },
} satisfies TemplateEntry;
