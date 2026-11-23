// chamba-radar: one run = fetch every source, keep what fits the profile, report only what is new.
//   node src/main.ts            normal run (writes data/state.json and digest/)
//   node src/main.ts --dry      fetch and print, write nothing
//   node src/main.ts --only=getonbrd,email   run a subset of sources (names as in the digest)
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import type { Job, Scored, SourceResult } from './types.ts';
import { loadProfile } from './profile.ts';
import { loadState, saveState, type Ats, type State } from './state.ts';
import { score, dedupe, dedupeKey, dropReason, maybeAbroad } from './score.ts';
import { renderDigest } from './digest.ts';
import { greenhouse, lever, ashby, workable, smartrecruiters, recruitee } from './sources/ats.ts';
import * as boards from './sources/boards.ts';
import { pageSource } from './sources/pages.ts';
import { emailAlerts, SkipSource } from './sources/email.ts';

const args = new Set(process.argv.slice(2));
const dry = args.has('--dry');
const only = [...args].find((a) => a.startsWith('--only='))?.slice(7).split(',');
const now = new Date();
const profile = loadProfile();
const state: State = loadState();

const pretty = (slug: string) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const ATS_FN = { greenhouse, lever, ashby, workable, smartrecruiters, recruitee } as const;
// 'none' verdicts older than this were made before Workable/SmartRecruiters/Recruitee were checked.
const ATS_LIST_SINCE = Date.parse('2026-11-23T19:00:00Z');

/** Finds which ATS a company uses (cached for two weeks when none matched). */
// Discovering a company's ATS costs up to six requests, and Workable rate-limits hard. Spread the
// discovery of a long list over several runs: a budget of Workable probes and a time budget per run.
const START = Date.now();
const DISCOVERY_MS = 14 * 60_000;
let workableProbes = 0;
const WORKABLE_PROBES_PER_RUN = 150;
let deferred = 0;

async function atsJobs(slug: string): Promise<{ jobs: Job[]; kind: Ats }> {
  const known = state.ats[slug];
  const fresh = known && now.getTime() - Date.parse(known.checkedAt) < 14 * 86_400_000 && Date.parse(known.checkedAt) >= ATS_LIST_SINCE;
  if (known && known.kind !== 'none') {
    try { return { jobs: await ATS_FN[known.kind](slug, pretty(slug)), kind: known.kind }; }
    catch (e) { if ((e as any).status !== 404) throw e; }
  } else if (fresh) return { jobs: [], kind: 'none' };
  if (Date.now() - START > DISCOVERY_MS) { deferred++; return { jobs: [], kind: 'none' }; }
  for (const kind of ['greenhouse', 'lever', 'ashby', 'recruitee', 'smartrecruiters', 'workable'] as const) {
    if (kind === 'workable') {
      if (workableProbes >= WORKABLE_PROBES_PER_RUN) { deferred++; return { jobs: [], kind: 'none' }; }
      workableProbes++;
    }
    try {
      const jobs = await ATS_FN[kind](slug, pretty(slug));
      state.ats[slug] = { kind, checkedAt: now.toISOString() };
      return { jobs, kind };
    } catch (e) {
      const st = (e as any).status;
      // Rate-limited: we do not know yet. Skip this company this run without caching a verdict.
      if (st === 429) return { jobs: [], kind: 'none' };
      if (![404, 400].includes(st)) throw e;
    }
  }
  state.ats[slug] = { kind: 'none', checkedAt: now.toISOString() };
  return { jobs: [], kind: 'none' };
}

type Task = { name: string; run: () => Promise<Job[]> };
const src = profile.sources ?? {};
const tasks: Task[] = [
  { name: 'remotive', run: () => boards.remotive(src.remotiveCategory) },
  { name: 'himalayas', run: boards.himalayas },
  { name: 'jobicy', run: () => boards.jobicy(src.jobicyTags) },
  { name: 'remoteok', run: boards.remoteok },
  { name: 'getonbrd', run: () => boards.getonbrd(src.getonbrdQueries) },
  { name: 'weworkremotely', run: () => boards.weworkremotely(src.weworkremotelyCategories) },
  ...profile.pages.map((ps) => ({ name: ps.name, run: () => pageSource(ps) })),
  { name: 'email', run: () => emailAlerts({ mailbox: profile.email.mailbox, windowDays: profile.windowDays, maxMessages: profile.email.maxMessages, resolveLimit: profile.email.resolveLimit }) },
  ...profile.boards.map((slug) => ({ name: `ats:${slug}`, run: async () => (await atsJobs(slug)).jobs })),
].filter((t) => !(src.disabled ?? []).some((d) => t.name === d || t.name.startsWith(`${d}:`)))
  .filter((t) => !only || only.some((o) => t.name === o || t.name.startsWith(`${o}:`)));

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await fn(queue.shift()!); }));
}

const results: SourceResult[] = [];
const all: Job[] = [];
await pool(tasks, 10, async (t) => {
  const t0 = Date.now();
  try {
    const jobs = (await t.run()).filter((j) => j.title && j.url);
    all.push(...jobs);
    // ATS boards with no account are noise in the table; only list those that matched.
    if (!(t.name.startsWith('ats:') && state.ats[t.name.slice(4)]?.kind === 'none'))
      results.push({ source: t.name, ok: true, count: jobs.length, ms: Date.now() - t0 });
  } catch (e) {
    const skip = e instanceof SkipSource;
    results.push({ source: t.name, ok: skip, count: 0, error: String((e as Error).message).slice(0, 140), ms: Date.now() - t0 });
  }
});

// Score everything that fits, then keep one entry per company+title.
const scored: Scored[] = [];
const funnel: Record<string, number> = {};
const abroad: Scored[] = [];
for (const j of all) {
  const prev = state.seen[dedupeKey(j)];
  const first = prev?.firstSeen ?? now.toISOString();
  const s = score(j, profile, now, first);
  if (s) scored.push(s);
  else {
    const why = dropReason(j, profile, now, first); funnel[why] = (funnel[why] ?? 0) + 1;
    // Blocked only by location, yet the text says they hire contractors / through an EOR / anywhere:
    // score it as if it were open so a human can check the original posting.
    if (why.startsWith('ubicación:') && maybeAbroad(j)) {
      const s2 = score({ ...j, location: 'Remote' }, profile, now, first);
      if (s2 && s2.tier !== 'weak') abroad.push({ ...s2, location: j.location, reasons: ['revisar: contratan fuera de su país?', ...s2.reasons] });
    }
  }
}
const unique = dedupe(scored).sort((a, b) => b.score - a.score);
const fresh = unique.filter((j) => !state.seen[dedupeKey(j)]);

for (const j of unique) {
  const k = dedupeKey(j);
  state.seen[k] = { firstSeen: state.seen[k]?.firstSeen ?? now.toISOString(), lastSeen: now.toISOString(), url: j.url };
}

funnel['encajan (antes de quitar duplicados)'] = scored.length;
const freshSet = new Set(fresh);
const open = unique.filter((j) => !freshSet.has(j) && j.tier !== 'weak').slice(0, profile.openSize ?? 10);
const md = renderDigest(fresh, results, now, profile.digestSize, { open, funnel, abroad: dedupe(abroad).sort((a, b) => b.score - a.score).slice(0, 15) });
console.log(md);
if (deferred) console.error(`${deferred} empresas quedan para descubrir en la próxima corrida`);
console.error(`\n${all.length} ofertas leídas · ${unique.length} encajan · ${fresh.length} nuevas`);

if (!dry) {
  mkdirSync('digest', { recursive: true });
  const day = now.toISOString().slice(0, 10);
  writeFileSync('digest/latest.md', md);
  writeFileSync(`digest/${day}.md`, md);
  writeFileSync('digest/latest.json', JSON.stringify({ generatedAt: now.toISOString(), sources: results, jobs: fresh }, null, 1) + '\n');
  saveState(state, now);
  const strongOrPossible = fresh.filter((j) => j.tier !== 'weak').length;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `new=${strongOrPossible}\nday=${day}\n`);
}
