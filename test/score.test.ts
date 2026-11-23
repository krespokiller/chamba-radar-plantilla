import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadProfile } from '../src/profile.ts';
import { titleFilter, eligibility, score, dedupe, monthlyUsd, dropReason, maybeAbroad } from '../src/score.ts';
import type { Job } from '../src/types.ts';

const p = loadProfile('test/fixtures/profile.json');
const now = new Date('2026-11-07T12:00:00Z');
const job = (o: Partial<Job>): Job => ({
  id: 'x', source: 'greenhouse:acme', company: 'Acme', title: 'Senior Backend Engineer', url: 'https://x',
  location: 'Remote - LATAM', postedAt: '2026-11-06T12:00:00Z', description: 'Node.js, TypeScript, NestJS, PostgreSQL, AWS. Fintech payments.', tags: [], ...o,
});

test('title filter keeps the profile and drops excluded stacks', () => {
  assert.equal(titleFilter('Senior Backend Engineer (Node.js)', p).keep, true);
  assert.equal(titleFilter('Tech Lead', p).keep, true);
  assert.equal(titleFilter('Desarrollador Full Stack Senior', p).keep, true);
  assert.equal(titleFilter('Senior JavaScript Engineer', p).keep, true, '"java" must not match "javascript"');
  assert.equal(titleFilter('Senior Java Developer', p).keep, false);
  assert.equal(titleFilter('Junior Backend Developer', p).keep, false);
  assert.equal(titleFilter('Senior iOS Engineer', p).keep, false);
  assert.equal(titleFilter('Account Executive', p).keep, false);
  assert.equal(titleFilter('Senior .NET Developer', p).keep, false);
});

test('eligibility reads location and hard limits', () => {
  assert.equal(eligibility(job({ location: 'Remote - LATAM' })), 'latam');
  assert.equal(eligibility(job({ location: 'Bogotá, Colombia' })), 'colombia');
  assert.equal(eligibility(job({ location: 'Worldwide' })), 'worldwide');
  assert.equal(eligibility(job({ location: 'San Francisco, CA' })), 'blocked');
  assert.equal(eligibility(job({ location: 'Remote - US' })), 'blocked');
  assert.equal(eligibility(job({ location: 'Remote', description: 'Candidates must be located in the US.' })), 'blocked');
  assert.equal(eligibility(job({ location: 'Berlin, Germany', description: 'Relocation package and visa sponsorship provided.' })), 'blocked');
  assert.equal(eligibility(job({ location: 'Remote', description: 'Node' })), 'unknown');
});

// Cases taken from the first live run (2026-11-07), where the description said "LATAM" but the
// location field tied the role to another country or to an office.
test('location field beats a LATAM mention in the body', () => {
  const latamBody = 'We hire across LATAM. Node, TypeScript.';
  for (const location of ['Brazil', 'hybrid; Chile', 'no_remote; Chile', 'remote_local; Remote', 'London', 'Canada',
    'Remote - Munich', 'Hybrid - San Francisco, New York City', 'Sao Paulo / SP / Brazil',
    'Europe, Middle East, Africa, Asia-Pacific (EMEA, APAC)', 'Singapore | Singapore | Hybrid'])
    assert.equal(eligibility(job({ location, description: latamBody })), 'blocked', location);
  assert.equal(eligibility(job({ location: 'LATAM,  Canada,  USA' })), 'latam');
  assert.equal(eligibility(job({ location: 'Anywhere; North America, South America (AMER); EMEA' })), 'latam');
  assert.equal(eligibility(job({ location: 'fully_remote; Remote', description: latamBody })), 'latam');
  assert.equal(eligibility(job({ location: 'Anywhere in the World' })), 'worldwide');
  assert.equal(eligibility(job({ location: 'Bogotá, D.C., Bogotá D.C., CO; Colombia' })), 'colombia');
  assert.equal(eligibility(job({ location: 'Zürich', description: 'We offer a relocation package.' })), 'blocked');
});

test('title must name the area, not just a role word', () => {
  for (const t of ['Partnerships Lead', 'Special Projects Lead', 'Finance Analytics Engineer | FP&A', 'Senior Vue Developer',
    'Ingeniero(a) de Datos', 'Senior Localisation Quality Engineer', 'UX/UI Lead (AI Native)', 'Desenvolvedor Full Stack Sr'])
    assert.equal(titleFilter(t, p).keep, false, t);
  for (const t of ['Tech lead', 'Lead Engineer, Member Growth', 'Product Engineer, Internal Tools - LATAM', 'Staff Software Engineer, Backend', 'Engineering Manager'])
    assert.equal(titleFilter(t, p).keep, true, t);
});

test('frontend-only roles drop below fullstack ones', () => {
  const fe = score(job({ title: 'Senior Software Engineer, Frontend' }), p, now)!;
  const fs = score(job({ title: 'Senior Software Engineer, Full Stack' }), p, now)!;
  assert.ok(fs.score - fe.score >= 15);
});

test('scores a strong fintech lead role above a vague one', () => {
  const lead = score(job({ title: 'Tech Lead, Payments' }), p, now)!;
  const vague = score(job({ title: 'Software Engineer', description: 'We build things.', location: 'Remote' }), p, now)!;
  assert.ok(lead && vague);
  assert.equal(lead.tier, 'strong');
  assert.ok(lead.score > vague.score + 20, `${lead.score} vs ${vague.score}`);
  assert.ok(lead.reasons.some((r) => r.includes('fintech') || r.includes('payments')));
});

test('drops old postings and blocked locations', () => {
  assert.equal(score(job({ postedAt: '2026-10-01T00:00:00Z' }), p, now), null);
  assert.equal(score(job({ location: 'London, UK' }), p, now), null);
});

test('salary is compared to the floor in USD per month', () => {
  assert.deepEqual(monthlyUsd(job({ salary: { min: 60000, max: 95000, currency: 'USD', period: 'year' } }), p), { min: 5000, max: 7917 });
  const low = score(job({ salary: { min: 2000, max: 3000, currency: 'USD', period: 'month' } }), p, now)!;
  assert.equal(low.belowFloor, true);
  const cop = score(job({ location: 'Bogotá, Colombia', salary: { min: 8_000_000, max: 10_000_000, currency: 'COP', period: 'month' } }), p, now)!;
  assert.equal(cop.belowFloor, false, 'COP salaries are shown, not penalized against a USD floor');
});

test('dedupe keeps the company ATS over an aggregator copy', () => {
  const a = job({ id: 'a', source: 'remotive', company: 'Acme Inc.', title: 'Senior Backend Engineer' });
  const b = job({ id: 'b', source: 'greenhouse:acme', company: 'Acme', title: 'Senior Backend Engineer' });
  const out = dedupe([a, b]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'b');
});

// Customer.io, 2026-11-09: "remote" but pinned to a US hiring location with no sponsorship.
test('remote roles tied to foreign work authorization are dropped', () => {
  const cio = 'This should be the location you plan to consider your primary residence and are legally authorized to work in. '
    + "Unfortunately, we're not able to offer visa sponsorship or relocation support at this time.";
  for (const [location, description] of [
    ['Remote', cio],
    ['San Francisco, CA; Remote', cio],
    ['Worldwide', 'You must be legally authorized to work in the United States.'],
    ['Remote', 'Candidates must reside in the US or Canada.'],
    ['Remote', 'This role requires a security clearance.'],
    ['Remote', 'We will complete an I-9 verification.'],
    ['Remote', 'US-based candidates only.'],
    ['Remote', 'We do not provide visa sponsorship.'],
    ['Remote - LATAM', 'Must have the right to work in the UK.'],
  ] as const)
    assert.equal(eligibility(job({ location, description })), 'blocked', `${location} | ${description}`);

  // Explicit LatAm / worldwide labels survive a generic "we don't sponsor visas".
  assert.equal(eligibility(job({ location: 'Remote - LATAM', description: "We don't sponsor visas; this is a contractor role." })), 'latam');
  assert.equal(eligibility(job({ location: 'Worldwide', description: 'No visa sponsorship needed: work from wherever you are.' })), 'worldwide');
  // Overlap with US hours is not a residence requirement.
  assert.equal(eligibility(job({ location: 'Remote - LATAM', description: 'Able to work in US time zones (EST).' })), 'latam');
  assert.equal(eligibility(job({ location: 'Bogotá, Colombia', description: 'Remote within Colombia.' })), 'colombia');
  assert.equal(score(job({ location: 'Remote', description: cio }), p, now), null);
});

test('any Colombian city passes, remote or not (built for people in Colombia)', () => {
  for (const location of ['Medellín, Antioquia', 'Presencial - Bucaramanga', 'Híbrido; Cali', 'Cartagena de Indias',
    'On-site, Pereira', 'Hybrid - Barranquilla', 'Manizales, Caldas', 'Cajicá'])
    assert.equal(eligibility(job({ location, description: 'Node, TypeScript.' })), 'colombia', location);
  assert.equal(eligibility(job({ location: 'Cali, Colombia', description: 'Must be authorized to work in the US.' })), 'colombia');
  assert.equal(eligibility(job({ location: 'Hybrid - Medellin, Colombia' })), 'colombia');
  // Not to be confused with places abroad.
  assert.equal(eligibility(job({ location: 'Santiago, Chile' })), 'blocked');
});

test('FDE, payments and Go roles are targets; sales-side titles are not', () => {
  for (const t of ['Forward Deployed Engineer', 'Solutions Engineer', 'Integrations Engineer', 'Senior Payments Engineer — Acquiring & Payment Processing', 'Senior Go Developer', 'Implementation Engineer'])
    assert.equal(titleFilter(t, p).keep, true, t);
  for (const t of ['Sales Engineer', 'Go-to-Market Engineer', 'Pre-Sales Solutions Engineer', 'Senior Security Architect'])
    assert.equal(titleFilter(t, p).keep, false, t);
});

test('FDE and payments titles outscore a generic engineer role', () => {
  const fde = score(job({ title: 'Forward Deployed Engineer' }), p, now)!;
  const generic = score(job({ title: 'Software Engineer' }), p, now)!;
  assert.ok(fde.score >= generic.score + 20, `${fde.score} vs ${generic.score}`);
  assert.ok(fde.reasons.some((r) => r.includes('FDE')));
});

test('aggregator copies never reach the strong tier and say so', () => {
  const direct = score(job({ source: 'greenhouse:acme', title: 'Tech Lead, Payments' }), p, now)!;
  const copy = score(job({ source: 'jobicy', title: 'Tech Lead, Payments' }), p, now)!;
  assert.equal(direct.tier, 'strong');
  assert.notEqual(copy.tier, 'strong');
  assert.ok(copy.score < direct.score);
  assert.ok(copy.reasons.some((r) => r.includes('agregador')));
});

test('company ATS roles stay in for 30 days, aggregator copies only for 7', () => {
  const threeWeeks = '2026-10-17T12:00:00Z';
  assert.ok(score(job({ postedAt: threeWeeks }), p, now));
  assert.equal(score(job({ postedAt: threeWeeks, source: 'remotive' }), p, now), null);
});

test('AI-heavy roles score above the same role without AI', () => {
  const plain = score(job({ title: 'Senior Backend Engineer' }), p, now)!;
  const ai = score(job({ title: 'Senior Backend Engineer', description: 'Node.js, TypeScript, NestJS, PostgreSQL, AWS. Fintech payments. You will build LLM agents and RAG pipelines.' }), p, now)!;
  assert.ok(ai.reasons.some((r) => r.startsWith('IA:')));
  const aiEng = score(job({ title: 'Applied AI Engineer' }), p, now);
  assert.ok(aiEng, 'Applied AI Engineer passes the title filter');
  assert.equal(ai.score, plain.score + 10);
});

test('dropReason names why a role was left out', () => {
  assert.equal(dropReason(job({ title: 'Senior Java Engineer' }), p, now), 'título excluido');
  assert.equal(dropReason(job({ location: 'London, UK' }), p, now), 'ubicación: Europa/UK/EMEA');
  assert.equal(dropReason(job({ postedAt: '2026-09-01T00:00:00Z' }), p, now), 'fuera de la ventana de fechas');
});

test('a time-zone range that includes Colombia counts as open', () => {
  assert.equal(eligibility(job({ location: 'Remote (UTC-6 to UTC+2)' })), 'worldwide');
  assert.equal(eligibility(job({ location: 'Remote, GMT-3 to GMT+3' })), 'blocked');
});

test('location buckets and the maybe-abroad hint', () => {
  assert.equal(dropReason(job({ location: 'Berlin, Germany' }), p, now), 'ubicación: Europa/UK/EMEA');
  assert.equal(dropReason(job({ location: 'San Francisco, CA' }), p, now), 'ubicación: EE. UU./Canadá');
  assert.ok(maybeAbroad(job({ location: 'Europe', description: 'We hire independent contractors through Deel.' })));
  assert.ok(!maybeAbroad(job({ location: 'Europe', description: 'You must be authorized to work in the EU. We use Deel.' })));
});

test('empty word lists match nothing', () => {
  const q = { ...p, excludeTitle: [] as string[] };
  assert.equal(titleFilter('Engineer - Backend', q).keep, true);
  const none = { ...p, areaWords: [] as string[] };
  assert.equal(titleFilter('Engineer - Backend', none).keep, false);
});
