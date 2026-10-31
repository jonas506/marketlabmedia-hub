import {createClient} from 'npm:@supabase/supabase-js@2';
import {z} from 'npm:zod@3.25.76';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
const uuid=z.string().uuid();
const attr=z.record(z.string().max(500).nullable()).refine(v=>Object.keys(v).every(k=>['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid'].includes(k)));
const contact=z.object({request_id:uuid,weg:z.enum(['a','b']),variant:z.string().max(40).regex(/^[a-z0-9_-]*$/).optional().nullable(),answers:z.array(z.number().int().min(0).max(2)).length(5),first_name:z.string().trim().min(1).max(100),company:z.string().trim().min(1).max(200),postcode:z.string().regex(/^\d{5}$/),phone:z.string().trim().regex(/^\+?[0-9 ()/\-]{7,32}$/).refine(v=>v.replace(/\D/g,'').length>=7),email:z.string().trim().email().max(255),privacy:z.literal(true),whatsapp_consent:z.boolean(),email_consent:z.boolean(),attribution:attr.optional(),session_id:uuid.nullable().optional(),advertising_consent_id:uuid.nullable().optional()});
const steps=['besuch','check_gestartet','frage_1','frage_2','frage_3','frage_4','frage_5','frage_6','eingetragen','auswertung_geoeffnet'] as const;
const eventSchema=z.object({session_id:uuid,consent_id:uuid,event_id:uuid,step:z.enum(steps),attribution:attr,fbp:z.string().max(200).nullable().optional(),fbc:z.string().max(300).nullable().optional(),submission_token:uuid.optional()});
const names=['Sichtbarkeit','Filter','Vertrauen','Tempo','Termin','Cockpit'];
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
 if(action==='unsubscribe'){
 const token=uuid.parse(body.token||new URL(req.url).searchParams.get('token'));
 const {data,error}=await db.from('vertriebs_check_submissions').select('id,unsubscribed_at').eq('unsubscribe_token',token).maybeSingle();if(error)throw error;if(!data)return json({error:'Ungültiger Link'},404);
 if(req.method==='POST'){const {error:e}=await db.from('vertriebs_check_submissions').update({unsubscribed_at:new Date().toISOString()}).eq('id',data.id);if(e)throw e;return json({success:true});}return json({valid:!data.unsubscribed_at});
 }
 if(action==='result'){
 const token=uuid.parse(new URL(req.url).searchParams.get('token')||body.token);
 const {data,error}=await db.from('vertriebs_check_submissions').select('first_name,company,postcode,answers,total,score,result_type,weg').eq('token',token).maybeSingle();if(error)throw error;if(!data)return json({error:'Diese Auswertung wurde nicht gefunden.'},404);
 const [area,settings]=await Promise.all([db.from('gebiete').select('status').eq('plz_prefix',data.postcode.slice(0,3)).maybeSingle(),db.from('vertriebs_check_settings').select('video_url,calendar_url').eq('id',true).maybeSingle()]);
 if(area.error||settings.error)throw area.error||settings.error;
 return json({first_name:data.first_name,company:data.company,weg:data.weg,score:data.score,postcode_prefix:data.postcode.slice(0,3),answers:data.answers,total:data.total,type:data.result_type,area_status:area.data?.status||'frei',video_url:settings.data?.video_url||null,calendar_url:settings.data?.calendar_url||'https://calendar.app.google/i2jtG5DapbEjzWba6'});
 }
 if(action==='event'){
 const e=eventSchema.parse(body);
 const {data:consent,error:ce}=await db.from('vertriebs_check_consents').select('choice,withdrawn_at').eq('id',e.consent_id).maybeSingle();if(ce)throw ce;if(!consent||consent.choice!=='all'||consent.withdrawn_at)return json({ignored:true});
 let lead:Record<string,any>|null=null;
 if(e.step==='eingetragen'){
 if(!e.submission_token)return json({error:'submission_required'},400);
 const {data}=await db.from('vertriebs_check_submissions').select('email,phone,advertising_consent_id,created_at').eq('token',e.submission_token).maybeSingle();
 if(!data||data.advertising_consent_id!==e.consent_id)return json({ignored:true});lead=data;
 }
 const {data:saved,error:ee}=await db.from('vertriebs_check_events').insert({session_id:e.session_id,consent_id:e.consent_id,event_id:e.event_id,step:e.step,attribution:e.attribution}).select('created_at').single();
 if(ee?.code==='23505')return json({duplicate:true});if(ee)throw ee;
 const eventName=e.step==='besuch'?'PageView':e.step==='check_gestartet'?'CheckGestartet':e.step==='eingetragen'?'Lead':null;
 if(!eventName)return json({saved:true});
 // Recheck current permission immediately before sending to Meta.
 const {data:latest}=await db.from('vertriebs_check_consents').select('choice,withdrawn_at').eq('id',e.consent_id).single();if(latest?.choice!=='all'||latest.withdrawn_at)return json({saved:true,blocked:true});
 const token=Deno.env.get('META_ACCESS_TOKEN')||Deno.env.get('META_CAPI_TOKEN');
 if(!token){await db.from('vertriebs_check_events').update({capi_status:'missing_token'}).eq('event_id',e.event_id);return json({saved:true,capi:'missing_token'});}
 const userData:Record<string,unknown>={client_user_agent:req.headers.get('user-agent')||''};if(ip!=='unknown')userData.client_ip_address=ip;if(e.fbp)userData.fbp=e.fbp;if(e.fbc)userData.fbc=e.fbc;
 if(lead){userData.em=[await hash(lead.email)];userData.ph=[await hash(lead.phone.replace(/\D/g,''))];}
 const meta=await fetch('https://graph.facebook.com/v26.0/2349392999129892/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({partner_agent:'lovable',data:[{event_name:eventName,event_id:e.event_id,event_time:Math.floor(new Date(lead?.created_at||saved.created_at).getTime()/1000),action_source:'website',event_source_url:'https://hub.marketlab-media.de/check',user_data:userData}]})});
 await db.from('vertriebs_check_events').update({capi_status:meta.ok?'accepted':'failed'}).eq('event_id',e.event_id);
 return json({saved:true,capi:meta.ok?'accepted':'failed'});
 }
 if(action!=='submit')return json({error:'unknown_action'},400);
 const parsed=contact.parse(body);
 const {data:result,error}=await db.rpc('vc_submit',{_data:parsed});if(error)throw error;
 const {data:s,error:se}=await db.from('vertriebs_check_submissions').select('*').eq('id',result.id).single();if(se)throw se;
 const base='https://hub.marketlab-media.de';
 if(s.crm_error)console.error('vertriebs-check crm sync failed',s.id,s.crm_error);
 const red=(s.weg==='a'?names:namesB).filter((_,i)=>s.answers[i]===0).join(', ')||'keine';
 const sends=[{name:'vertriebs-check-result',email:s.email,status:'result_mail_status',url:`${base}/check/auswertung/${s.token}`},{name:'vertriebs-check-owner',email:'jonas@marketlab-media.de',status:'owner_mail_status',url:s.lead_id?`${base}/crm/lead/${s.lead_id}`:`${base}/crm`}];
 await Promise.all(sends.map(async(send)=>{
 if(s[send.status]==='queued'||s[send.status]==='sent')return;
 try{
 const {error:mailError,data:mailData}=await db.functions.invoke('send-transactional-email',{body:{templateName:send.name,recipientEmail:send.email,idempotencyKey:`${send.name}-${s.id}`,templateData:{name:s.first_name,company:s.company,postcode:s.postcode,phone:s.phone,type:s.result_type,red,url:send.url}}});
 await db.from('vertriebs_check_submissions').update({[send.status]:mailError||mailData?.error?'failed':'queued'}).eq('id',s.id);
 }catch{await db.from('vertriebs_check_submissions').update({[send.status]:'failed'}).eq('id',s.id);}
 }));
 return json({token:result.token});
 }catch(e){if(e instanceof z.ZodError)return json({error:'Bitte die Angaben prüfen.',fields:e.flatten()},400);return json({error:'Das hat nicht geklappt. Bitte erneut versuchen.'},500);}
});
