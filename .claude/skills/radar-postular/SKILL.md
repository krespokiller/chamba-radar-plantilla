---
name: radar-postular
description: Prepara y llena una postulación de la persona dueña de este repo (veredicto, CV, respuestas, formulario y tracker), sin enviarla; también en lote desde el digest del radar.
---

# Postular a una oferta

Usar cuando la persona diga "postúlame a <link>", "pasemos a la siguiente" o pida una tanda del digest.

## Fuentes de verdad
- `perfil/datos.md`: datos de formulario, salario, respuestas delicadas, qué no se menciona, banco de historias.
- `cv/perfil.json` y los CVs (`bash cv/build.sh cv/out`).
- Tracker: `perfil/postulaciones.md`.
Si falta `perfil/datos.md`, usar primero la skill radar-configurar.

**Regla de oro:** usar solo hechos de esos archivos o lo que la persona diga. Si un formulario pide algo que no está, preguntarle. Nunca inventar experiencia, cifras ni logros. Respetar lo que `datos.md` dice que no se menciona.

## Flujo por oferta
1. **Duplicados**: buscar la empresa en `perfil/postulaciones.md`. Si ya postuló al mismo rol, no repetir.
2. **Leer la oferta** en el navegador. Si viene de un agregador, buscar la original en la web de la empresa. Confirmar que sigue abierta.
3. **Veredicto corto**: encaje 1–5, qué encaja, qué falta, si puede tomarla desde donde vive (modalidad y ciudad de `datos.md`; descartar si exige visa o residencia en otro país), salario si lo publican.
4. **CV**: elegir la variante que mejor encaja; crear una nueva en `cv/perfil.json` solo si vale la pena. Siempre una página.
5. **Respuestas** a preguntas abiertas: en el idioma de la oferta, cortas, con historias reales de `datos.md`, nombrando algo específico de la empresa o el cargo.
6. **Mostrar respuestas y salario a la persona y esperar su OK** antes de escribir en el formulario.
7. **Llenar** el formulario. Intentar subir el CV con la herramienta de subir archivos; si no se puede, enviarle el PDF para que lo adjunte. **Nunca dar Submit/Enviar**: eso lo hace la persona.
8. **Verificar** que cada campo quedó bien (leer los valores al final).
9. **Tracker**: agregar o actualizar la fila en `perfil/postulaciones.md` (fecha, empresa, rol, link, estado `por enviar`, encaje, CV, siguiente paso). Commit y push.
10. Cuando la persona confirme el envío: estado `enviada` y siguiente paso "seguimiento" a 7 días.

## Respuestas por defecto
- Nunca escribir contraseñas ni iniciar sesión por la persona: si un portal pide login, ella entra sola y avisa.
- Autorización de trabajo: sí en Colombia; no en otros países.
- Título universitario: responder la verdad; si dice "or equivalent experience", la experiencia cuenta.
- Preguntas demográficas: "Prefiero no responder" salvo que la persona diga otra cosa.
- Nunca revelar el salario actual o anterior; dar el número de `datos.md`.
- Preguntas de sí/no con consecuencias (antecedentes, exclusividad, contratos): preguntarle.

## Después de postular
Estados: `por enviar` → `enviada` → `entrevista` → `oferta` / `rechazada` / `descartada` / `sin respuesta`.
Seguimiento a los 7 días con un mensaje de 2–3 frases al reclutador (rol, por qué encaja, disponibilidad); otro a los 14; después, `sin respuesta`. Nunca enviar mensajes sin el OK de la persona.

## Modo lote
Leer `digest/latest.md` (secciones Fuertes, Posibles y "Siguen abiertas"), quitar lo que ya está en el tracker y darle una tabla: empresa, rol, encaje, si puede tomarla, CV sugerido. La persona elige el orden y se preparan una por una. Meta sugerida: 3–5 postulaciones buenas al día.
