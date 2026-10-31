import {createClient} from 'npm:@supabase/supabase-js@2';
import {z} from 'npm:zod@3.25.76';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
const uuid=z.string().uuid();
const attr=z.record(z.string().max(500).nullable()).refine(v=>Object.keys(v).every(k=>['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].includes(k)));
const contact=z.object({request_id:uuid,weg:z.enum(['a','b']),variant:z.string().max(40).regex(/^[a-z0-9_-]*$/).optional().nullable(),answers:z.array(z.number().int().min(0).max(2)).length(5),first_name:z.string().trim().min(1).max(100),company:z.string().trim().min(1).max(200),phone:z.string().trim().regex(/^\+?[0-9 ()/\-]{7,32}$/).refine(v=>v.replace(/\D/g,'').length>=7),email:z.string().trim().email().max(255),privacy:z.literal(true),whatsapp_consent:z.boolean(),email_consent:z.boolean(),attribution:attr.optional(),session_id:uuid.nullable().optional(),advertising_consent_id:uuid.nullable().optional(),event_id:uuid.nullable().optional(),fbp:z.string().max(200).nullable().optional(),fbc:z.string().max(300).nullable().optional()});
const eventSchema=z.object({session_id:uuid,consent_id:uuid,event_id:uuid,step:z.enum(['besuch','check_start','kein_meta','formular']),weg:z.enum(['a','b']).nullable().optional(),variant:z.string().max(40).regex(/^[a-z0-9_-]*$/).nullable().optional(),attribution:attr.optional(),fbp:z.string().max(200).nullable().optional(),fbc:z.string().max(300).nullable().optional()});
const SOURCE_URL='https://hub.marketlab-media.de/';
const now=()=>Math.floor(Date.now()/1000);
async function sha(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
export function normalizePhone(p:string){let d=p.replace(/\D/g,'');if(d.startsWith('0049'))d='49'+d.slice(4);else if(d.startsWith('49'))d=d;else if(d.startsWith('0'))d='49'+d.slice(1);return d;}
async function consentOk(db:any,id:string){const {data}=await db.from('vertriebs_check_consents').select('choice,withdrawn_at').eq('id',id).maybeSingle();return !!data&&data.choice==='all'&&!data.withdrawn_at;}
async function leadUserData(s:any){const ud:Record<string,unknown>={em:[await sha(String(s.email).trim().toLowerCase())],ph:[await sha(normalizePhone(String(s.phone)))],fn:[await sha(String(s.first_name).trim().toLowerCase())],external_id:[await sha(String(s.lead_id||s.id))]};if(s.fbp)ud.fbp=s.fbp;if(s.fbc)ud.fbc=s.fbc;if(s.client_ip)ud.client_ip_address=s.client_ip;if(s.client_user_agent)ud.client_user_agent=s.client_user_agent;return ud;}
// Standard events only; no custom names, custom_data limited to value/currency, URL without path.
async function sendMeta(db:any,ev:{event_name:'PageView'|'InitiateCheckout'|'CompleteRegistration'|'Lead'|'Schedule'|'Purchase';event_id:string;event_time:number;user_data:Record<string,unknown>;custom_data?:{value:number;currency:'EUR'};submission_id?:string;test?:boolean}){
 const token=Deno.env.get('META_ACCESS_TOKEN');const code=Deno.env.get('META_TEST_EVENT_CODE')||undefined;
 const log=(status:string,received:number|null,error:string|null)=>db.from('capi_log').insert({submission_id:ev.submission_id||null,event_name:ev.event_name,event_id:ev.event_id,status,events_received:received,error,test:!!ev.test||!!code});
 if(!token){await log('missing_token',null,'META_ACCESS_TOKEN fehlt');return {status:'missing_token',response:null};}
 try{
  const res=await fetch('https://graph.facebook.com/v26.0/2349392999129892/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({partner_agent:'lovable',...(code?{test_event_code:code}:{}),data:[{event_name:ev.event_name,event_id:ev.event_id,event_time:ev.event_time,action_source:'website',event_source_url:SOURCE_URL,user_data:ev.user_data,...(ev.custom_data?{custom_data:ev.custom_data}:{})}]})});
  const r=await res.json().catch(()=>({}));
  await log(res.ok?'accepted':'failed',r?.events_received??null,res.ok?null:String(r?.error?.error_user_msg||r?.error?.message||res.status).slice(0,500));
  return {status:res.ok?'accepted':'failed',response:r};
 }catch(err){await log('failed',null,String(err).slice(0,500));return {status:'failed',response:null};}
}
async function notifySlack(db:any,s:any){
 const hook=Deno.env.get('SLACK_WEBHOOK_URL');if(!hook){await db.from('vertriebs_check_submissions').update({slack_status:'missing_secret'}).eq('id',s.id);return;}
 try{
  const a=s.attribution||{};const src=[a.utm_campaign,a.utm_content].filter(Boolean).join('/')||'direkt';
  const text=`🟦 Neuer Vertriebs-Check · ${s.first_name} · ${s.company} · Weg ${String(s.weg).toUpperCase()} · Typ ${s.result_type} · Variante ${s.variant||'–'} · Quelle ${src}\n<https://hub.marketlab-media.de/crm/lead/${s.lead_id||''}|Lead im CRM öffnen>`;
  const res=await fetch(hook,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  await db.from('vertriebs_check_submissions').update({slack_status:res.ok?'sent':'failed'}).eq('id',s.id);
 }catch{await db.from('vertriebs_check_submissions').update({slack_status:'failed'}).eq('id',s.id);}
}
const names=['Anzeigen','Cockpit','Filter','Vertrauen','Tempo'];const namesB=['Sichtbarkeit','Gesichter','Tempo','Kapazität','Zielgruppe'];
async function hash(v:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v.trim().toLowerCase())))).map(b=>b.toString(16).padStart(2,'0')).join('');}
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(!['GET','POST'].includes(req.method))return json({error:'method_not_allowed'},405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return json({error:'configuration'},500);
 const db=createClient(url,key,{auth:{persistSession:false}});
 try{
 if(Number(req.headers.get('content-length')||0)>16000)return json({error:'too_large'},413);
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
 const ipHash=await hash(ip);
 const action=new URL(req.url).searchParams.get('action') || (req.method==='GET'?'result':'submit');
 const {data:allowed,error:limitError}=await db.rpc('vc_rate_limit',{_key:action+':'+ipHash,_max:action==='submit'?20:600});if(limitError||!allowed)return json({error:'Bitte später erneut versuchen.'},429);
 const body=req.method==='POST'?await req.json():{};
 if(action==='consent'){
 const choice=z.enum(['all','necessary']).parse(body.choice);
 if(body.id){const id=uuid.parse(body.id);const {error}=await db.from('vertriebs_check_consents').update({choice,withdrawn_at:choice==='necessary'?new Date().toISOString():null}).eq('id',id);if(error)throw error;return json({id});}
 const {data,error}=await db.from('vertriebs_check_consents').insert({choice}).select('id').single();if(error)throw error;return json(data);
 }
 if(action==='trust'){
 const {data,error}=await db.from('vertriebs_check_settings').select('trustpilot_score,trustpilot_reviews').eq('id',true).maybeSingle();
 if(error)throw error;
 return json({trustpilot_score:Number(data?.trustpilot_score??4.4),trustpilot_reviews:data?.trustpilot_reviews??10});
 }
 if(action==='unsubscribe'){
 const token=uuid.parse(body.token||new URL(req.url).searchParams.get('token'));
 const {data,error}=await db.from('vertriebs_check_submissions').select('id,unsubscribed_at').eq('unsubscribe_token',token).maybeSingle();if(error)throw error;if(!data)return json({error:'Ungültiger Link'},404);
 if(req.method==='POST'){const {error:e}=await db.from('vertriebs_check_submissions').update({unsubscribed_at:new Date().toISOString()}).eq('id',data.id);if(e)throw e;return json({success:true});}return json({valid:!data.unsubscribed_at});
 }
 if(action==='result'){
 const token=uuid.parse(new URL(req.url).searchParams.get('token')||body.token);
 const {data,error}=await db.from('vertriebs_check_submissions').select('first_name,company,answers,total,score,result_type,weg').eq('token',token).maybeSingle();if(error)throw error;if(!data)return json({error:'Diese Auswertung wurde nicht gefunden.'},404);
 const {data:settings,error:sErr}=await db.from('vertriebs_check_settings').select('video_url,calendar_url').eq('id',true).maybeSingle();if(sErr)throw sErr;
 return json({first_name:data.first_name,company:data.company,weg:data.weg,score:data.score,answers:data.answers,total:data.total,type:data.result_type,video_url:settings?.video_url||null,calendar_url:settings?.calendar_url||'https://calendar.app.google/i2jtG5DapbEjzWba6'});
 }
 if(action==='event'){
 const e=eventSchema.parse(body);
 if(!await consentOk(db,e.consent_id))return json({ignored:true});
 const a=e.attribution||{};
 const {error:ee}=await db.from('positioning_funnel_events').insert({funnel:'vertriebs-check',session_id:e.session_id,step:e.step,event_id:e.event_id,weg:e.weg||null,variant:e.variant||null,utm_source:a.utm_source||null,utm_medium:a.utm_medium||null,utm_campaign:a.utm_campaign||null,utm_content:a.utm_content||null,utm_term:a.utm_term||null,fbclid:a.fbclid||null});
 if(ee?.code==='23505')return json({duplicate:true});if(ee)throw ee;
 if(e.step!=='check_start')return json({saved:true});
 const ud:Record<string,unknown>={client_user_agent:req.headers.get('user-agent')||''};if(ip!=='unknown')ud.client_ip_address=ip;if(e.fbp)ud.fbp=e.fbp;if(e.fbc)ud.fbc=e.fbc;
 const r=await sendMeta(db,{event_name:'InitiateCheckout',event_id:e.event_id,event_time:now(),user_data:ud});
 return json({saved:true,capi:r.status});
 }
 if(action==='status'){
 const id=uuid.parse(body.submission_id);
 const {data:s,error}=await db.from('vertriebs_check_submissions').select('*').eq('id',id).maybeSingle();if(error)throw error;
 if(!s||!s.tracking_consent||!s.advertising_consent_id||!await consentOk(db,s.advertising_consent_id))return json({ignored:true});
 const {data:lead}=s.lead_id?await db.from('crm_leads').select('deal_value').eq('id',s.lead_id).maybeSingle():{data:null};
 const out:Record<string,string>={};
 for(const [name,at,sent] of [['Lead','kontakt_at','lead_sent_at'],['Schedule','termin_at','schedule_sent_at'],['Purchase','abschluss_at','purchase_sent_at']] as const){
  if(!s[at]||s[sent])continue;
  const {data:claimed}=await db.from('vertriebs_check_submissions').update({[sent]:new Date().toISOString()}).eq('id',s.id).is(sent,null).select('id').maybeSingle();if(!claimed)continue;
  const t=Math.floor(new Date(s[at]).getTime()/1000);
  const r=await sendMeta(db,{submission_id:s.id,event_name:name,event_id:`${s.id}-${name.toLowerCase()}`,event_time:now()-t>7*86400?now():t,user_data:await leadUserData(s),custom_data:name==='Purchase'?{value:Number(lead?.deal_value||0),currency:'EUR'}:undefined});
  if(r.status!=='accepted')await db.from('vertriebs_check_submissions').update({[sent]:null}).eq('id',s.id);
  out[name]=r.status;
 }
 return json(out);
 }
 if(action==='test'){
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer /,'');const {data:u}=await db.auth.getUser(jwt);
 if(!u?.user)return json({error:'unauthorized'},401);
 const {data:isAdmin}=await db.rpc('has_role',{_user_id:u.user.id,_role:'admin'});if(!isAdmin)return json({error:'forbidden'},403);
 const code=Deno.env.get('META_TEST_EVENT_CODE');if(!code)return json({error:'META_TEST_EVENT_CODE fehlt'},400);
 const fake={id:crypto.randomUUID(),lead_id:crypto.randomUUID(),email:'test.person@example.com',phone:'0171 2345678',first_name:'Testperson',fbp:'fb.1.1700000000000.1234567890',fbc:null,client_ip:'203.0.113.10',client_user_agent:'Mozilla/5.0 (Test)'};
 const ic=await sendMeta(db,{test:true,event_name:'InitiateCheckout',event_id:crypto.randomUUID(),event_time:now(),user_data:{client_user_agent:fake.client_user_agent,client_ip_address:fake.client_ip,fbp:fake.fbp}});
 const cr=await sendMeta(db,{test:true,event_name:'CompleteRegistration',event_id:crypto.randomUUID(),event_time:now(),user_data:await leadUserData(fake)});
 return json({InitiateCheckout:ic.response,CompleteRegistration:cr.response});
 }
 if(action!=='submit')return json({error:'unknown_action'},400);
 const parsed=contact.parse(body);
 const {data:result,error}=await db.rpc('vc_submit',{_data:parsed});if(error)throw error;
 let tracked=false;
 if(!result.existing){
  const consent=!!parsed.advertising_consent_id&&!!parsed.session_id&&await consentOk(db,parsed.advertising_consent_id);
  const a=parsed.attribution||{};
  await db.from('vertriebs_check_submissions').update({attribution:a,tracking_consent:consent,advertising_consent_id:consent?parsed.advertising_consent_id:null,session_id:consent?parsed.session_id:null,fbp:consent?parsed.fbp||null:null,fbc:consent?parsed.fbc||null:null,client_ip:consent&&ip!=='unknown'?ip:null,client_user_agent:consent?req.headers.get('user-agent'):null}).eq('id',result.id);
  if(result.lead_id){const {data:l}=await db.from('crm_leads').select('vertriebs_check_data').eq('id',result.lead_id).maybeSingle();await db.from('crm_leads').update({vertriebs_check_data:{...(l?.vertriebs_check_data||{}),attribution:a,tracking_consent:consent}}).eq('id',result.lead_id);}
  if(consent&&parsed.event_id){
   await db.from('positioning_funnel_events').insert({funnel:'vertriebs-check',session_id:parsed.session_id,step:'eingetragen',event_id:parsed.event_id,weg:parsed.weg,variant:parsed.variant||null,utm_source:a.utm_source||null,utm_medium:a.utm_medium||null,utm_campaign:a.utm_campaign||null,utm_content:a.utm_content||null,utm_term:a.utm_term||null,fbclid:a.fbclid||null});
   const {data:fresh}=await db.from('vertriebs_check_submissions').select('*').eq('id',result.id).single();
   if(fresh){await sendMeta(db,{submission_id:fresh.id,event_name:'CompleteRegistration',event_id:parsed.event_id,event_time:now(),user_data:await leadUserData(fresh)});tracked=true;}
  }
 }
 const {data:s,error:se}=await db.from('vertriebs_check_submissions').select('*').eq('id',result.id).single();if(se)throw se;
 if(!result.existing&&!s.slack_status)await notifySlack(db,s);
 const base='https://hub.marketlab-media.de';
 if(s.crm_error)console.error('vertriebs-check crm sync failed',s.id,s.crm_error);
 const red=(s.weg==='a'?names:namesB).filter((_,i)=>s.answers[i]===0).join(', ')||'keine';
 const sends=[{name:'vertriebs-check-result',email:s.email,status:'result_mail_status',url:`${base}/check/auswertung/${s.token}`},{name:'vertriebs-check-owner',email:'jonas@marketlab-media.de',status:'owner_mail_status',url:s.lead_id?`${base}/crm/lead/${s.lead_id}`:`${base}/crm`}];
 await Promise.all(sends.map(async(send)=>{
 if(s[send.status]==='queued'||s[send.status]==='sent')return;
 try{
 const {error:mailError,data:mailData}=await db.functions.invoke('send-transactional-email',{body:{templateName:send.name,recipientEmail:send.email,idempotencyKey:`${send.name}-${s.id}`,templateData:{name:s.first_name,company:s.company,phone:s.phone,type:s.result_type,red,url:send.url}}});
 await db.from('vertriebs_check_submissions').update({[send.status]:mailError||mailData?.error?'failed':'queued'}).eq('id',s.id);
 }catch{await db.from('vertriebs_check_submissions').update({[send.status]:'failed'}).eq('id',s.id);}
 }));
 return json({token:result.token,tracked});
 }catch(e){if(e instanceof z.ZodError)return json({error:'Bitte die Angaben prüfen.',fields:e.flatten()},400);return json({error:'Das hat nicht geklappt. Bitte erneut versuchen.'},500);}
});
