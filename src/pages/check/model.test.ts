import {describe,it,expect} from 'vitest';
import {stations,evaluate,resultType,contactSchema,sequenceDays,maySendSequence} from './model';
describe('Vertriebs-Check rules',()=>{
 stations.forEach((s,i)=>it(`${s.name}: answer positions score 0,1,2`,()=>{for(const score of [0,1,2]){const a=[0,0,0,0,0,0];a[i]=score;const r=evaluate(a);expect(r.cards.find(c=>c.key===s.key)?.score).toBe(score);expect(r.total).toBe(score)}}));
 it('0–4 Empfehlungs-Vertrieb',()=>{expect(resultType(0)).toBe('Empfehlungs-Vertrieb');expect(resultType(4)).toBe('Empfehlungs-Vertrieb')});
 it('5–8 Lead-Hamsterrad',()=>{expect(resultType(5)).toBe('Lead-Hamsterrad');expect(resultType(8)).toBe('Lead-Hamsterrad')});
 it('9–12 Kurz vor Marktführer',()=>{expect(resultType(9)).toBe('Kurz vor Marktführer');expect(resultType(12)).toBe('Kurz vor Marktführer')});
 it('red then yellow then green',()=>{expect(evaluate([2,0,1,2,0,1]).cards.map(c=>c.key)).toEqual(['filter','termin','vertrauen','cockpit','sichtbarkeit','tempo'])});
 const base={first_name:'Jonas',company:'Marketlab Test',postcode:'12345',phone:'+491234567890',email:'test@example.org',privacy:true,whatsapp_consent:false,email_consent:false};
 it('postcode is exactly five digits',()=>{expect(contactSchema.safeParse(base).success).toBe(true);for(const postcode of ['1234','123456','abcde'])expect(contactSchema.safeParse({...base,postcode}).success).toBe(false)});
 for(const field of ['first_name','company','phone','email'])it(`${field} required`,()=>expect(contactSchema.safeParse({...base,[field]:''}).success).toBe(false));
 it('privacy required',()=>expect(contactSchema.safeParse({...base,privacy:false}).success).toBe(false));
 it('marketing and WhatsApp optional',()=>expect(contactSchema.safeParse(base).success).toBe(true));
 it('follow-up days 1,2,4,6,9,14',()=>expect(sequenceDays).toEqual([1,2,4,6,9,14]));
 it('follow-up stops without consent, on status change and unsubscribe',()=>{expect(maySendSequence(true,'neu',false)).toBe(true);expect(maySendSequence(false,'neu',false)).toBe(false);for(const status of ['termin_gebucht','angerufen','abgelehnt'])expect(maySendSequence(true,status,false)).toBe(false);expect(maySendSequence(true,'neu',true)).toBe(false)});
});
