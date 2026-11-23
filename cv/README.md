# cv/

Tus CVs de una página salen de un solo archivo de datos: `perfil.json`.

- **Llenarlo**: pídele a Claude "configúrame el radar" con tu CV adjunto, o copia el formato de `../plantillas/ejemplo-perfil.json`.
- **Generarlos**: `bash cv/build.sh cv/out` → un PDF por variante (falla si alguno pasa de una página).
- **Variantes**: una por cargo objetivo, en `variants`. Cada una elige su título, su perfil, qué logros de cada trabajo mostrar (`jobs`) y qué grupos de habilidades (`skills`).
- **Idioma**: `lang` "es" o "en" (también por variante).
- **Enviados**: guarda en `cv/sent/<empresa>-<fecha>.pdf` el CV exacto que mandaste a cada empresa.
