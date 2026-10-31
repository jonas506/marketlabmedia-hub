import * as React from 'npm:react@18.3.1';
import {Body,Container,Head,Heading,Html,Preview,Text,Button} from 'npm:@react-email/components@0.0.22';
import type {TemplateEntry} from './registry.ts';
interface Props {name?:string;company?:string;phone?:string;type?:string;red?:string;url?:string;}

const main={backgroundColor:'#ffffff',fontFamily:'Arial,sans-serif',color:'#142138'};
const container={padding:'32px 24px',maxWidth:'560px'};
const cta={backgroundColor:'#1C6FF3',color:'#ffffff',padding:'14px 22px',borderRadius:'6px',textDecoration:'none'};
const Result=({name,url}:Props)=><Html lang="de"><Head/><Preview>Deine persönliche Vertriebs-Auswertung</Preview><Body style={main}><Container style={container}><Text>MARKETLAB MEDIA</Text><Heading>Deine Auswertung</Heading><Text>Hallo {name || 'dort'}, hier ist die Auswertung deines Vertriebs-Checks.</Text><Button style={cta} href={url}>Auswertung ansehen</Button><Text>Jonas Fesser · Marketlab Media</Text></Container></Body></Html>;
const Owner=({name,company,phone,type,red,url}:Props)=><Html lang="de"><Head/><Preview>Neuer Vertriebs-Check: {company}</Preview><Body style={main}><Container style={container}><Heading>Vertriebs-Check ausgefüllt</Heading><Text>{name} · {company}</Text><Text>Telefon: {phone}<br/>Typ: {type}<br/>Rote Stationen: {red || 'keine'}</Text><Button style={cta} href={url}>Lead im CRM öffnen</Button></Container></Body></Html>;
export const resultTemplate={component:Result,subject:'Deine Auswertung',displayName:'Vertriebs-Check: Auswertung'} satisfies TemplateEntry;
export const ownerTemplate={component:Owner,subject:'Neuer Vertriebs-Check',to:'jonas@marketlab-media.de',displayName:'Vertriebs-Check: Jonas benachrichtigen'} satisfies TemplateEntry;
