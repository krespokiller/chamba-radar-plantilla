import type { Scored, SourceResult } from './types.ts';

const TIER = { strong: '🟢 Fuertes', possible: '🟡 Posibles', weak: '⚪ Débiles' } as const;

function ago(iso: string | undefined, now: Date): string {
  if (!iso) return 'fecha no publicada';
  const d = Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
}

const md = (s: string) => s.replace(/([[\]|*_`<>])/g, '\\$1');

export interface Extra { open?: Scored[]; funnel?: Record<string, number>; abroad?: Scored[] }

export function renderDigest(jobs: Scored[], sources: SourceResult[], now: Date, size: number, extra: Extra = {}): string {
  const day = now.toISOString().slice(0, 10);
  const top = jobs.filter((j) => j.tier !== 'weak').slice(0, size);
  const ok = sources.filter((s) => s.ok).length;
  const lines: string[] = [
    `# Chamba radar · ${day}`,
    '',
    `**${jobs.length}** ofertas nuevas que encajan · **${ok}/${sources.length}** fuentes respondieron. Aquí van las ${top.length} mejores.`,
    '',
  ];
  for (const tier of ['strong', 'possible'] as const) {
    const group = top.filter((j) => j.tier === tier);
    if (!group.length) continue;
    lines.push(`## ${TIER[tier]}`, '');
    for (const j of group) {
      const where = [j.company, j.location].filter(Boolean).map(md).join(' · ');
      const flags = [j.belowFloor ? '⚠️ bajo tu piso' : '', j.sponsorship === 'denied' ? 'sin sponsorship' : ''].filter(Boolean).join(' · ');
      lines.push(`- [ ] **[${md(j.title)}](${j.url})** — ${where}`);
      lines.push(`  ${j.score} pts · ${ago(j.postedAt, now)} · ${md(j.reasons.join(' · '))}${flags ? ` · ${flags}` : ''} · _${j.source}_`);
    }
    lines.push('');
  }
  if (!top.length) lines.push('_Nada nuevo que encaje hoy. Las fuentes siguen vigiladas._', '');
  // The best roles do not vanish after the day they show up: list the ones still published.
  const open = (extra.open ?? []).filter((j) => j.tier !== 'weak');
  if (open.length) {
    lines.push('## 📌 Siguen abiertas (ya vistas, las mejores)', '');
    for (const j of open) lines.push(`- **[${md(j.title)}](${j.url})** — ${[j.company, j.location].filter(Boolean).map(md).join(' · ')} · ${j.score} pts · ${ago(j.postedAt, now)}`);
    lines.push('');
  }
  if (extra.abroad?.length) {
    lines.push('## 🔍 Fuera de tu zona, pero quizá contratan desde Colombia (revisar a mano)', '', '_La ubicación dice otro país, pero el texto habla de contratistas, EOR (Deel, Remote, Oyster) o de trabajar desde cualquier lugar. Confirma en la oferta original antes de postular._', '');
    for (const j of extra.abroad) lines.push(`- **[${md(j.title)}](${j.url})** — ${[j.company, j.location].filter(Boolean).map(md).join(' · ')} · ${j.score} pts · _${j.source}_`);
    lines.push('');
  }
  if (extra.funnel) {
    lines.push('<details><summary>Embudo: por qué se descartó lo demás</summary>', '', '| Motivo | Ofertas |', '|---|---|');
    for (const [k, v] of Object.entries(extra.funnel).sort((a, b) => b[1] - a[1])) lines.push(`| ${md(k)} | ${v} |`);
    lines.push('', '</details>', '');
  }
  const failed = sources.filter((s) => !s.ok);
  lines.push('<details><summary>Fuentes</summary>', '', '| Fuente | Estado | Ofertas | ms |', '|---|---|---|---|');
  for (const s of [...sources].sort((a, b) => Number(a.ok) - Number(b.ok) || a.source.localeCompare(b.source)))
    lines.push(`| ${s.source} | ${s.ok ? (s.error ? `omitida: ${md(s.error)}` : 'ok') : `❌ ${md(s.error ?? '')}`} | ${s.count} | ${s.ms} |`);
  lines.push('', '</details>', '');
  if (failed.length) lines.push(`_${failed.length} fuente(s) fallaron; el resto del digest es válido._`);
  // GitHub caps issue bodies at 65,536 characters.
  return lines.join('\n').slice(0, 60_000);
}
