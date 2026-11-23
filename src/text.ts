const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** HTML (possibly entity-escaped, as Greenhouse sends it) → plain text, capped. */
export function htmlToText(html: string | undefined | null, max = 6000): string {
  if (!html) return '';
  let s = String(html);
  // Greenhouse double-escapes: decode once before stripping tags.
  if (/&lt;\/?[a-z]/i.test(s)) s = decode(s);
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decode(s).replace(/[ \t ]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function decode(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+|#39);/gi, (m, e: string) => {
    if (ENTITIES[e.toLowerCase()]) return ENTITIES[e.toLowerCase()];
    if (e[0] === '#') {
      const n = e[1]?.toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** Lowercase, accents stripped: for matching only, never for display. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Parses epoch seconds, epoch ms, or a date string into ISO; undefined when not a real date. */
export function toIso(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  let d: Date;
  if (typeof v === 'number' || (typeof v === 'string' && /^\d{9,13}$/.test(v))) {
    const n = Number(v);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else d = new Date(String(v));
  const t = d.getTime();
  if (!Number.isFinite(t) || t < Date.UTC(2015, 0, 1)) return undefined;
  return d.toISOString();
}
