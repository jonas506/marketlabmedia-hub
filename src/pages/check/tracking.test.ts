import { it, expect, beforeEach, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: {}, error: null }) } } }));
import { supabase } from '@/integrations/supabase/client';
import { permitted, attribution, sessionId, track, submitTracking } from './tracking';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.clearAllMocks(); history.replaceState(null, '', '/check'); });

it('no consent: no session, no storage, no events', async () => {
  expect(permitted()).toBe(false);
  expect(sessionId()).toBe(null);
  await track('check_start');
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});
it('necessary only: no tracking', async () => {
  localStorage.setItem('vc_consent', JSON.stringify({ choice: 'necessary', id: 'x' }));
  await track('formular');
  expect(sessionId()).toBe(null);
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
it('without consent, origin comes from the current URL only and is not stored', () => {
  history.replaceState(null, '', '/check?utm_source=fb&utm_content=123');
  expect(attribution().utm_content).toBe('123');
  expect(submitTracking()).toEqual({ attribution: expect.objectContaining({ utm_source: 'fb' }) });
  expect(sessionStorage.length).toBe(0);
});
it('with consent, check_start is sent once per session', async () => {
  localStorage.setItem('vc_consent', JSON.stringify({ choice: 'all', id: '00000000-0000-4000-8000-000000000000' }));
  await track('check_start'); await track('check_start');
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});
