import { expect, it } from 'vitest';
import { crmStoragePath } from './storage-path';

it('supports legacy private CRM URLs and new object paths without public downloads', () => {
  expect(crmStoragePath('https://example.invalid/storage/v1/object/public/crm-files/lead/test%20file.pdf')).toBe('lead/test file.pdf');
  expect(crmStoragePath('https://example.invalid/storage/v1/object/sign/crm-files/lead/test.pdf?token=ignored')).toBe('lead/test.pdf');
  expect(crmStoragePath('lead/test.pdf')).toBe('lead/test.pdf');
  expect(crmStoragePath('https://example.invalid/unrelated.pdf')).toBeNull();
});