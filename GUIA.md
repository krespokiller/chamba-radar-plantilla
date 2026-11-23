# Guía rápida: tu propio chamba-radar

El chamba-radar busca ofertas por ti todos los días, se queda con las que encajan con tu perfil y te las manda al correo. Con Claude, además, te arma el CV, te revisa el LinkedIn, te prepara las postulaciones y te entrena para las entrevistas.

Son unos 20 minutos la primera vez. Después, solo revisas el correo.

## Lo que necesitas
- Una cuenta de **GitHub** (gratis).
- Una cuenta de **Claude** con Claude Code (en la web o en la app).
- Tu **CV** en PDF o Word. Si no tienes uno bueno, descarga [plantillas/mi-cv.md](plantillas/mi-cv.md), llénalo y mira el [ejemplo](plantillas/ejemplo-cv.pdf).

## Paso 1. Tu copia (2 minutos)
1. En la página de este repo, botón verde **Use this template** → **Create a new repository**.
2. Ponle un nombre (por ejemplo `mi-chamba-radar`) y elige **Private**. Tus resultados y tus datos quedan solo para ti.
3. **Create repository**.

Tu copia es 100% tuya: no depende de este repo y nadie más la ve.

## Paso 2. Que Claude te lo configure (10 minutos)
1. Abre Claude Code y crea una sesión **con tu repo nuevo**.
2. Escríbele **"configúrame el radar"** y adjunta tu CV.
3. Claude te hace unas preguntas cortas (qué cargos buscas, dónde, cuánto quieres ganar), arma tus CVs de una página, configura la búsqueda para tu profesión y sube todo a tu repo.

## Paso 3. Encender el radar (en GitHub, en tu repo)
1. Pestaña **Actions**. Si aparece un botón verde para habilitar los workflows, dale clic.
2. A la izquierda, **radar** → **Run workflow** → **Run workflow**. La primera corrida tarda unos minutos.
3. Arriba en tu repo: **Watch** → **All Activity**. Así cada resultado te llega al correo.

Desde ahí corre solo todos los días a las 6:37 a. m.

## Paso 4. Ajustar (5 minutos)
Cuando llegue el primer resultado, dile a Claude **"revisemos el resultado"**. Al final hay una tabla "Embudo" que dice por qué se descartó cada cosa, y con eso Claude afina tu búsqueda.

## Paso 5 (recomendado). LinkedIn y portales colombianos
LinkedIn, Computrabajo y elempleo no se pueden leer directo, pero el radar sí lee las alertas que te llegan al correo. Dile a Claude **"configuremos las alertas por correo"** y te guía: alertas diarias, un filtro de Gmail y dos claves en GitHub que creas tú.

## El día a día
Te llega el resultado al correo; las 🟢 son las mejores. Luego, en una sesión de Claude con tu repo:

| Le dices | Hace |
|---|---|
| **"postúlame a <link>"** | Revisa si encaja, elige tu CV, escribe las respuestas, te las muestra y llena el formulario. **El botón de enviar lo das tú.** |
| **"revísame el perfil"** | Revisa tu CV y tu LinkedIn con [GUIA-PERFIL.md](GUIA-PERFIL.md) y te propone cambios concretos. |
| **"entrevístame para <empresa>"** | Simulacro de entrevista con feedback, en español o en inglés. |
| **"¿cómo van mis postulaciones?"** | Tu tracker y los seguimientos pendientes. |

## Preguntas frecuentes
- **¿Cuesta?** GitHub da 2.000 minutos gratis al mes en repos privados; el radar gasta una fracción con una corrida al día.
- **¿Sirve para mi profesión?** Para trabajo remoto de tecnología (incluida ciberseguridad) rinde mucho. Para trabajo presencial en Colombia (como ingeniería mecánica) rinde sobre todo con Magneto y con las alertas por correo del paso 5.
- **¿Cómo me llegan las mejoras?** Dile a Claude **"actualiza el radar"** (corre `npm run actualizar`). Trae el código nuevo sin tocar tus datos.
- **¿Es seguro?** Tus contraseñas van en Secrets, no en el código. Claude nunca envía una postulación ni un mensaje sin tu OK.
