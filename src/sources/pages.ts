// Public listing pages (e.g. a Magneto search saved from the browser): collect job links, open each
// one and read the posting. Uses schema.org JobPosting (JSON-LD) when the page has it, and falls back
// to the page's meta tags and visible labels otherwise. Polite: few pages, sequential, one UA.
import type { Job, Salary } from '../types.ts';
import type { PageSource } from '../profile.ts';
import { getText } from './http.ts';
import { htmlToText, toIso } from '../text.ts';

const meta = (html: string, key: string) =>
  new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html)?.[1]
  ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, 'i').exec(html)?.[1];

export function jobLinks(html: string, base: string, pattern: string): string[] {
  const re = new RegExp(pattern);
  const out = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+)["']/gi)) {
    let abs: string;
    try { abs = new URL(m[1].replace(/&amp;/g, '&'), base).toString(); } catch { continue; }
    const path = new URL(abs).pathname;
    if (re.test(path) || re.test(abs)) out.add(abs.split('?')[0]);
  }
  return [...out];
}

type Raw = Record<string, any>;

function findJobPosting(node: unknown): Raw | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findJobPosting(n); if (r) return r; } return null; }
  const o = node as Raw;
  const t = o['@type'];
  if (t === 'JobPosting' || (Array.isArray(t) && t.includes('JobPosting'))) return o;
  return findJobPosting(o['@graph']);
}

const COP = /(?:COP|\$)\s?([\d.]{6,})(?:\s*(?:a|-|–)\s*(?:COP|\$)?\s?([\d.]{6,}))?/i;

export function parsePosting(html: string, url: string, source: string, country?: string): Job | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try { data = JSON.parse(m[1].trim()); } catch { continue; }
    const jp = findJobPosting(data);
    if (!jp) continue;
    const loc = [].concat(jp.jobLocation ?? []).map((l: Raw) => [l?.address?.addressLocality, l?.address?.addressRegion, l?.address?.addressCountry?.name ?? l?.address?.addressCountry].filter(Boolean).join(', ')).filter(Boolean);
    const remote = jp.jobLocationType === 'TELECOMMUTE';
    const bs = jp.baseSalary?.value;
    const unit = String(bs?.unitText ?? '').toUpperCase();
    const salary: Salary | undefined = bs && (bs.minValue || bs.maxValue || bs.value) ? {
      min: Number(bs.minValue ?? bs.value) || undefined, max: Number(bs.maxValue ?? bs.value) || undefined,
      currency: String(jp.baseSalary.currency ?? 'COP').toUpperCase(),
      period: unit === 'YEAR' ? 'year' : unit === 'HOUR' ? 'hour' : 'month',
    } : undefined;
    return {
      id: `${source}:${url}`, source, url,
      company: jp.hiringOrganization?.name ?? '', title: htmlToText(jp.title, 200),
      location: [remote ? 'Remoto' : '', ...loc, country ?? ''].filter(Boolean).join('; '),
      remoteHint: remote || undefined, postedAt: toIso(jp.datePosted),
      description: htmlToText(jp.description), salary, tags: [jp.employmentType].flat().filter(Boolean),
    };
  }
  // Fallback: meta tags + labelled text such as "Fecha de publicación 2026-11-05" / "COP 1.838.000".
  const title = htmlToText(meta(html, 'og:title') ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? '', 200);
  if (!title) return null;
  const text = htmlToText(html, 20000);
  const date = /fecha de publicaci[oó]n\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/i.exec(text)?.[1];
  const iso = date?.includes('/') ? toIso(date.split('/').reverse().join('-')) : toIso(date);
  const sal = COP.exec(text);
  const n = (s?: string) => (s ? Number(s.replace(/\./g, '')) : undefined);
  const company = /(?:empresa|company)\s*:?\s*\n?\s*([^\n]{2,60})/i.exec(text)?.[1]?.trim() ?? '';
  return {
    id: `${source}:${url}`, source, url, company, title,
    location: [/remot/i.test(text.slice(0, 3000)) ? 'Remoto' : '', country ?? ''].filter(Boolean).join('; '),
    remoteHint: /trabajo remoto|100% remoto|modalidad:?\s*remot/i.test(text) || undefined,
    postedAt: iso, description: (meta(html, 'og:description') ?? '') + '\n' + text.slice(0, 5000),
    salary: sal ? { min: n(sal[1]), max: n(sal[2]) ?? n(sal[1]), currency: 'COP', period: 'month' } : undefined,
    tags: [],
  };
}

export async function pageSource(ps: PageSource): Promise<Job[]> {
  const listing = await getText(ps.url);
  const links = jobLinks(listing, ps.url, ps.linkPattern).slice(0, ps.max ?? 30);
  if (!links.length) throw new Error(`no encontré enlaces que cumplan ${ps.linkPattern} en ${ps.url}`);
  const out: Job[] = [];
  for (const url of links) {
    try {
      const job = parsePosting(await getText(url), url, ps.name, ps.country);
      if (job) out.push(job);
    } catch { /* one broken page should not sink the source */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}
