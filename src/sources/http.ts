const UA = 'chamba-radar/1.0 (personal job search)';
const MAX_BYTES = 12 * 1024 * 1024;

export class HttpError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

async function get(url: string, accept: string, timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new HttpError(res.status, `HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > MAX_BYTES) throw new Error(`too large (${len} bytes)`);
    const body = await res.text();
    if (body.length > MAX_BYTES) throw new Error(`too large (${body.length} chars)`);
    return body;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error(`timeout after ${timeoutMs} ms`);
    throw e;
  } finally { clearTimeout(t); }
}

export async function getJson<T = unknown>(url: string, timeoutMs = 20000): Promise<T> {
  const body = await get(url, 'application/json', timeoutMs);
  try { return JSON.parse(body) as T; } catch { throw new Error('invalid JSON'); }
}

export async function getText(url: string, timeoutMs = 20000): Promise<string> {
  return get(url, 'application/rss+xml, application/xml, text/xml, */*', timeoutMs);
}
