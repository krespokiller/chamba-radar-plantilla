// Company ATS boards: the company's own listing, so presence there means the job is open today.
import type { Job, Salary } from '../types.ts';
import { getJson, HttpError } from './http.ts';
import { htmlToText, toIso } from '../text.ts';

type Raw = Record<string, any>;

export async function greenhouse(board: string, company: string): Promise<Job[]> {
  // content=true inlines descriptions; large boards can exceed limits, so we fall back to bare.
  let data: Raw;
  try { data = await getJson<Raw>(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`, 30000); }
  catch (e) {
    if ((e as any).status === 404) throw e;
    data = await getJson<Raw>(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs`, 30000);
  }
  return (data.jobs ?? []).map((r: Raw): Job => ({
    id: `greenhouse:${board}:${r.id}`,
    source: `greenhouse:${board}`,
    company,
    title: String(r.title ?? '').trim(),
    url: r.absolute_url,
    location: r.location?.name ?? '',
    // first_published, not updated_at: boards rewrite updated_at constantly.
    postedAt: toIso(r.first_published),
    description: htmlToText(r.content),
    tags: (r.departments ?? []).map((d: Raw) => d.name).filter(Boolean),
  }));
}

export async function lever(board: string, company: string): Promise<Job[]> {
  const data = await getJson<Raw[]>(`https://api.lever.co/v0/postings/${board}?mode=json`, 30000);
  return (Array.isArray(data) ? data : []).map((r): Job => {
    const sr = r.salaryRange;
    const salary: Salary | undefined = sr && (sr.min || sr.max) ? {
      min: sr.min, max: sr.max, currency: sr.currency ?? 'USD',
      period: /month/i.test(sr.interval) ? 'month' : /hour/i.test(sr.interval) ? 'hour' : 'year',
    } : undefined;
    const loc = [r.categories?.location, ...(r.categories?.allLocations ?? [])].filter(Boolean);
    return {
      id: `lever:${board}:${r.id}`,
      source: `lever:${board}`,
      company,
      title: String(r.text ?? '').trim(),
      url: r.hostedUrl,
      location: [...new Set(loc)].join('; '),
      remoteHint: r.workplaceType === 'remote' ? true : undefined,
      postedAt: toIso(r.createdAt), // epoch ms
      description: [r.descriptionPlain, ...(r.lists ?? []).map((l: Raw) => `${l.text}\n${htmlToText(l.content)}`), r.additionalPlain]
        .filter(Boolean).join('\n').slice(0, 6000),
      salary,
      tags: [r.categories?.team, r.categories?.commitment].filter(Boolean),
    };
  });
}

export async function ashby(board: string, company: string): Promise<Job[]> {
  const data = await getJson<Raw>(`https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`, 30000);
  return (data.jobs ?? []).filter((r: Raw) => r.isListed !== false).map((r: Raw): Job => {
    const loc = [r.location, ...(r.secondaryLocations ?? []).map((l: Raw) => l?.location ?? l)].filter((x) => typeof x === 'string' && x);
    const summary = r.compensation?.compensationTierSummary ?? r.compensation?.scrapeableCompensationSalarySummary;
    return {
      id: `ashby:${board}:${r.id ?? r.jobUrl}`,
      source: `ashby:${board}`,
      company,
      title: String(r.title ?? '').trim(),
      url: r.jobUrl ?? r.applyUrl,
      location: [...new Set(loc)].join('; '),
      remoteHint: r.isRemote === true || r.workplaceType === 'Remote' ? true : undefined,
      postedAt: toIso(r.publishedAt),
      description: (r.descriptionPlain ?? htmlToText(r.descriptionHtml)).slice(0, 6000) + (summary ? `\nCompensation: ${summary}` : ''),
      tags: [r.department, r.team, r.employmentType].filter(Boolean),
    };
  });
}

// ATS used a lot by European and Latin American companies. Same contract as above: a missing
// board throws an HttpError with status 404 so main.ts can try the next ATS.
const notFound = () => new HttpError(404, 'no board');
async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try { return await p; } catch (e) { if (e instanceof HttpError) throw e.status === 404 || e.status === 410 ? notFound() : e; throw notFound(); }
}

// Workable rate-limits hard (HTTP 429): one request at a time, spaced, with backoff on 429.
let workableChain: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function workableGet(url: string): Promise<Raw> {
  const run = async (): Promise<Raw> => {
    for (let attempt = 0; ; attempt++) {
      try { return await getJson<Raw>(url, 30000); }
      catch (e) {
        if (e instanceof HttpError && e.status === 429 && attempt < 2) { await sleep(4000 * (attempt + 1)); continue; }
        throw e;
      } finally { await sleep(700); }
    }
  };
  const next = workableChain.then(run, run);
  workableChain = next.catch(() => undefined);
  return next;
}

export async function workable(board: string, company: string): Promise<Job[]> {
  const data = await orNotFound(workableGet(`https://apply.workable.com/api/v1/widget/accounts/${board}?details=true`));
  if (!data || !Array.isArray(data.jobs)) throw notFound();
  return data.jobs.map((r: Raw): Job => {
    const where = [r.city, r.state, r.country].filter(Boolean).join(', ');
    const locs = (r.locations ?? []).map((l: Raw) => [l.city, l.region, l.country].filter(Boolean).join(', ')).filter(Boolean);
    return {
      id: `workable:${board}:${r.shortcode ?? r.url}`,
      source: `workable:${board}`,
      company: data.name || company,
      title: String(r.title ?? '').trim(),
      url: r.url ?? r.application_url ?? `https://apply.workable.com/${board}/j/${r.shortcode}/`,
      location: [r.telecommuting ? 'Remote' : '', ...new Set([where, ...locs].filter(Boolean))].filter(Boolean).join('; '),
      remoteHint: r.telecommuting === true ? true : undefined,
      postedAt: toIso(r.published_on ?? r.created_at),
      description: htmlToText(r.description ?? '').slice(0, 6000),
      tags: [r.department, r.employment_type].filter(Boolean),
    };
  });
}

export async function smartrecruiters(board: string, company: string): Promise<Job[]> {
  const data = await orNotFound(getJson<Raw>(`https://api.smartrecruiters.com/v1/companies/${board}/postings?limit=100`, 30000));
  // SmartRecruiters answers 200 with an empty list for companies that do not exist.
  if (!data || !data.totalFound) throw notFound();
  return (data.content ?? []).map((r: Raw): Job => {
    const l = r.location ?? {};
    return {
      id: `smartrecruiters:${board}:${r.id}`,
      source: `smartrecruiters:${board}`,
      company: r.company?.name || company,
      title: String(r.name ?? '').trim(),
      url: `https://jobs.smartrecruiters.com/${board}/${r.id}`,
      location: [l.remote ? 'Remote' : '', l.fullLocation ?? [l.city, l.country].filter(Boolean).join(', ')].filter(Boolean).join('; '),
      remoteHint: l.remote === true ? true : undefined,
      postedAt: toIso(r.releasedDate),
      // The list endpoint has no description; eligibility then rests on the location field.
      description: [r.department?.label, r.function?.label, r.experienceLevel?.label].filter(Boolean).join('\n'),
      tags: [r.department?.label, r.typeOfEmployment?.label].filter(Boolean),
    };
  });
}

export async function recruitee(board: string, company: string): Promise<Job[]> {
  const data = await orNotFound(getJson<Raw>(`https://${board}.recruitee.com/api/offers/`, 30000));
  if (!data || !Array.isArray(data.offers)) throw notFound();
  return data.offers.filter((r: Raw) => r.status !== 'closed').map((r: Raw): Job => ({
    id: `recruitee:${board}:${r.id}`,
    source: `recruitee:${board}`,
    company: r.company_name || company,
    title: String(r.title ?? '').trim(),
    url: r.careers_url ?? r.careers_apply_url,
    location: [r.remote ? 'Remote' : '', r.location ?? [r.city, r.country].filter(Boolean).join(', ')].filter(Boolean).join('; '),
    remoteHint: r.remote === true ? true : undefined,
    postedAt: toIso(r.published_at ?? r.created_at),
    description: htmlToText(`${r.description ?? ''}\n${r.requirements ?? ''}`).slice(0, 6000),
    tags: [r.department, r.employment_type_code].filter(Boolean),
  }));
}
