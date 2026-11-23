# chamba-radar

Radar de ofertas de trabajo para personas en Colombia: un GitHub Action lee bolsas de empleo una vez al día, filtra por el perfil de la persona, puntúa y abre un issue con lo nuevo. Guía para personas: `GUIA.md`. Cómo hacer un buen perfil: `GUIA-PERFIL.md`.

## Qué hacer según el estado del repo
- Si `git remote get-url origin` es `krespokiller/chamba-radar-plantilla`: es la plantilla original. Aquí solo se mejora el motor; no se configuran perfiles personales.
- En cualquier otro repo (la copia de una persona):
  - Si `perfil/datos.md` no existe, o `config/profile.json` todavía dice "cambiar": ofrecer de una la skill **radar-configurar**.
  - Postular: **radar-postular**. Revisar CV y LinkedIn: **radar-revisar-perfil**. Practicar entrevistas: **radar-entrevista**.
  - "Actualiza el radar": `npm run actualizar`, revisar el diff con la persona, commit y push a `main`.
  - "Revisemos el resultado": leer `digest/latest.md` y la tabla "Embudo" y ajustar `config/profile.json` (skill radar-configurar, paso 4).
  - "Configuremos las alertas por correo": README, sección "Alertas por correo"; la persona crea la contraseña y los secrets ella misma.
  - "¿Cómo van mis postulaciones?": leer `perfil/postulaciones.md`, resumir por estado y proponer los seguimientos vencidos (skill radar-postular).
- Los cambios de configuración tienen que llegar a la rama `main`: el radar lee de ahí.

## Reglas
- El CV (`cv/perfil.json`) es la fuente de verdad. Nunca inventar experiencia, cifras ni logros.
- Nunca enviar una postulación ni un mensaje sin el OK de la persona; el botón final lo da ella.
- Datos personales (`perfil/`) solo en repos privados.
- Cambios al motor (`src/`): lo personal va en `config/profile.json`, nunca en el código. `npm test` y `npm run typecheck` deben pasar antes de cada push.

## Mapa
- `src/main.ts` corrida; `src/score.ts` filtros y puntaje; `src/sources/` fuentes (ATS, portales, Magneto, correo); `src/update.ts` actualizar desde la plantilla.
- `config/profile.json` búsqueda; `config/profile.example.json` plantilla con ayuda.
- `cv/build.py` + `cv/perfil.json` → CVs de una página (`bash cv/build.sh cv/out`); `plantillas/ejemplo-perfil.json` ejemplo completo.
- `data/state.json` lo ya visto y qué plataforma de empleo usa cada empresa; `digest/` resultados.
