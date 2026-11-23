---
name: radar-revisar-perfil
description: Revisa el CV y el LinkedIn de la persona dueña de este repo con los criterios de GUIA-PERFIL.md y propone cambios concretos, sin inventar nada.
---

# Revisar el perfil (CV y LinkedIn)

Usar cuando la persona diga "revísame el perfil", "¿mi CV está bien?", "mejora mi LinkedIn" o similar.

## Qué leer
- `GUIA-PERFIL.md` (los criterios).
- `cv/perfil.json` y los PDF (`bash cv/build.sh cv/out`), o el CV que adjunte.
- `perfil/datos.md` (cargos objetivo, qué no se menciona).
- Su LinkedIn: abrirlo en el navegador y leer titular, Acerca de, experiencia, aptitudes y Open to Work. Solo lectura.
- Si tiene ofertas guardadas en `perfil/postulaciones.md` o en el digest, leer 3–5 de su cargo objetivo para sacar las palabras clave que se repiten.

## Qué entregar (corto, en orden de impacto)
1. **Veredicto** de 1 a 5 para el CV y para LinkedIn, con una frase cada uno.
2. **Los 5 cambios que más suman**, cada uno con el texto actual y el propuesto (titular, perfil, 2–3 logros reescritos como "qué + cómo + resultado", palabras clave que faltan).
3. **Inconsistencias** entre CV y LinkedIn (fechas, cargos, empresas).
4. **Lo que falta y solo la persona sabe** (números de logros, certificaciones), como preguntas concretas.

## Reglas
- Nunca escribir contraseñas ni iniciar sesión por la persona: si un portal pide login, ella entra sola y avisa.
- Nunca inventar logros, cifras, cargos ni certificaciones. Si un logro necesita un número que no está, preguntarlo.
- Respetar lo que `perfil/datos.md` dice que no se menciona.
- Aplicar cambios al CV (`cv/perfil.json`) solo con el OK de la persona; rehacer los PDF y verificar que sigan en una página.
- En LinkedIn, editar solo con el OK de la persona y campo por campo. Los campos de LinkedIn son contenteditable: clic, seleccionar todo, escribir; verificar leyendo la página después de guardar.
