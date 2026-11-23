// Job boards and aggregators. Presence here does not prove the job is still open; the link does.
import type { Job, Salary } from '../types.ts';
import { getJson, getText } from './http.ts';
import { htmlToText, toIso } from '../text.ts';

type Raw = Record<string, any>;
const num = (v: unknown) => (typeof v === 'number' && v > 0 ? v : typeof v === 'string' && +v > 0 ? +v : undefined);

function salaryOf(min: unknown, max: unknown, currency: unknown, period: Salary['period'] = 'year'): Salary | undefined {
  const a = num(min), b = num(max);
  if (!a && !b) return undefined;
  return { min: a, max: b, currency: typeof currency === 'string' && currency ? currency.toUpperCase() : 'USD', period };
}

export async function remotive(category?: string): Promise<Job[]> {
  if (!category) return [];
  // Remotive asks for at most ~4 calls/day; the workflow schedule respects that.
  const data = await getJson<Raw>(`https://remotive.com/api/remote-jobs?category=${encodeURIComponent(category)}&limit=300`);
  return (data.jobs ?? []).map((r: Raw): Job => ({
    id: `remotive:${r.id}`, source: 'remotive', company: r.company_name, title: r.title, url: r.url,
    location: r.candidate_required_location ?? 'Remote', remoteHint: true, postedAt: toIso(r.publication_date),
    description: htmlToText(r.description) + (r.salary ? `\nSalary: ${r.salary}` : ''), tags: r.tags ?? [],
  }));
}

export async function himalayas(): Promise<Job[]> {
  const out: Job[] = [];
  for (let offset = 0; offset < 400; offset += 100) {
    const data = await getJson<Raw>(`https://himalayas.app/jobs/api?limit=100&offset=${offset}`);
    const jobs: Raw[] = data.jobs ?? [];
    for (const r of jobs) {
      const restr: string[] = Array.isArray(r.locationRestrictions) ? r.locationRestrictions.filter(Boolean) : [];
      out.push({
        id: `himalayas:${r.guid ?? r.applicationLink}`, source: 'himalayas', company: r.companyName, title: r.title,
        url: r.applicationLink ?? r.guid, location: restr.length ? restr.join('; ') : 'Worldwide', remoteHint: true,
        postedAt: toIso(r.pubDate), // epoch seconds
        description: htmlToText(r.description ?? r.excerpt),
        salary: salaryOf(r.minSalary, r.maxSalary, r.currency, /month/i.test(r.salaryPeriod ?? '') ? 'month' : 'year'),
        tags: [...(r.categories ?? []), ...(r.seniority ?? [])],
      });
    }
    if (jobs.length < 100) break;
  }
  return out;
}

export async function jobicy(tags: string[] = []): Promise<Job[]> {
  const out: Job[] = [];
  for (const tag of tags) {
    const data = await getJson<Raw>(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag)}`);
    for (const r of data.jobs ?? []) out.push({
      id: `jobicy:${r.id}`, source: 'jobicy', company: r.companyName, title: htmlToText(r.jobTitle), url: r.url,
      location: [].concat(r.jobGeo ?? 'Anywhere').join('; '), remoteHint: true, postedAt: toIso(r.pubDate),
      description: htmlToText(r.jobDescription ?? r.jobExcerpt),
      salary: salaryOf(r.annualSalaryMin, r.annualSalaryMax, r.salaryCurrency), tags: [].concat(r.jobIndustry ?? [], r.jobLevel ?? []),
    });
  }
  return out;
}

export async function remoteok(): Promise<Job[]> {
  const data = await getJson<Raw[]>('https://remoteok.com/api');
  return (Array.isArray(data) ? data : []).filter((r) => r && r.position && r.legal === undefined).map((r): Job => ({
    id: `remoteok:${r.id}`, source: 'remoteok', company: r.company, title: r.position, url: r.url ?? r.apply_url,
    location: r.location || 'Worldwide', remoteHint: true, postedAt: toIso(r.epoch ?? r.date),
    description: htmlToText(r.description), salary: salaryOf(r.salary_min, r.salary_max, 'USD'), tags: r.tags ?? [],
  }));
}

export async function arbeitnow(): Promise<Job[]> {
  const out: Job[] = [];
  for (let page = 1; page <= 3; page++) {
    const data = await getJson<Raw>(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    for (const r of data.data ?? []) out.push({
      id: `arbeitnow:${r.slug ?? r.url}`, source: 'arbeitnow', company: r.company_name, title: r.title, url: r.url,
      location: r.location ?? '', remoteHint: r.remote === true ? true : undefined, postedAt: toIso(r.created_at),
      description: htmlToText(r.description), tags: [...(r.tags ?? []), ...(r.job_types ?? [])],
    });
    if (!data.links?.next) break;
  }
  return out;
}

export async function landingjobs(): Promise<Job[]> {
  const data = await getJson<Raw[]>('https://landing.jobs/api/v1/jobs?limit=100');
  return (Array.isArray(data) ? data : []).map((r): Job => {
    const company = r.company_name ?? r.company?.name ?? /\/at\/([^/]+)\//.exec(r.url ?? '')?.[1]?.replace(/[-_]+/g, ' ') ?? 'Landing.jobs';
    const locs: string[] = (r.locations ?? []).map((l: any) => (typeof l === 'string' ? l : [l?.city, l?.country_code].filter(Boolean).join(', '))).filter(Boolean);
    return {
      id: `landingjobs:${r.id ?? r.url}`, source: 'landingjobs', company, title: r.title, url: r.url,
      location: (r.remote ? 'Remote; ' : '') + locs.join('; '), remoteHint: r.remote === true ? true : undefined,
      postedAt: toIso(r.published_at),
      description: htmlToText([r.role_description, r.main_requirements, r.nice_to_have].filter(Boolean).join('\n'))
        + (r.relocation_paid ? '\nRelocation paid by the company.' : ''),
      salary: salaryOf(r.gross_salary_low, r.gross_salary_high, r.currency_code), tags: (r.tags ?? []).map((t: any) => t?.name ?? t),
    };
  });
}

export async function getonbrd(queries: string[] = []): Promise<Job[]> {
  const out = new Map<string, Job>();
  for (const q of queries) {
    const data = await getJson<Raw>(`https://www.getonbrd.com/api/v0/search/jobs?query=${encodeURIComponent(q)}&per_page=100&expand=["company"]`);
    for (const d of data.data ?? []) {
      const a = d.attributes ?? {};
      if (out.has(d.id)) continue;
      const company = a.company?.data?.attributes?.name ?? a.company?.name ?? 'Get on Board';
      out.set(d.id, {
        id: `getonbrd:${d.id}`, source: 'getonbrd', company, title: a.title, url: d.links?.public_url ?? `https://www.getonbrd.com/jobs/${d.id}`,
        location: [a.remote_modality, ...(a.countries ?? [])].filter(Boolean).join('; ') || (a.remote ? 'Remote' : ''),
        remoteHint: a.remote === true ? true : undefined, postedAt: toIso(a.published_at),
        description: htmlToText([a.description, a.projects, a.functions, a.desirable].filter(Boolean).join('\n')),
        salary: salaryOf(a.min_salary, a.max_salary, 'USD', 'month'), tags: [a.seniority?.data?.id ? `seniority:${a.seniority.data.id}` : ''].filter(Boolean),
      });
    }
  }
  return [...out.values()];
}

/** We Work Remotely RSS: title is "Company: Role". */
export async function weworkremotely(categories: string[] = []): Promise<Job[]> {
  const out: Job[] = [];
  for (const cat of categories) {
    const xml = await getText(`https://weworkremotely.com/categories/${cat}.rss`);
    for (const item of xml.split('<item>').slice(1)) {
      const tag = (t: string) => { const m = new RegExp(`<${t}>([\\s\\S]*?)</${t}>`).exec(item); return m ? m[1].replace(/^<!\[CDATA\[|\]\]>$/g, '').trim() : ''; };
      const full = htmlToText(tag('title'));
      const i = full.indexOf(':');
      out.push({
        id: `wwr:${tag('guid') || tag('link')}`, source: 'weworkremotely', company: i > 0 ? full.slice(0, i).trim() : 'WWR',
        title: i > 0 ? full.slice(i + 1).trim() : full, url: tag('link'), location: htmlToText(tag('region')) || 'Remote',
        remoteHint: true, postedAt: toIso(tag('pubDate')), description: htmlToText(tag('description')), tags: [],
      });
    }
  }
  return out;
}
