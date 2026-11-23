import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jobLinks, parsePosting } from '../src/sources/pages.ts';
import { renderDigest } from '../src/digest.ts';

test('collects job-detail links and ignores the rest', () => {
  const html = `<a href="/co/empleos/desarrollador-backend-bogota-1027354">a</a>
    <a href="/co/empleos/desarrollador-backend-bogota-1027354?utm=1">dup</a>
    <a href="https://www.magneto365.com/co/empleos/tech-lead-1031111">b</a>
    <a href="/co/empresas/acme">empresa</a><a href="/co/empleos">todas</a>`;
  assert.deepEqual(jobLinks(html, 'https://www.magneto365.com/co/empleos', '^/co/empleos/[a-z0-9-]+-\\d+/?$'), [
    'https://www.magneto365.com/co/empleos/desarrollador-backend-bogota-1027354',
    'https://www.magneto365.com/co/empleos/tech-lead-1031111',
  ]);
});

test('reads schema.org JobPosting when present', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Líder Técnico Backend', datePosted: '2026-11-05',
    hiringOrganization: { name: 'Acme SAS' }, jobLocation: [{ address: { addressLocality: 'Bogotá', addressCountry: 'CO' } }],
    baseSalary: { currency: 'COP', value: { minValue: 9000000, maxValue: 11000000, unitText: 'MONTH' } }, description: '<p>NestJS y AWS</p>',
  })}</script>`;
  const j = parsePosting(html, 'https://m/co/empleos/lider-1', 'magneto', 'Colombia')!;
  assert.equal(j.title, 'Líder Técnico Backend');
  assert.equal(j.company, 'Acme SAS');
  assert.equal(j.postedAt, '2026-11-05T00:00:00.000Z');
  assert.match(j.location, /Bogotá/);
  assert.deepEqual(j.salary, { min: 9000000, max: 11000000, currency: 'COP', period: 'month' });
  assert.equal(j.description, 'NestJS y AWS');
});

test('falls back to meta tags and labelled text', () => {
  const html = `<meta property="og:title" content="Desarrollador Full Stack Senior"><body><h1>Desarrollador Full Stack Senior</h1>
    <p>Fecha de publicación 2026-11-05</p><p>COP 8.000.000 a COP 10.000.000</p><p>Trabajo remoto</p></body>`;
  const j = parsePosting(html, 'https://m/co/empleos/x-2', 'magneto', 'Colombia')!;
  assert.equal(j.title, 'Desarrollador Full Stack Senior');
  assert.equal(j.postedAt, '2026-11-05T00:00:00.000Z');
  assert.deepEqual(j.salary, { min: 8000000, max: 10000000, currency: 'COP', period: 'month' });
  assert.equal(j.remoteHint, true);
});

test('digest lists strong first and reports failed sources', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  const base = { id: 'a', source: 'lever:x', company: 'X', url: 'https://x', location: 'LatAm', description: '', tags: [], eligibility: 'latam' as const, sponsorship: 'none' as const, belowFloor: false, firstSeen: now.toISOString(), postedAt: '2026-11-07T00:00:00Z' };
  const out = renderDigest(
    [{ ...base, title: 'Tech Lead', score: 80, tier: 'strong', reasons: ['senior'] }, { ...base, id: 'b', title: 'Backend', score: 45, tier: 'possible', reasons: [] }],
    [{ source: 'remotive', ok: true, count: 10, ms: 5 }, { source: 'magneto', ok: false, count: 0, error: 'HTTP 403', ms: 9 }, { source: 'email', ok: true, count: 0, error: 'sin GMAIL_USER', ms: 0 }],
    now, 15,
  );
  assert.ok(out.indexOf('Tech Lead') < out.indexOf('Backend'));
  assert.match(out, /❌ HTTP 403/);
  assert.match(out, /omitida: sin GMAIL\\_USER/);
  assert.match(out, /hoy/);
});
