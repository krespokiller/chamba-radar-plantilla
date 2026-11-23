import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, extractAlertJobs } from '../src/sources/email.ts';

test('classify recognizes and canonicalizes job links', () => {
  assert.equal(classify('https://www.linkedin.com/comm/jobs/view/4486251956/?trackingId=abc&refId=x')?.url, 'https://www.linkedin.com/jobs/view/4486251956');
  assert.equal(classify('https://www.linkedin.com/jobs/search-results/?currentJobId=4486251956&keywords=x')?.id, '4486251956');
  assert.equal(classify('https://www.magneto365.com/co/empleos/desarrollador-backend-bogota-1027354?utm_source=mail')?.url, 'https://www.magneto365.com/co/empleos/desarrollador-backend-bogota-1027354');
  assert.equal(classify('https://co.indeed.com/rc/clk?jk=0123456789abcdef&from=ja')?.url, 'https://co.indeed.com/viewjob?jk=0123456789abcdef');
  assert.equal(classify('https://www.getonbrd.com/jobs/programming/senior-backend-acme-remote')?.site, 'getonbrd');
  assert.equal(classify('https://www.elempleo.com/co/ofertas-trabajo/desarrollador-nodejs-senior-1887766')?.id, '1887766');
  assert.equal(classify('https://www.linkedin.com/feed/'), null);
  assert.equal(classify('mailto:a@b.c'), null);
});

// Shaped like a LinkedIn job-alert email: several links per job (logo, title, "view"), then
// company · location under the title. Synthetic: real alert markup varies and will be checked on
// the first live run.
const linkedinAlert = `
<table>
 <tr><td><a href="https://www.linkedin.com/comm/jobs/view/111111111/?trk=logo"><img alt="Acme"></a></td>
     <td><a href="https://www.linkedin.com/comm/jobs/view/111111111/?trk=title">Senior Backend Engineer (Node.js)</a>
         <p>Acme Payments · Bogotá, Colombia (Remoto)</p><p>Hace 2 horas</p></td></tr>
 <tr><td><a href="https://www.linkedin.com/comm/jobs/view/222222222/?trk=title">Tech Lead</a>
         <p>Globex</p><p>Latinoamérica (Remoto)</p>
         <a href="https://www.linkedin.com/comm/jobs/view/222222222/?trk=cta">Ver empleo</a></td></tr>
 <tr><td><a href="https://www.linkedin.com/comm/jobs/search/?keywords=node">Ver todos los empleos</a></td></tr>
</table>`;

test('extracts one job per LinkedIn link group with company and location', async () => {
  const jobs = await extractAlertJobs({ html: linkedinAlert, date: new Date('2026-11-06T13:00:00Z'), from: 'LinkedIn', subject: 'x' });
  assert.equal(jobs.length, 2);
  assert.deepEqual(
    jobs.map((j) => [j.title, j.company, j.location, j.url]),
    [
      ['Senior Backend Engineer (Node.js)', 'Acme Payments', 'Bogotá, Colombia (Remoto)', 'https://www.linkedin.com/jobs/view/111111111'],
      ['Tech Lead', 'Globex', 'Latinoamérica (Remoto)', 'https://www.linkedin.com/jobs/view/222222222'],
    ],
  );
  assert.equal(jobs[0].postedAt, '2026-11-06T13:00:00.000Z');
  assert.equal(jobs[0].source, 'email:linkedin');
});

test('resolves tracker links through the resolver', async () => {
  const html = `<a href="https://u123.ct.sendgrid.net/ls/click?upn=abc">Desarrollador Node.js Senior</a><p>Empresa XYZ</p><p>Bogotá</p>`;
  const jobs = await extractAlertJobs(
    { html, date: new Date('2026-11-06T00:00:00Z'), from: 'Magneto', subject: 'x' },
    async () => 'https://www.magneto365.com/co/empleos/desarrollador-node-js-senior-bogota-1031234',
  );
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, 'email:magneto');
  assert.equal(jobs[0].company, 'Empresa XYZ');
  assert.equal(jobs[0].location, 'Bogotá');
});
