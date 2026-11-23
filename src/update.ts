// Trae las mejoras del motor desde la plantilla original sin tocar tus datos.
//   npm run actualizar
// Actualiza: código (src, test), CVs (cv/build.py, build.sh, render.cjs), skills de Claude, workflow,
// guías y dependencias. NO toca: config/profile.json, cv/perfil.json, perfil/, data/, digest/.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const UPSTREAM = process.env.CHAMBA_UPSTREAM ?? 'https://github.com/krespokiller/chamba-radar-plantilla.git';
const ENGINE = [
  'src', 'test', 'cv/build.py', 'cv/build.sh', 'cv/render.cjs', '.claude/skills', '.github/workflows',
  'package.json', 'package-lock.json', 'tsconfig.json', 'config/profile.example.json',
  'perfil/datos.example.md', 'plantillas', 'GUIA.md', 'GUIA-PERFIL.md', 'CLAUDE.md', 'LICENSE',
];

const sh = (cmd: string) => execSync(cmd, { stdio: 'inherit' });
const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
if (dirty) {
  console.error('Tienes cambios sin guardar (commit). Guárdalos primero y vuelve a correr npm run actualizar.');
  process.exit(1);
}
const WF = '.github/workflows/radar.yml';
const cronOf = (t: string) => t.match(/^\s*- cron: .*$/m)?.[0];
const myCron = existsSync(WF) ? cronOf(readFileSync(WF, 'utf8')) : undefined;
sh(`git fetch --depth 1 ${UPSTREAM} main`);
for (const path of ENGINE) {
  try { execSync(`git checkout FETCH_HEAD -- ${path}`, { stdio: 'ignore' }); }
  catch { /* path not in upstream (yet): skip */ }
}
// Keep the person's schedule (e.g. two runs a day) over the template's default.
if (myCron && existsSync(WF)) {
  const t = readFileSync(WF, 'utf8');
  const up = cronOf(t);
  if (up && up !== myCron) { writeFileSync(WF, t.replace(up, myCron)); execSync(`git add ${WF}`); }
}
sh('npm ci --silent');
sh('npm test --silent');
sh('npm run typecheck --silent');
console.log('\nListo. Revisa los cambios con "git diff --staged" y guárdalos con un commit.');
console.log('Si GitHub rechaza el push por el archivo del workflow, súbelo desde la web o pide a Claude que te guíe.');
