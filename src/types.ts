/** A posting normalized from any source. Everything optional is genuinely unknown, never guessed. */
export interface Job {
  id: string;                // stable: source + external id (or url)
  source: string;            // e.g. "greenhouse:clara", "remotive"
  company: string;
  title: string;
  url: string;
  location: string;          // raw location text as the source states it
  remoteHint?: boolean;      // the source flags it remote
  postedAt?: string;         // ISO date-time from the source; absent = not published
  description: string;       // plain text (may be truncated)
  salary?: Salary;
  tags: string[];
}

export interface Salary {
  min?: number;
  max?: number;
  currency: string;          // ISO code as published
  period: 'year' | 'month' | 'hour';
  raw?: string;
}

export type Tier = 'strong' | 'possible' | 'weak';
export type Eligibility = 'worldwide' | 'latam' | 'colombia' | 'unknown' | 'blocked';

export interface Scored extends Job {
  score: number;
  tier: Tier;
  eligibility: Eligibility;
  sponsorship: 'denied' | 'none';
  monthlyUsd?: { min?: number; max?: number };
  belowFloor: boolean;
  reasons: string[];         // why it scored what it scored, in Spanish, for the digest
  firstSeen: string;         // when this system first saw it
}

export interface SourceResult { source: string; ok: boolean; count: number; error?: string; ms: number }
