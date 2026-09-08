# Cómo funciona todo, explicado de cero

Este documento cuenta dónde vive cada pieza del sistema, cómo se conectan entre sí y qué
hace cada parte del código. Está escrito para poder entenderlo sin saber programar.

---

## 1. El mapa: cuatro lugares distintos

El sistema no vive en un solo lado. Son cuatro servicios, cada uno con su tarea:

| Dónde | Qué guarda o hace | Quién es dueño |
|---|---|---|
| **GitHub** | El código fuente. Es "el original" del proyecto. | Tu cuenta de GitHub |
| **Vercel** | Corre la página en internet. Toma el código de GitHub y lo publica. | Tu cuenta de Vercel |
| **Google Calendar** | **Todas las reservas.** Es la única base de datos del sistema. | La cuenta del santuario |
| **Resend** | Manda el mail de aviso cuando entra una reserva. | La cuenta del santuario |

La idea de fondo: **el sistema no guarda datos propios en ningún lado**. Todo lo que es una
reserva vive en Google Calendar. Si mañana apagamos la página, las reservas siguen ahí y
quien organiza sigue trabajando como siempre. Eso fue a propósito.

---

## 2. GitHub: dónde está el código

**Dirección:** https://github.com/augustozuliani24/proyectosc
**Rama:** `claude/chay-page-idea-dr514j` (es la rama principal del repositorio)

Una *rama* es una línea de trabajo. Este proyecto tiene una sola, y es también la de
producción: lo que está ahí es lo que está publicado.

Cada cambio se guarda en un *commit*: una foto del proyecto en un momento, con un mensaje
que explica qué cambió y por qué. El historial completo se ve en la pestaña "Commits" de
GitHub. Sirve para saber cuándo entró cada cosa y para volver atrás si algo se rompe.

---

## 3. Vercel: cómo la página llega a internet

**Panel:** https://vercel.com/augustozuliani24/reservas-santuario
**Sitio:** https://reservas-santuario.vercel.app

### El enlace con GitHub

El proyecto de Vercel está **conectado al repositorio de GitHub**. Eso significa que cada
vez que se sube un cambio a la rama de producción, Vercel:

1. Se entera sola (GitHub le avisa).
2. Descarga el código nuevo.
3. Lo compila (`npm run build`).
4. Si compiló bien, lo publica.

Todo eso tarda alrededor de un minuto y **no requiere que nadie haga nada**. Si el código
tuviera un error, el build falla y Vercel **deja la versión anterior funcionando**: nunca
se publica algo roto.

Para conectarlo hubo que darle permiso a la aplicación de Vercel en GitHub sobre este
repositorio en particular (en GitHub → Settings → Applications → Vercel → Configure).

### Las variables de entorno

Son los datos secretos y de configuración que **no van en el código**: claves, direcciones,
horarios. Se cargan en *Settings → Environment Variables* del panel de Vercel.

**Lo más importante de entender:** las variables solo entran en los deploys que se crean
**después** de cargarlas. Si cargás una variable y no volvés a desplegar, el sitio publicado
sigue sin verla. Por eso, después de tocar variables hay que hacer *Redeploy* (o subir
cualquier cambio, que dispara un deploy nuevo).

Las que están cargadas hoy:

- `GOOGLE_CALENDAR_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY` → el calendario
- `RESEND_API_KEY`, `NOTIFICACIONES_EMAIL` → el aviso por mail

Todas las demás (horarios, lugares, duraciones) tienen valores por defecto en el código y
solo hace falta cargarlas si se quiere cambiar algo. Están listadas en `.env.example`.

---

## 4. Las integraciones: cómo habla con otros servicios

### Google Calendar

Es la integración central. El sistema necesita **leer** el calendario (para saber qué está
ocupado) y **escribir** (para crear la reserva).

No se usa la contraseña de la cuenta. Se usa una **cuenta de servicio**: una especie de
usuario robot creado en Google Cloud Console, que tiene su propio mail (termina en
`.iam.gserviceaccount.com`) y su propia clave. A ese robot se le compartió el calendario
"Pastoral Santuario San Juan" con permiso de "Hacer cambios en los eventos", igual que se
comparte un documento.

Ventajas: el sistema **solo puede tocar ese calendario**, nunca el mail ni el resto de la
cuenta, y el acceso se corta cuando se quiera, desde la pantalla de compartir del
calendario.

Cada reserva se crea como un evento con:

- **Título:** `Santuario + Cocina · Familia Pérez`
- **Descripción:** los lugares, cuántas personas, quién reservó, el teléfono y el motivo
- **Datos ocultos** (que solo lee el sistema): qué lugares ocupa, el nombre y el teléfono

### Resend (el mail de aviso)

Cuando entra una reserva, el sistema le manda un mail con todos los datos a la casilla del
santuario. Se usa Resend, un servicio de envío de mails, con plan gratuito de sobra para
este volumen.

No se usan las notificaciones propias de Google Calendar porque **no funcionan para este
caso**: la de "evento nuevo" solo se dispara con invitaciones, y estas reservas las escribe
directo la cuenta de servicio. Agregar a quien organiza como invitada tampoco sirve, porque
una cuenta de servicio no puede invitar a nadie sin Google Workspace.

Si el mail falla, **la reserva igual queda guardada**. Nunca se pierde una reserva real por
culpa de un aviso.

### WhatsApp (preparado, no activo)

El código para responder automáticamente con el link ya está escrito
(`src/app/api/whatsapp/webhook/route.ts`), pero está apagado porque falta dar de alta el
número en Meta. Mientras tanto, el link se pasa a mano y funciona igual.

---

## 5. El código: qué hace cada archivo

El proyecto está hecho con **Next.js**, que permite escribir en un mismo proyecto la parte
que se ve en el navegador y la que corre en el servidor.

```
src/
  app/                            las páginas y las direcciones del sitio
    page.tsx                      la página principal: el formulario de reserva
    layout.tsx                    el marco común de todas las páginas
    globals.css                   los colores, tipografías y estilos
    icon.svg                      el ícono de la pestaña del navegador
    comprobante/[id]/page.tsx     el comprobante de una reserva
    api/
      availability/route.ts       responde qué horarios están libres un día
      reservations/route.ts       crea la reserva (el corazón del sistema)
      estado/route.ts             diagnóstico: dice si todo está bien conectado
      reservas/[id]/ics/route.ts  el archivo para agendar en el celular
      whatsapp/webhook/route.ts   la respuesta automática de WhatsApp

  components/                     las piezas visuales
    booking-form.tsx              el formulario de 5 pasos
    imagen-santuario.tsx          la imagen del encabezado
    acciones-comprobante.tsx      los botones de imprimir y agendar

  lib/                            la lógica, separada de lo visual
    config.ts                     toda la configuración (horarios, lugares, topes)
    time.ts                       fechas y horas con zona horaria
    disponibilidad.ts             las reglas: qué se puede reservar y qué no
    google-calendar.ts            leer y escribir en el calendario
    notificaciones.ts             el mail de aviso
    telefono.ts                   formato y validación del teléfono
    modo.ts                       decide si está en modo demostración
    whatsapp.ts                   envío de mensajes de WhatsApp
```

**Por qué está separado así:** las reglas (`lib/`) no saben nada de pantallas, y las
pantallas no saben de calendarios. Eso permite probar las reglas sin internet y cambiar el
diseño sin tocar la lógica.

---

## 6. Qué pasa cuando alguien reserva, paso a paso

1. **Abre la página.** El servidor calcula qué día conviene mostrar (hoy, o el próximo con
   horarios libres) y arma el formulario.

2. **Elige un día.** El navegador le pregunta al servidor por ese día
   (`/api/availability`). El servidor le pregunta a Google Calendar qué eventos hay, arma
   la lista de bloques ocupados **de cada lugar por separado** y la devuelve.

3. **Elige el horario.** Toca la hora de inicio y la de fin. La grilla solo lo deja llegar
   hasta donde empieza la próxima reserva.

4. **Elige los lugares.** Los que están ocupados en ese horario aparecen deshabilitados.

5. **Completa personas, nombre, teléfono y motivo.**

6. **Toca "Confirmar".** Acá pasa lo importante, en el servidor
   (`/api/reservations`):

   - **Revalida todo de cero.** No confía en nada de lo que mandó el navegador: revisa
     fecha, horario, lugares, teléfono. Alguien que edite la página desde el navegador no
     puede forzar una reserva inválida.
   - **Vuelve a consultar el calendario**, por si alguien reservó mientras la persona
     completaba el formulario.
   - **Crea el evento.**
   - **Lee otra vez** y, si aparece otra reserva del mismo lugar creada un instante antes,
     **da de baja la propia** y avisa. Así nunca quedan dos reservas pisadas.
   - **Manda el mail** de aviso.

7. **Ve la confirmación**, con el código y el link al comprobante.

---

## 7. Las reglas que aplica el sistema

- **Horario:** de 8 a 22, salvo los domingos que abren 13:30. Configurable por día.
- **Duración:** desde media hora hasta el día entero. No puede cruzar de un día a otro.
- **Lugares:** Santuario, SUM y Cocina, independientes entre sí. Se pueden combinar.
- **Anticipación:** hasta 90 días, y como mínimo 1 hora antes.
- **Eventos cargados a mano** en el calendario: si el título nombra un lugar ("Cocina -
  reunión"), bloquea solo ese; si no nombra ninguno, bloquea los tres. Ante la duda,
  prefiere rechazar una reserva de más antes que permitir dos superpuestas.

---

## 8. Cómo se prueba

- `npm test` → 32 pruebas de las reglas, sin internet ni credenciales.
- `npm run pruebas:api` → 37 pruebas de las rutas contra un servidor local.

Cubren todas las combinaciones de lugares, las duraciones extremas, los horarios del
domingo y cada pedido que debe rechazarse. Lo único que no cubren es la conexión real con
Google, que se prueba a mano reservando desde el sitio.

---

## 9. Costos

- GitHub: gratis
- Vercel (plan Hobby): gratis
- Google Calendar API: gratis
- Resend: gratis hasta 3.000 mails por mes
- WhatsApp (si algún día se activa): centavos por mensaje

---

## 10. Cómo cambiar algo vos mismo

No hace falta instalar nada: se puede editar desde el navegador, en GitHub.

### Los pasos

1. Entrá al archivo que querés cambiar en
   https://github.com/augustozuliani24/proyectosc
2. Tocá el **lápiz** (arriba a la derecha del contenido del archivo).
3. Cambiá lo que quieras.
4. Abajo de todo, escribí en una línea qué cambiaste (por ejemplo, "Cambiar el texto de
   bienvenida") y tocá **Commit changes**.
5. Listo. Vercel se entera sola y en un minuto está publicado.

### Dónde está cada cosa que se suele querer cambiar

| Qué querés cambiar | Archivo |
|---|---|
| El título, el subtítulo y el texto del pie | `src/app/page.tsx` |
| Los textos del formulario (los pasos, los ejemplos de cada campo) | `src/components/booking-form.tsx` |
| Los textos del comprobante | `src/app/comprobante/[id]/page.tsx` |
| Los colores | `src/app/globals.css` (arriba de todo, en `@theme`) |
| El mensaje automático de WhatsApp | `src/app/api/whatsapp/webhook/route.ts` |
| Horarios, lugares, duraciones, topes | No se tocan acá: son variables de entorno en Vercel |

### Qué es seguro tocar y qué no

**Seguro:** todo lo que esté entre comillas y sea un texto que se lee en la pantalla.
Cambiar `"Elegí el día"` por `"¿Qué día lo necesitás?"` no puede romper nada.

**Con cuidado:** los archivos de `src/lib/`. Ahí viven las reglas (horarios, choques de
reservas, validaciones). Un cambio ahí puede hacer que se acepten reservas superpuestas.

**Regla práctica:** cambiar lo que está *adentro* de las comillas es seguro. Cambiar lo que
está *afuera* puede romper el código.

### Si algo sale mal

No hay que tenerle miedo, porque hay dos redes de contención:

1. **Si el código queda roto, el sitio no se rompe.** Vercel intenta compilar; si falla,
   deja publicada la versión anterior y avisa que el build falló. La página sigue andando.
2. **Todo cambio se puede deshacer.** En la pestaña *Commits* de GitHub, entrás al cambio y
   tocás **Revert**: se crea otro commit que lo deja como estaba.

Para ver si salió bien: https://vercel.com/augustozuliani24/reservas-santuario → pestaña
*Deployments*. Verde (*Ready*) es que se publicó; rojo (*Error*) es que algo no compiló, y
ahí conviene revertir o pedir ayuda.

### Si trabajamos los dos

El código lo edita quien sea, pero si los dos tocamos el mismo archivo al mismo tiempo
puede haber choques. Alcanza con avisar qué se tocó.

## 11. Lo que queda pendiente

- **Cancelar reservas** desde la página (falta decidir cómo se identifica la persona).
- **Dar de alta el número en Meta** para la respuesta automática de WhatsApp.
- **Un dominio propio**, que además de una dirección más linda haría que los mails no caigan
  en Spam para destinatarios nuevos.
