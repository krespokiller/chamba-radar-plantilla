// Job-alert emails (LinkedIn, Magneto, Computrabajo, elempleo, Indeed, Get on Board) read from one
// Gmail label over IMAP. These sites have no public API we may use, but they all email alerts, and
// the alerts are the user's own mail: reading them is the reliable, terms-friendly way in.
import type { Job } from '../types.ts';
import { htmlToText, fold } from '../text.ts';

export interface Classified { site: string; id: string; url: string }

/** Recognizes a job link from a supported site and returns its canonical URL. */
export function classify(href: string): Classified | null {
  let u: URL;
  try { u = new URL(href.replace(/&amp;/g, '&')); } catch { return null; }
  const h = u.hostname.replace(/^www\./, '');
  const p = decodeURIComponent(u.pathname);
  let m: RegExpExecArray | null;
  if (/(^|\.)linkedin\.com$/.test(h) && (m = /\/jobs\/view\/(?:[^/]*?-)?(\d{6,})/.exec(p)))
    return { site: 'linkedin', id: m[1], url: `https://www.linkedin.com/jobs/view/${m[1]}` };
  if (/(^|\.)linkedin\.com$/.test(h) && u.searchParams.get('currentJobId'))
    return { site: 'linkedin', id: u.searchParams.get('currentJobId')!, url: `https://www.linkedin.com/jobs/view/${u.searchParams.get('currentJobId')}` };
  if (/(^|\.)magneto365\.com$/.test(h) && (m = /^\/([a-z]{2})\/empleos\/([a-z0-9-]+-(\d+))\/?$/.exec(p)))
    return { site: 'magneto', id: m[3], url: `https://www.magneto365.com/${m[1]}/empleos/${m[2]}` };
  if (/computrabajo\.com/.test(h) && (m = /\/ofertas-de-trabajo\/(oferta-de-trabajo-de-[a-z0-9-]+?-([0-9A-F]{20,}))/i.exec(p)))
    return { site: 'computrabajo', id: m[2], url: `https://${h}/ofertas-de-trabajo/${m[1]}` };
  if (/(^|\.)elempleo\.com$/.test(h) && (m = /\/ofertas-trabajo\/([a-z0-9-]+?-(\d{6,}))/.exec(p)))
    return { site: 'elempleo', id: m[2], url: `https://www.elempleo.com/co/ofertas-trabajo/${m[1]}` };
  if (/(^|\.)indeed\.com$/.test(h) && u.searchParams.get('jk'))
    return { site: 'indeed', id: u.searchParams.get('jk')!, url: `https://co.indeed.com/viewjob?jk=${u.searchParams.get('jk')}` };
  if (/(^|\.)getonbrd\.com$/.test(h) && (m = /^\/jobs\/([a-z0-9-]+\/[a-z0-9-]+)\/?$/.exec(p)))
    return { site: 'getonbrd', id: m[1], url: `https://www.getonbrd.com/jobs/${m[1]}` };
  return null;
}

const GENERIC = /^(ver( la)? (oferta|empleo|vacante|mas|todas?)|view (job|all|more)|see (all|more)( jobs)?|apply( now)?|aplicar( ahora)?|postular(me|se)?( ahora)?|easy apply|solicitud sencilla|mas informacion|unsubscribe|cancelar suscripcion|\d+ (new|nuevos?) .*|.*ver \d+ empleos.*)$/;
const LOCATION_HINT = /colombia|bogota|medellin|cali|barranquilla|remot|remote|hibrid|hybrid|latam|america|presencial|on-site|,/;

interface Anchor { href: string; text: string; start: number; end: number }

function anchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b[^>]*?href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push({ href: m[2], text: htmlToText(m[3], 300).replace(/\s+/g, ' ').trim(), start: m.index, end: m.index + m[0].length });
  return out;
}

export interface AlertEmail { html: string; date: Date; from: string; subject: string }

/**
 * Pulls jobs out of one alert email. `resolve` maps a tracking link (Magneto and Computrabajo wrap
 * links in click trackers) to its destination; pass a cache-backed resolver, or none in tests.
 */
export async function extractAlertJobs(mail: AlertEmail, resolve?: (href: string) => Promise<string | null>): Promise<Job[]> {
  const list = anchors(mail.html);
  const linked: { a: Anchor; c: Classified }[] = [];
  for (const a of list) {
    let c = classify(a.href);
    if (!c && resolve && /^https?:/i.test(a.href) && a.text.length >= 4 && !GENERIC.test(fold(a.text))) {
      const dest = await resolve(a.href);
      if (dest) c = classify(dest);
    }
    if (c) linked.push({ a, c });
  }
  const byId = new Map<string, { c: Classified; as: Anchor[] }>();
  for (const { a, c } of linked) {
    const k = `${c.site}:${c.id}`;
    if (!byId.has(k)) byId.set(k, { c, as: [] });
    byId.get(k)!.as.push(a);
  }
  const order = [...byId.values()];
  const jobs: Job[] = [];
  for (let i = 0; i < order.length; i++) {
    const { c, as } = order[i];
    const titleA = as.find((a) => a.text.length >= 4 && a.text.length <= 140 && !GENERIC.test(fold(a.text)));
    if (!titleA) continue;
    // Context: what the email says between this job's title and the next job's first link.
    const nextStart = order[i + 1]?.as[0]?.start ?? Math.min(mail.html.length, titleA.end + 4000);
    const ctx = htmlToText(mail.html.slice(titleA.end, Math.max(titleA.end, nextStart)), 1200);
    const lines = ctx.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !GENERIC.test(fold(l)) && l !== titleA.text);
    let company = '', location = '';
    const dot = lines.find((l) => / [·•|] /.test(l));
    if (dot && lines.indexOf(dot) <= 1) {
      [company, location] = dot.split(/ [·•|] /).map((x) => x.trim());
    } else {
      company = lines[0] ?? '';
      if (lines[1] && LOCATION_HINT.test(fold(lines[1]))) location = lines[1];
    }
    if (company.length > 80) company = '';
    jobs.push({
      id: `${c.site}:${c.id}`,
      source: `email:${c.site}`,
      company: company || '(ver en el enlace)',
      title: titleA.text,
      url: c.url,
      location: location || (c.site === 'magneto' || c.site === 'elempleo' || c.site === 'computrabajo' ? 'Colombia' : ''),
      remoteHint: /remot|remote/.test(fold(location)) ? true : undefined,
      postedAt: mail.date.toISOString(),
      description: lines.slice(0, 12).join('\n'),
      tags: [`alerta:${c.site}`],
    });
  }
  return jobs;
}

const TRACKERS = /sendgrid\.net|ct\.sendgrid|mandrillapp|mailchimp|list-manage|click\.|clicks\.|links\.|track\.|trk\.|\.hubspotlinks|r\.mail|email\.|go\.|lnk\./i;

/** Follows a tracker's redirects (no body download) to find the real job URL. */
export function makeResolver(limit: number) {
  const cache = new Map<string, string | null>();
  let used = 0;
  return async (href: string): Promise<string | null> => {
    if (cache.has(href)) return cache.get(href)!;
    let host = '';
    try { host = new URL(href).hostname; } catch { return null; }
    if (!TRACKERS.test(host) || used >= limit) return null;
    used++;
    let url = href;
    try {
      for (let hop = 0; hop < 6; hop++) {
        const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'chamba-radar/1.0' } });
        await res.body?.cancel();
        const loc = res.headers.get('location');
        if (!loc || res.status < 300 || res.status >= 400) break;
        url = new URL(loc, url).toString();
        if (classify(url)) break;
      }
    } catch { /* unreachable tracker: skip the link */ }
    const out = url === href ? null : url;
    cache.set(href, out);
    return out;
  };
}

/** Reads the label over IMAP. Needs GMAIL_USER and GMAIL_APP_PASSWORD (a revocable app password). */
export async function emailAlerts(opts: { mailbox: string; windowDays: number; maxMessages: number; resolveLimit: number }): Promise<Job[]> {
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new SkipSource('sin GMAIL_USER / GMAIL_APP_PASSWORD');
  const { ImapFlow } = await import('imapflow');
  const { simpleParser } = await import('mailparser');
  const client = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user, pass }, logger: false });
  await client.connect();
  const resolve = makeResolver(opts.resolveLimit);
  const out: Job[] = [];
  try {
    const lock = await client.getMailboxLock(opts.mailbox).catch((e: Error) => {
      throw new Error(`no encuentro la etiqueta "${opts.mailbox}" en Gmail (${e.message})`);
    });
    try {
      const since = new Date(Date.now() - opts.windowDays * 86_400_000);
      const uids = (await client.search({ since }, { uid: true })) || [];
      const pick = uids.slice(-opts.maxMessages);
      if (pick.length) {
        for await (const msg of client.fetch(pick, { source: true }, { uid: true })) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const html = typeof parsed.html === 'string' ? parsed.html : (parsed.textAsHtml ?? '');
          out.push(...await extractAlertJobs({ html, date: parsed.date ?? new Date(), from: parsed.from?.text ?? '', subject: parsed.subject ?? '' }, resolve));
        }
      }
    } finally { lock.release(); }
  } finally { await client.logout().catch(() => {}); }
  return out;
}

/** A source that is not configured: reported in the digest, not treated as a failure. */
export class SkipSource extends Error {}
