---
name: radar-configurar
description: Configura el chamba-radar para la persona dueña de este repo (cualquier profesión) a partir de su CV y unas preguntas cortas; deja perfil, CVs, búsqueda y primera corrida listos.
---

# Configurar el radar para una persona nueva

Usar cuando alguien diga "configúrame el radar", "soy nuevo", "quiero usar el chamba-radar", o cuando `perfil/datos.md` no exista o `config/profile.json` todavía diga "cambiar".

Hablar en español, claro y sin jerga. La persona puede no ser de tecnología: explicar cada paso en una línea y pedirle solo lo necesario. Llevar una lista de tareas visible con los pasos de abajo.

## 0. Antes de empezar
- Confirmar que el repo es de la persona (creado con "Use this template") y si es **privado o público**. Si es público, explicar en una línea que el radar va a guardar ahí sus postulaciones y datos de formulario, recomendar hacerlo privado (Settings → General → Danger Zone → Change visibility) y no continuar con datos personales hasta que lo decida. El workflow falla a propósito si un repo público tiene `perfil/datos.md`.
- Si el repo es el original de la plantilla (`krespokiller/chamba-radar-plantilla`), PARAR: hay que crear la copia propia primero (GUIA.md, paso 1).

## 1. Conocer a la persona (una sola ronda de preguntas)
1. Pedirle su CV (PDF, Word o `plantillas/mi-cv.md` llena) y su LinkedIn si tiene. Leerlo completo.
2. Con AskUserQuestion o en texto, en una sola tanda, preguntar solo lo que el CV no dice:
   - cargos que busca (1–3) y cargos que NO quiere;
   - modalidad: remoto, híbrido o presencial, en qué ciudades de Colombia, y si se muda;
   - nivel de inglés;
   - salario a pedir (bruto mensual) y piso;
   - por qué busca trabajo y qué NO se debe mencionar (confidencialidad, situaciones personales);
   - datos de formulario: nombre(s), apellido(s), correo, teléfono, ciudad.
3. Regla de oro: el CV es la fuente de verdad. Nunca inventar experiencia, cifras, empresas ni herramientas. Si falta algo, preguntar.

## 2. Escribir su perfil
- `perfil/datos.md` desde `perfil/datos.example.md`: sus respuestas y un banco de historias con logros reales del CV (con números solo si el CV o la persona los dan).
- `cv/perfil.json`: su experiencia en el formato de `plantillas/ejemplo-perfil.json` (ver el docstring de `cv/build.py`). `lang` "es" o "en" según las ofertas que busca; una variante por cargo objetivo (1–3).
- Aplicar los criterios de `GUIA-PERFIL.md` (logros y no tareas, palabras clave de su cargo, una página). Si el CV original tiene tareas en vez de logros, proponer la versión con logros y pedirle los datos que falten; no inventarlos.
- `bash cv/build.sh cv/out`: cada CV debe salir de UNA página; si no, recortar. Enviarle los PDF y pedirle que los revise. (Necesita Playwright y `pdfinfo`, que vienen en las sesiones de Claude en la web. Si no están, enviarle los HTML de `cv/out/` y pedirle que los guarde como PDF desde el navegador.)

## 3. Configurar la búsqueda (`config/profile.json`, partiendo de `config/profile.example.json`)
- `areaWords`: palabras que deben aparecer en el TÍTULO de las ofertas que le sirven, en minúscula, sin tildes, en inglés y español. Ejemplos:
  - ciberseguridad: security, ciberseguridad, seguridad informatica, soc, pentest, appsec, cloud security, grc, iam, blue team, red team;
  - mecánica: mechanical, mecanico, mecanica, mantenimiento, maintenance, hvac, diseno mecanico, produccion, procesos, confiabilidad.
- `excludeTitle`: cargos a descartar (ventas, practicante, junior, otras áreas). No excluir su propia área.
- `stack`: herramientas, normas y certificaciones con peso 2–10 según qué tan centrales son (splunk, sentinel, aws, iso 27001, nist...; solidworks, autocad, ansys, sap pm, iso 9001, plc...).
- `domain`: industrias que le interesan (+10 puntos). `aiWords`: dejar vacío salvo que le interese trabajo con IA.
- `seniority` y `titleBonuses`: puntos por título (regex sobre el título en minúscula y sin tildes). Ajustar al nivel que busca.
- `floorMonthlyUsd`: su piso en USD (si cobra en pesos, convertir: 1 USD ≈ 4.000 COP).
- `sources`: búsquedas de los portales públicos para su profesión:
  - `getonbrdQueries` (Get on Board, tecnología en LatAm), p. ej. ["ciberseguridad", "security", "soc"];
  - `remotiveCategory`: software-dev, devops, data, qa, product, design, customer-support, finance-legal, hr, all-others, o vacío para no usarla;
  - `jobicyTags`; `weworkremotelyCategories` (p. ej. "remote-devops-sysadmin-jobs");
  - `disabled`: fuentes que no le sirven (p. ej. para trabajo presencial en Colombia: remotive, remoteok, himalayas, jobicy, weworkremotely).
- `pages`: búsqueda de Magneto para su cargo y ciudad. Abrir magneto365.com en el navegador, buscar su cargo, copiar la URL del listado y comprobar que `linkPattern` encaja con los links de las vacantes.
- `boards`: empresas cuyo portal de empleo lee el radar (Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters; detecta solo cuál usa cada una). La lista que trae es de empresas de tecnología remotas:
  - si su profesión es de tecnología, dejarla y AGREGAR empresas de su sector;
  - si no, reemplazarla por empresas de su sector que publiquen en esos portales, o dejarla vacía. Así cada corrida tarda menos y gasta menos minutos gratis de GitHub.

## 4. Probar y publicar
1. `npm test` y `npm run typecheck` deben pasar.
2. Commit y push. **Los cambios tienen que quedar en la rama principal (`main`)**, porque el radar lee el perfil de ahí: si la sesión trabaja en otra rama (p. ej. `claude/...`), abrir un pull request y guiar a la persona para que dé **Merge**, o hacer el merge si la sesión puede. Confirmar en GitHub que `config/profile.json` de `main` ya no dice "cambiar".
3. Guiarle, un paso a la vez, en GitHub:
   - pestaña **Actions** → si aparece, "I understand my workflows, go ahead and enable them";
   - workflow **radar** → **Run workflow** para la primera corrida. Si el resultado dice "Tu perfil todavía es la plantilla", el perfil no llegó a `main` (volver al paso 2).
   - botón **Watch** → **All Activity**, para que cada resultado le llegue al correo.
4. Al terminar la corrida, leer `digest/latest.md` con la persona y usar la tabla "Embudo" para ajustar: si casi todo cae en "título fuera del perfil", faltan palabras en `areaWords`; si cae en "título excluido", sobra algo en `excludeTitle`. Ajustar, push y repetir hasta que salgan ofertas que le sirvan.

## 5. Alertas por correo (opcional, muy recomendado para trabajos en Colombia)
Seguir la sección "Alertas por correo" del README con la persona: alertas diarias en LinkedIn, Magneto, Computrabajo y elempleo, filtro de Gmail con la etiqueta `chamba-radar`, contraseña de aplicación y los secrets `GMAIL_USER` y `GMAIL_APP_PASSWORD`. La persona crea la contraseña y los secrets ella misma; nunca pedirle que la pegue en el chat.

## 6. Cierre
En 3 líneas: qué quedó listo y cómo seguir. "Cuando te llegue el resultado, dime 'postúlame a <link>'" (radar-postular), "para revisar tu LinkedIn, 'revísame el perfil'" (radar-revisar-perfil) y "para practicar, 'entrevístame'" (radar-entrevista).
