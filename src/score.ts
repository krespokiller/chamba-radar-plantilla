// Filtering and scoring. Everything here is deterministic and testable: no network.
import type { Eligibility, Job, Scored, Tier } from './types.ts';
import type { Profile } from './profile.ts';
import { fold } from './text.ts';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Whole-word match that also works for tokens like ".net", "c#" or "node.js". */
function wordRe(words: string[]): RegExp {
  // An empty list must match nothing (an empty alternation would match any separator).
  if (!words.filter(Boolean).length) return /(?!)/;
  return new RegExp(`(^|[^a-z0-9])(${words.map((w) => esc(fold(w))).join('|')})(?=$|[^a-z0-9])`, 'i');
}

export interface TitleVerdict { keep: boolean; why?: string }

export function titleFilter(title: string, p: Profile): TitleVerdict {
  const t = fold(title);
  const excl = wordRe(p.excludeTitle).exec(t);
  // "Java" must not knock out "JavaScript", and "Go" must not knock out "Go-to-market Engineer"… the
  // word regex already requires a non-alphanumeric boundary, so "javascript" never matches "java".
  if (excl) return { keep: false, why: `título excluido (${excl[2]})` };
  // A role word alone ("Lead", "Engineer") lets in Partnerships Leads and Analytics Engineers; the
  // title has to name the area (backend, full stack, software, tech lead, a stack word…).
  if (!wordRe(p.areaWords).test(t)) return { keep: false, why: 'título fuera del perfil' };
  return { keep: true };
}

/** Offers read straight from the company's ATS, Get on Board, Magneto or the person's own email alerts. Everything else is an aggregator copy. */
export function isDirect(src: string): boolean {
  return /^(greenhouse|lever|ashby|workable|smartrecruiters|recruitee):|^getonbrd|^magneto|^email:/.test(src);
}
export interface TitleRule { pattern: string; points: number; reason: string; unless?: string }

/** Neutral rules for a profile that does not set `seniority` / `titleBonuses` (each person tunes theirs). */
export const DEFAULT_SENIORITY: TitleRule[] = [
  { pattern: '(^|[^a-z])(lead|leader|lider|head of|jefe|jefa|coordinador|coordinadora|manager|gerente)([^a-z]|$)', points: 20, reason: 'rol de liderazgo' },
  { pattern: '(^|[^a-z])(senior|sr\\.?|staff|principal|especialista|specialist|semi ?senior|ssr|architect|arquitecto)([^a-z]|$)', points: 15, reason: 'senior' },
];
export const DEFAULT_TITLE_BONUSES: TitleRule[] = [];

type Compiled = { re: RegExp; unless?: RegExp; points: number; reason: string };
const cache = new WeakMap<Profile, { seniority: Compiled[]; titleBonuses: Compiled[] }>();
function compiled(p: Profile) {
  let c = cache.get(p);
  if (!c) {
    const comp = (rs: TitleRule[]) => rs.map((r) => ({ re: new RegExp(r.pattern), unless: r.unless ? new RegExp(r.unless) : undefined, points: r.points, reason: r.reason }));
    c = { seniority: comp(p.seniority ?? DEFAULT_SENIORITY), titleBonuses: comp(p.titleBonuses ?? DEFAULT_TITLE_BONUSES) };
    cache.set(p, c);
  }
  return c;
}

const JUNIOR = /(^|[^a-z])(junior|jr|trainee|intern|practicante|aprendiz)([^a-z]|$)/;

// Words in a location that say *how* you work, not *where*. Whatever is left after removing them is a place.
const MODE_WORDS = /\b(fully[_ ]remote|remote|remoto|remota|100%|teletrabajo|trabajo remoto|work from home|wfh|anywhere|only|full[- ]time|contract|contractor|freelance|permanent|temporary)\b/g;
const ONSITE = /\b(hybrid|hibrido|hibrida|no_remote|on-?site|in-?office|office|oficina|presencial|remote_local)\b/;

// Countries/regions whose work authorization a Colombian job seeker usually lacks. Used to read "authorized to work in X".
const FOREIGN = '(the )?(us|u\\.s\\.?|usa|u\\.s\\.a\\.?|united states|america|canada|uk|u\\.k\\.|united kingdom|eu|european union|europe|eea|germany|spain|portugal|france|netherlands|ireland|poland|australia|new zealand|singapore|india|israel|brazil|brasil|mexico|argentina|chile|uruguay|peru)';

// Wording that ties the job to a country's work authorization, payroll or residence.
const WORK_AUTH = new RegExp([
  `(legally )?(authorized|authorised|eligible|permitted) to work (in|from|within) ${FOREIGN}\\b`,
  `(must|need to|required to) (be|reside|live|be located|be based) (located |based |residing )?(in|within) ${FOREIGN}\\b`,
  `(right|permission) to work in ${FOREIGN}\\b`,
  `(work (permit|authorization|authorisation)|residency) (in|for) ${FOREIGN}\\b`,
  `\\b(us|u\\.s\\.|eu|uk|canadian|american|brazilian|mexican) (citizen(ship)?|permanent resident|work (permit|authorization))`,
  `(us|u\\.s\\.|united states|usa|uk|eu|canada)[- ](based|residents?) (only|candidates|applicants)`,
  `(united states|usa|us|uk|canada|eu) only\\b`,
  `only (candidates|applicants|people|those) (who are )?(based|located|residing|living) in`,
  `open (only )?to (candidates|applicants) (based |located |residing )?in ${FOREIGN}\\b`,
  `\\bi-9\\b|e-verify|employment eligibility verification|green card|security clearance|\\bh-?1b\\b`,
  // "the location you plan to consider your primary residence and are legally authorized to work in":
  // the posting is pinned to a hiring country (Customer.io, 2026-11-09).
  `primary residence and (are )?(legally )?authori[sz]ed to work`,
].join('|'));

// "We can't sponsor visas / no relocation support": the role is hired inside a specific country.
const NO_SPONSOR = /(no|not|unable to|cannot|can't|can ?not|will not|won't|do not|don't|are not able to|aren't able to|is not able to) (currently )?(provide|offer|support|sponsor|be able to (offer|provide|sponsor))?( any)? ?(visa|immigration|work (visa|permit))? ?sponsor/;

// Built for people in Colombia: any Colombian city counts, remote, hybrid or on-site.
const COLOMBIA = new RegExp('colombia|\\bco\\b$|cundinamarca|antioquia|santander|' + [
  'bogota', 'chia', 'medellin', 'cali', 'barranquilla', 'cartagena', 'bucaramanga', 'pereira', 'manizales',
  'armenia', 'cucuta', 'ibague', 'santa marta', 'villavicencio', 'pasto', 'monteria', 'neiva', 'popayan',
  'tunja', 'valledupar', 'sincelejo', 'envigado', 'itagui', 'sabaneta', 'rionegro', 'zipaquira', 'cajica',
  'soacha', 'funza', 'mosquera', 'tenjo', 'cota', 'floridablanca', 'palmira', 'yumbo', 'soledad',
].map((c) => `\\b${c}\\b`).join('|'));

/**
 * Can the person do this job from Colombia, without leaving the country and without any foreign work authorization or passport?
 * Only remote roles open to Colombia, LatAm or the whole world pass. Relocation or visa sponsorship
 * is not a way in. Location fields are trusted over descriptions, and explicit work-authorization
 * language in the body beats a vague or even a "worldwide" location label from an aggregator.
 */
/** "Remote (UTC-6 to UTC+2)", "GMT-5 – GMT+3": does the stated time-zone range include Colombia (UTC-5)? */
export function tzCoversColombia(loc: string): boolean {
  const offs = [...loc.matchAll(/(?:utc|gmt)\s*([+\-\u2212])\s*(\d{1,2})(?::?\d{2})?/g)].map((m) => (m[1] === '+' ? 1 : -1) * Number(m[2]));
  if (/(?:utc|gmt)(?!\s*[+\-\u2212]\s*\d)/.test(loc) && /(?:utc|gmt)\s*[+\-\u2212]/.test(loc)) offs.push(0);
  if (offs.length < 2) return false;
  return Math.min(...offs) <= -5 && Math.max(...offs) >= -5;
}

/** Where a location-blocked role sits, for the funnel table. */
export function blockedBucket(job: Job): string {
  const loc = fold(job.location);
  const text = fold(job.description).replace(/\s+/g, ' ');
  if (WORK_AUTH.test(text) && !COLOMBIA.test(loc)) return 'ubicación: pide autorización de trabajo de otro país';
  if (ONSITE.test(loc)) return 'ubicación: presencial/híbrido fuera de Colombia';
  if (/\b(us|usa|u s|united states|canada|nyc|new york|san francisco|california|texas|seattle|boston|chicago|toronto|vancouver|north america|[a-z]+, (ca|ny|tx|wa|ma|il|co|fl|ga|nc|va|or|ut|az|pa|nj|on|bc))\b/.test(loc)) return 'ubicación: EE. UU./Canadá';
  if (/\b(emea|europe|eu|uk|united kingdom|london|germany|berlin|spain|madrid|barcelona|portugal|lisbon|france|paris|netherlands|amsterdam|ireland|dublin|poland|italy|sweden|switzerland|austria|belgium|denmark|finland|norway|czech|romania|greece|cet|cest)\b/.test(loc)) return 'ubicación: Europa/UK/EMEA';
  if (/\b(brazil|brasil|mexico|argentina|chile|peru|uruguay|ecuador|costa rica|sao paulo|cdmx|buenos aires|santiago)\b/.test(loc)) return 'ubicación: otro país de LatAm';
  if (/\b(india|apac|asia|singapore|australia|japan|philippines|new zealand|israel|uae|dubai)\b/.test(loc)) return 'ubicación: Asia/Oceanía/Medio Oriente';
  return 'ubicación: otra';
}

// Words that suggest a company hires outside its home country (contractors, an EOR, "anywhere").
const HIRES_ABROAD = /(independent contractor|as a contractor|contractor basis|employer of record|\beor\b|through deel|via deel|\bdeel\b|remote\.com|oyster|work from anywhere|from anywhere in the world|any time ?zone|fully distributed|hire (globally|worldwide|anywhere)|we hire in (most|many) countries)/;

/** Blocked only by a foreign location, with no work-authorization wording and hints that they hire abroad. */
export function maybeAbroad(job: Job): boolean {
  const text = fold(job.description).replace(/\s+/g, ' ');
  const loc = fold(job.location);
  if (WORK_AUTH.test(text) || ONSITE.test(loc) || NO_SPONSOR.test(text)) return false;
  return HIRES_ABROAD.test(text);
}

export function eligibility(job: Job): Eligibility {
  const loc = fold(job.location).replace(/\s+/g, ' ').trim();
  const text = fold(job.description).replace(/\s+/g, ' ');
  const colombiaLoc = COLOMBIA.test(loc);

  if (WORK_AUTH.test(text) && !colombiaLoc) return 'blocked';
  if (colombiaLoc) return 'colombia';
  if (ONSITE.test(loc)) return 'blocked';
  if (/latam|latin america|latinoamerica|america latina|south america|\bamer\b|americas\b|\blat\.? ?am\b/.test(loc)) return 'latam';
  if (/worldwide|anywhere|global|work from anywhere|cualquier lugar|any (country|location)/.test(loc)) return 'worldwide';
  if (tzCoversColombia(loc)) return 'worldwide';

  // Anything left in the location once "remote"-style words are gone names a place (Brazil, London,
  // "Remote - Munich", EMEA, Canada…). Remote-to-that-place is not reachable from Colombia.
  const place = loc.replace(MODE_WORDS, ' ').replace(/[^a-z]+/g, ' ').trim();
  if (place) return 'blocked';

  // A bare "Remote" that refuses sponsorship is remote inside one country, not remote from anywhere.
  if (NO_SPONSOR.test(text)) return 'blocked';
  if (/latam|latin america|latinoamerica|america latina|colombia|south america/.test(text)) return 'latam';
  return 'unknown';
}

export function sponsorship(job: Job): Scored['sponsorship'] {
  return NO_SPONSOR.test(fold(job.description).replace(/\s+/g, ' ')) ? 'denied' : 'none';
}

const PER_MONTH: Record<string, number> = { year: 1 / 12, month: 1, hour: 160 };

export function monthlyUsd(job: Job, p: Profile): Scored['monthlyUsd'] | undefined {
  const s = job.salary;
  if (!s) return undefined;
  const fx = p.fxToUsd[s.currency.toUpperCase()];
  if (!fx) return undefined;
  const k = PER_MONTH[s.period] * fx;
  const r = (v?: number) => (v ? Math.round(v * k) : undefined);
  return { min: r(s.min), max: r(s.max) };
}

export function score(job: Job, p: Profile, now = new Date(), firstSeen = now.toISOString()): Scored | null {
  const title = fold(job.title);
  const all = fold(`${job.title}\n${job.description}\n${job.tags.join(' ')}`);
  const reasons: string[] = [];
  let s = 0;

  if (!titleFilter(job.title, p).keep) return null;
  const elig = eligibility(job);
  if (elig === 'blocked') return null;

  // Freshness. Aggregators recycle stale posts, so they keep the short window. A role on the company's
  // own ATS is open until they take it down, even if it was published three weeks ago.
  const direct = isDirect(job.source);
  const win = direct ? (p.directWindowDays ?? p.windowDays) : p.windowDays;
  const when = Date.parse(job.postedAt ?? firstSeen);
  const ageDays = (now.getTime() - when) / 86_400_000;
  if (ageDays > win) return null;

  // Seniority: the first rule that matches the title wins.
  if (JUNIOR.test(title)) return null;
  const sen = compiled(p).seniority.find((r) => r.re.test(title));
  if (sen) { s += sen.points; reasons.push(sen.reason); }
  else s += p.seniorityDefault ?? 6;

  // Title bonuses and penalties: every rule that matches applies.
  for (const r of compiled(p).titleBonuses) {
    if (r.re.test(title) && !(r.unless && r.unless.test(title))) { s += r.points; reasons.push(r.reason); }
  }

  // Stack (each keyword counted once; aliases with weight 0 only make the canonical one match)
  let stack = 0;
  const hits: string[] = [];
  for (const [kw, w] of Object.entries(p.stack)) {
    if (w > 0 && wordRe([kw]).test(all)) { stack += w; hits.push(kw); }
  }
  if (!hits.includes('node') && /node\.?js|nodejs/.test(all)) { stack += p.stack.node ?? 0; hits.push('node'); }
  if (!hits.includes('nestjs') && /nest\.?js/.test(all)) { stack += p.stack.nestjs ?? 0; hits.push('nestjs'); }
  stack = Math.min(stack, 35);
  s += stack;
  if (hits.length) reasons.push(`stack: ${hits.slice(0, 6).join(', ')}`);

  // Domain
  const dom = p.domain.find((d) => wordRe([d]).test(all));
  if (dom) { s += 10; reasons.push(`dominio: ${dom}`); }
  // Optional bonus when the posting is AI-heavy (profile.aiWords).
  const ai = (p.aiWords ?? []).find((d) => wordRe([d]).test(all));
  if (ai) { s += 10; reasons.push(`IA: ${ai}`); }

  // Where can the person work it from
  const eligPts: Record<Eligibility, number> = { worldwide: 15, latam: 18, colombia: 18, unknown: 4, blocked: 0 };
  s += eligPts[elig];
  reasons.push({ worldwide: 'remoto global', latam: 'abierto a LatAm', colombia: 'Colombia', unknown: 'ubicación sin confirmar', blocked: '' }[elig]);

  // Pay
  const mu = monthlyUsd(job, p);
  const top = mu?.max ?? mu?.min;
  const belowFloor = top !== undefined && top < p.floorMonthlyUsd && job.salary?.currency !== 'COP';
  if (top !== undefined) {
    if (belowFloor) { s -= 15; reasons.push(`paga ≈ USD ${top.toLocaleString('en-US')}/mes, bajo tu piso`); }
    else if (top >= p.floorMonthlyUsd) { s += 10; reasons.push(`paga ≈ USD ${top.toLocaleString('en-US')}/mes`); }
  }

  // Freshness bonus: today 10 → 7 days 0 (older direct roles stay in, without bonus)
  s += Math.max(0, Math.round(10 * (1 - ageDays / p.windowDays)));

  // Aggregators republish and redirect: they never reach the top tier, and the digest says so.
  if (!direct) { s -= 12; reasons.push('agregador: busca la oferta original en la web de la empresa'); }

  const sp = sponsorship(job);

  const tier: Tier = s >= 65 && direct ? 'strong' : s >= 40 ? 'possible' : 'weak';
  return { ...job, score: s, tier, eligibility: elig, sponsorship: sp, monthlyUsd: mu, belowFloor, reasons, firstSeen };
}

/** Why score() returned null, for the funnel table in the digest. */
export function dropReason(job: Job, p: Profile, now = new Date(), firstSeen = now.toISOString()): string {
  const tv = titleFilter(job.title, p);
  if (!tv.keep) return tv.why!.startsWith('título excluido') ? 'título excluido' : 'título fuera del perfil';
  if (eligibility(job) === 'blocked') return blockedBucket(job);
  if (JUNIOR.test(fold(job.title))) return 'junior';
  return 'fuera de la ventana de fechas';
}

/** Same role posted on several boards → one entry. Company ATS wins over aggregators. */
export function dedupeKey(job: Pick<Job, 'company' | 'title'>): string {
  const norm = (x: string) => fold(x).replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(inc|llc|ltd|sas|s a s|corp)\b/g, '').trim();
  return `${norm(job.company)}|${norm(job.title)}`;
}

const PRIORITY = (src: string) =>
  /^(greenhouse|lever|ashby|workable|smartrecruiters|recruitee):/.test(src) ? 0 : /^(getonbrd|magneto)/.test(src) ? 1 : /^email:/.test(src) ? 3 : 2;

export function dedupe<T extends Job>(jobs: T[]): T[] {
  const best = new Map<string, T>();
  for (const j of jobs) {
    const k = dedupeKey(j);
    const cur = best.get(k);
    if (!cur || PRIORITY(j.source) < PRIORITY(cur.source)) best.set(k, j);
  }
  return [...best.values()];
}
