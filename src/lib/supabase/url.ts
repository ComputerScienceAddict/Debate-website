/** Supabase expects `https://<project>.supabase.co` — strip accidental `/rest/v1/` etc. */
export function normalizeSupabaseUrl(raw: string): string {
  const s = raw.trim().replace(/\/+$/, "");
  if (!s) return "";
  try {
    const url = new URL(s);
    if (/\/rest\/v\d+/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/rest\/v\d+\/?$/i, "");
    }
    return url.pathname && url.pathname !== "/"
      ? `${url.origin}${url.pathname}`
      : url.origin;
  } catch {
    return s.replace(/\/rest\/v\d+\/?$/i, "").replace(/\/+$/, "");
  }
}
