# chamba-radar

Radar de ofertas de trabajo pensado para personas en **Colombia**, de cualquier profesión. Una vez al día, un GitHub Action en **tu propio repo**:

1. Lee portales y bolsas de empleo: páginas de carreras de cientos de empresas, Get on Board, Magneto, portales remotos y, si quieres, tus alertas de LinkedIn y Computrabajo por correo.
2. Descarta lo que no te sirve: cargo, nivel, herramientas, dónde puedes trabajar (remoto desde Colombia o cualquier ciudad de Colombia), fecha y salario.
3. Puntúa, quita duplicados y prefiere la oferta original de la empresa sobre las copias.
4. Abre un **issue** solo con lo **nuevo**. GitHub te lo manda al correo.

Además trae **skills de Claude** que te ayudan con lo demás: armar tus CVs de una página, revisar tu LinkedIn, preparar cada postulación (el botón de enviar lo das tú) y practicar entrevistas.

**¿Primera vez? Lee [GUIA.md](GUIA.md).** Son unos 20 minutos.

## Qué trae

| Parte | Para qué |
|---|---|
| `src/` | El radar (TypeScript, Node 22, sin servidores: corre en GitHub Actions). |
| `config/profile.json` | **Tu búsqueda**: palabras del cargo, exclusiones, herramientas, dónde, piso salarial, fuentes. |
| `cv/` | Generador de CVs de una página desde `cv/perfil.json` (`bash cv/build.sh cv/out`). |
| `perfil/` | Tus datos para formularios, tu tracker de postulaciones y tus prácticas de entrevista. **Solo en repos privados.** |
| `plantillas/` | Plantilla de CV para llenar (`mi-cv.md`) y un CV de ejemplo con datos ficticios. |
| `GUIA-PERFIL.md` | Cómo hacer un buen CV y un buen LinkedIn, para cualquier profesión. |
| `.claude/skills/` | `radar-configurar`, `radar-revisar-perfil`, `radar-postular`, `radar-entrevista`. |

## Fuentes

| Fuente | Cómo entra |
|---|---|
| Páginas de carreras de empresas (Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters) | APIs públicas. La lista va en `config/profile.json → boards` y el radar detecta solo qué plataforma usa cada empresa. |
| Get on Board | API pública de búsqueda (`sources.getonbrdQueries`). Tecnología en LatAm. |
| Magneto | Páginas públicas de vacantes (`pages`). |
| Remotive, Himalayas, Jobicy, RemoteOK, We Work Remotely | APIs o RSS públicos. **Son agregadores**: copian ofertas de otros sitios, así que pierden puntos y nunca salen como 🟢 Fuertes. Se configuran en `sources` o se apagan en `sources.disabled`. |
| LinkedIn, Computrabajo, elempleo, Indeed | **Alertas por correo.** No tienen API pública y LinkedIn prohíbe el scraping; leer tus propias alertas es la vía confiable. |

## Alertas por correo (LinkedIn, Computrabajo, elempleo, Magneto)

1. Crea alertas de empleo **diarias** en esos portales para tus cargos y ciudades.
2. En Gmail, crea un filtro con esta búsqueda y que les **aplique la etiqueta** `chamba-radar` (créala):
   `from:(jobalerts-noreply@linkedin.com OR magneto365.com OR computrabajo.com OR elempleo.com OR indeed.com OR getonbrd.com)`
3. Crea una **contraseña de aplicación** de Google (requiere verificación en 2 pasos; se revoca cuando quieras en *Seguridad → Contraseñas de aplicaciones*).
   > Una contraseña de aplicación da acceso IMAP a todo el buzón. El código solo abre la etiqueta `chamba-radar`. Si prefieres aislarlo del todo, reenvía las alertas a una cuenta de Gmail aparte y usa esa.
4. En tu repo: *Settings → Secrets and variables → Actions → New repository secret*: `GMAIL_USER` (tu correo) y `GMAIL_APP_PASSWORD`.

Sin esos secrets el radar funciona igual; solo marca la fuente `email` como "omitida".

## Cómo puntúa (todo se ajusta en `config/profile.json`)

- **Nivel** (`seniority`): la primera regla que encaja con el título suma; por defecto liderazgo +20 y senior +15.
- **Bonos del título** (`titleBonuses`): puntos extra o en contra según palabras del título.
- **Herramientas** (`stack`): pesos por palabra, con tope de 35.
- **Industria** (`domain`): +10. **IA** (`aiWords`): +10.
- **Dónde**: Colombia o LatAm +18, global +15, sin confirmar +4. Se descartan las atadas a otro país aunque digan "remote" (piden residencia, permiso de trabajo o visa).
- **Salario** sobre tu piso: +10; bajo el piso: −15 y ⚠️.
- **Frescura**: hasta +10. Las de agregadores: −12.

🟢 **Fuertes**: 65 puntos o más y publicadas por la empresa. 🟡 **Posibles**: 40 o más.

Cada resultado trae además "📌 Siguen abiertas" (las mejores ya vistas), "🔍 Quizá contratan desde Colombia" (para revisar a mano) y la tabla "Embudo" con el porqué de cada descarte.

## Correr a mano

```bash
npm ci
npm test
node src/main.ts --dry                  # trae y muestra, no escribe nada
node src/main.ts --only=getonbrd,email  # solo algunas fuentes
bash cv/build.sh cv/out                 # genera tus CVs (necesita Playwright y pdfinfo)
npm run actualizar                      # trae mejoras del motor sin tocar tus datos
```

## Privacidad

- Usa tu repo en **privado**: ahí quedan tus resultados, tu tracker y tus datos de formulario. El workflow falla a propósito si el repo es público y tiene `perfil/datos.md`.
- Nunca subas contraseñas al repo: van en *Secrets*.
- En un repo privado, GitHub da 2.000 minutos gratis al mes; el radar corre una vez al día y gasta una fracción.

## Licencia

[MIT](LICENSE). Hecho por David Vargas ([@krespokiller](https://github.com/krespokiller)) para su propia búsqueda y la de sus amigos. Mejoras bienvenidas.
