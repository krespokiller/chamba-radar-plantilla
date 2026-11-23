import { readFileSync } from 'node:fs';

/** A listing page whose job links we follow (e.g. a Magneto search you saved from the browser). */
export interface PageSource {
  name: string;          // shown in the digest, e.g. "magneto"
  url: string;           // listing/search page
  linkPattern: string;   // regex (as string) that a job-detail href must match
  max?: number;          // max detail pages to open per run (default 30)
  country?: string;      // jobs from this page are in this country (helps eligibility)
}

export interface Profile {
  windowDays: number;
  /** Window for roles read straight from a company ATS / Get on Board / Magneto (default: windowDays). */
  directWindowDays?: number;
  aiWords?: string[];
  /** Seniority rules (regex on the folded title, first match wins). Default: generic lead / senior. */
  seniority?: { pattern: string; points: number; reason: string }[];
  /** Points when the title matches; every match applies. Default: none. */
  titleBonuses?: { pattern: string; points: number; reason: string; unless?: string }[];
  /** Points when the title matches no seniority rule (default 6). */
  seniorityDefault?: number;
  /** Per-person search terms for the public boards. A board with no terms is skipped. */
  sources?: {
    remotiveCategory?: string;          // e.g. 'software-dev', 'devops', 'all-others'
    jobicyTags?: string[];
    getonbrdQueries?: string[];
    weworkremotelyCategories?: string[]; // RSS category slugs on weworkremotely.com
    disabled?: string[];                 // source names to skip, e.g. ['remoteok', 'himalayas']
  };
  openSize?: number;
  digestSize: number;
  floorMonthlyUsd: number;
  /** Approximate FX to USD, only to compare salaries against the floor. */
  fxToUsd: Record<string, number>;
  roleWords: string[];
  areaWords: string[];
  excludeTitle: string[];
  stack: Record<string, number>;
  domain: string[];
  boards: string[];
  pages: PageSource[];
  email: { mailbox: string; maxMessages: number; resolveLimit: number };
}

export function loadProfile(path = 'config/profile.json'): Profile {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  return {
    windowDays: 7, digestSize: 15, floorMonthlyUsd: 3000,
    fxToUsd: { USD: 1, EUR: 1.08, GBP: 1.27, CAD: 0.73, BRL: 0.18, MXN: 0.055, COP: 0.00025, ARS: 0.001, CLP: 0.00105 },
    pages: [], email: { mailbox: 'chamba-radar', maxMessages: 80, resolveLimit: 60 },
    ...raw,
  };
}
