import {supabase} from '@/integrations/supabase/client';
export type Choice='all'|'necessary';
const KEY='vc_consent';
interface Consent {choice:Choice;id:string|null;at:string;version:string;}
export function readConsent():Consent|null{try{const v=JSON.parse(localStorage.getItem(KEY)||'null');return v&&['all','necessary'].includes(v.choice)?v:null;}catch{return null;}}
export const permitted=()=>readConsent()?.choice==='all'&&!!readConsent()?.id;
export async function chooseConsent(choice:Choice){
 const old=readConsent();
 // A withdrawal is applied locally before any network call.
 localStorage.setItem(KEY,JSON.stringify({choice,id:old?.id||null,at:new Date().toISOString(),version:'vc-2026-10-31'}));
 if(choice==='necessary'){window.fbq?.('consent','revoke');sessionStorage.removeItem('vc_session');sessionStorage.removeItem('vc_utm');['_fbp','_fbc'].forEach(n=>document.cookie=`${n}=; Max-Age=0; path=/`);}
 const {data,error}=await supabase.functions.invoke('vertriebs-check?action=consent',{body:{choice,id:old?.id||undefined}});
 if(error)throw error;
 localStorage.setItem(KEY,JSON.stringify({choice,id:data.id,at:new Date().toISOString(),version:'vc-2026-10-31'}));window.dispatchEvent(new Event('vc-consent'));
 if(choice==='all')initPixel();return data.id;
}
export function attribution(){if(!permitted())return {};try{const stored=JSON.parse(sessionStorage.getItem('vc_utm')||'null');if(stored)return stored;}catch{}const query=new URLSearchParams(location.search);const out:Record<string,string|null>={};for(const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'])out[k]=query.get(k)?.slice(0,500)||null;sessionStorage.setItem('vc_utm',JSON.stringify(out));return out;}
export function sessionId(){if(!permitted())return null;let id=sessionStorage.getItem('vc_session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('vc_session',id);}return id;}
function cookie(n:string){if(!permitted())return null;return document.cookie.split('; ').find(v=>v.startsWith(n+'='))?.slice(n.length+1)||null;}
let initialized=false;
export function initPixel(){
 if(!permitted())return;if(initialized){window.fbq?.('consent','grant');return;}initialized=true;
 if(!window.fbq){type Pixel=NonNullable<Window['fbq']>&{queue:unknown[];callMethod?:(...args:unknown[])=>void;push:unknown;loaded:boolean;version:string};const fbq=((...args:unknown[])=>{if(fbq.callMethod)fbq.callMethod(...args);else fbq.queue.push(args);}) as Pixel;fbq.queue=[];fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';window.fbq=fbq;window._fbq=fbq;const script=document.createElement('script');script.src='https://connect.facebook.net/en_US/fbevents.js';script.async=true;document.head.append(script);fbq('init','2349392999129892',{}, {agent:'lovable'});}
 window.fbq?.('consent','grant');
}
export async function track(step:string,submissionToken?:string){
 if(!permitted())return;
 const sid=sessionId(),consent=readConsent();if(!sid||!consent?.id)return;
 const marker=`vc_event:${sid}:${step}`;if(sessionStorage.getItem(marker))return;
 const eventId=crypto.randomUUID();const attr=attribution();const fbclid=attr.fbclid;
 const {data,error}=await supabase.functions.invoke('vertriebs-check?action=event',{body:{step,event_id:eventId,session_id:sid,consent_id:consent.id,attribution:attr,fbp:cookie('_fbp'),fbc:cookie('_fbc')||(fbclid?`fb.1.${Date.now()}.${fbclid}`:null),submission_token:submissionToken}});
 if(error||data?.ignored||!permitted())return;
 sessionStorage.setItem(marker,eventId);initPixel();
 if(data?.duplicate)return;
 const name=step==='besuch'?'PageView':step==='check_gestartet'?'CheckGestartet':step==='eingetragen'?'Lead':null;
 if(name)window.fbq?.(name==='CheckGestartet'?'trackCustom':'track',name,{}, {eventID:eventId});
}
export function mountTracking(){const update=()=>{if(permitted())initPixel();else window.fbq?.('consent','revoke');};window.addEventListener('storage',update);window.addEventListener('vc-consent',update);update();return()=>{window.removeEventListener('storage',update);window.removeEventListener('vc-consent',update);};}
