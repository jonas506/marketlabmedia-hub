import {it,expect,beforeEach,vi} from 'vitest';
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke:vi.fn()}}}));
import {supabase} from '@/integrations/supabase/client';
import {permitted,attribution,sessionId,track} from './tracking';
beforeEach(()=>{localStorage.clear();sessionStorage.clear();vi.clearAllMocks()});
it('no consent: no session, attribution storage, or events',async()=>{expect(permitted()).toBe(false);expect(sessionId()).toBe(null);expect(attribution()).toEqual({});await track('check_gestartet');expect(supabase.functions.invoke).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(0)});
it('necessary only: no tracking',async()=>{localStorage.setItem('vc_consent',JSON.stringify({choice:'necessary',id:'x'}));await track('eingetragen');expect(sessionId()).toBe(null);expect(supabase.functions.invoke).not.toHaveBeenCalled()});
