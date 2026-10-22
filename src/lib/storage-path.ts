/** Legacy CRM records contain a public URL even though the bucket is private. */
export function crmStoragePath(value: string): string | null {
  if (!value.startsWith('http')) return value && !value.startsWith('/') ? value : null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/crm-files\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}