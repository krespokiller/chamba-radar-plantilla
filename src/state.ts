// What the radar has already seen, committed back to the repo by the workflow so each run only
// reports what is new. Small JSON on purpose: easy to read in a diff.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type Ats = 'greenhouse' | 'lever' | 'ashby' | 'workable' | 'smartrecruiters' | 'recruitee' | 'none';

export interface State {
  seen: Record<string, { firstSeen: string; lastSeen: string; url: string }>;
  ats: Record<string, { kind: Ats; checkedAt: string }>;
}

export function loadState(path = 'data/state.json'): State {
  if (!existsSync(path)) return { seen: {}, ats: {} };
  const s = JSON.parse(readFileSync(path, 'utf8'));
  return { seen: s.seen ?? {}, ats: s.ats ?? {} };
}

export function saveState(s: State, now: Date, path = 'data/state.json', keepDays = 60) {
  const cutoff = now.getTime() - keepDays * 86_400_000;
  for (const [k, v] of Object.entries(s.seen)) if (Date.parse(v.lastSeen) < cutoff) delete s.seen[k];
  mkdirSync(dirname(path), { recursive: true });
  const sorted = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(path, JSON.stringify({ seen: sorted(s.seen), ats: sorted(s.ats) }, null, 1) + '\n');
}
