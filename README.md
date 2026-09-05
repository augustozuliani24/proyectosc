# Reservas del Santuario

Página web para que la gente reserve los espacios del Santuario de Schoenstatt sola, sin
que nadie tenga que coordinar por WhatsApp. La persona elige día, horario y qué lugares
necesita, y si están libres la reserva queda cargada **al instante en el Google Calendar
del santuario**.

No hay base de datos: el calendario de Google es el único registro de las reservas.
Eso significa que quien organiza sigue viendo y manejando todo desde el Google Calendar
de siempre, sin aprender ninguna herramienta nueva.

## Cómo funciona

1. Alguien le escribe al WhatsApp del movimiento.
2. El sistema le responde automáticamente un mensaje con dos caminos: seguir escribiendo
   si es una consulta (**la contesta una persona, el bot no se mete**), o entrar al link
   si quiere reservar.
3. En la página elige el día, toca la hora de inicio y la de fin, marca qué lugares
   necesita y cuánta gente va a ser. Lo que ya está reservado aparece tachado, así no prueba a ciegas. Tocando de
   nuevo una hora ya elegida, la suelta.

   No hay duración mínima ni máxima más allá del horario del día: se puede reservar media
   hora o de la apertura al cierre. Lo que no se puede es cruzar de un día a otro — para
   dos días seguidos hay que hacer dos reservas.
4. Al confirmar, el servidor vuelve a chequear el calendario y crea el evento. Si en el
   medio alguien tomó ese horario, la reserva se rechaza y se le muestra qué quedó libre.

La única automatización sobre WhatsApp es mandar el link. Todas las conversaciones siguen
en manos de la persona que atiende el número.

## Los lugares

Se pueden reservar varios espacios independientes — por defecto **Santuario**, **SUM** y
**Cocina** — y una misma persona puede tomar uno, dos o los tres en el mismo horario. Cada
lugar tiene su disponibilidad propia: que el Santuario esté ocupado a las 10 no impide que
alguien reserve la Cocina a las 10.

Todo vive en **un solo Google Calendar**, para que quien organiza siga usando el calendario
de siempre. Cada reserva es un evento cuyo título dice los lugares (`Santuario + Cocina ·
Familia Pérez`), y el sistema además los guarda en el evento para saber exactamente cuáles
ocupa.

Para los eventos que se cargan **a mano** en el calendario, el sistema mira el título: si
nombra algún lugar (`Cocina - reunión`), bloquea solo ese; si no nombra ninguno, bloquea
los tres. Es a propósito — ante la duda prefiere rechazar una reserva de más antes que
superponer dos. Así que conviene nombrar el lugar en el título de los eventos manuales.

La lista de lugares se cambia con `SANTUARIO_LUGARES` sin tocar código.

## El teléfono

Se pide como `351 555 1234`: diez números, con la característica y sin el 0 ni el 15. El
campo los va acomodando solo mientras se escribe, y tolera que peguen el `+54` o el `0` de
adelante. La misma regla corre en el servidor (`src/lib/telefono.ts`), así que no alcanza
con editar la página para saltearla.

## Puesta en marcha

### 1. Google Calendar

Hace falta una **cuenta de servicio** de Google: una especie de usuario robot que puede
escribir en el calendario sin pedir permiso cada vez.

1. Entrar a [Google Cloud Console](https://console.cloud.google.com/) y crear un proyecto
   (por ejemplo, `reservas-santuario`).
2. En *APIs y servicios → Biblioteca*, habilitar **Google Calendar API**.
3. En *APIs y servicios → Credenciales*, crear una **cuenta de servicio**.
4. Dentro de esa cuenta, pestaña *Claves* → *Agregar clave* → *Crear clave nueva* → **JSON**.
   Se descarga un archivo; de ahí salen `client_email` y `private_key`.
5. En Google Calendar, abrir el calendario del santuario → *Configuración y uso compartido*
   → *Compartir con determinadas personas* → agregar el `client_email` de la cuenta de
   servicio con permiso **"Hacer cambios en los eventos"**.
6. En la misma pantalla, copiar el **ID del calendario**.

### 2. Variables de entorno

Copiar `.env.example` a `.env.local` y completar. Las obligatorias son sólo tres:

```
GOOGLE_CALENDAR_ID=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

El resto ajusta el comportamiento (horarios, duraciones, días cerrados) y tiene valores
por defecto razonables. Está todo explicado en `.env.example`.

> **Ojo con `GOOGLE_PRIVATE_KEY`**: en el JSON viene con saltos de línea reales. Al pegarla
> en Vercel hay que dejarla entre comillas con los `\n` escapados, o convertirla a base64
> (el código acepta las dos formas).

### 3. Deploy en Vercel

Ya está hecho: el proyecto **`reservas-santuario`** está enlazado a este repositorio, así
que **cada push a la rama `claude/chay-page-idea-dr514j` (la rama de producción) se
despliega solo**. No hay que correr ningún comando para publicar.

- Sitio: <https://reservas-santuario-augustozuliani24.vercel.app>
- Panel: <https://vercel.com/augustozuliani24/reservas-santuario>

Las variables de entorno se cargan en el panel, en *Settings → Environment Variables*, y
recién se aplican en el deploy siguiente. Mientras falten las de Google, el sitio queda en
modo demostración (ver más abajo).

El plan gratuito (Hobby) alcanza de sobra para este volumen.

Para compilar en tu máquina antes de pushear:

```bash
npm install
npm run build
```

### 4. WhatsApp (opcional, se puede dejar para el final)

La página funciona perfecto sin esto: alcanza con pasar el link a mano. Si además se
quiere la respuesta automática:

1. Dar de alta el número en **WhatsApp Cloud API** dentro de Meta Business Manager
   (requiere verificar el negocio). Si el número ya se usa con la app de WhatsApp Business,
   activar **Coexistence** para que se pueda seguir contestando desde el celular como
   siempre — se autoriza escaneando un QR, una sola vez.
2. Configurar el webhook apuntando a `https://TU-DOMINIO/api/whatsapp/webhook`, con el
   `WHATSAPP_VERIFY_TOKEN` que hayas puesto en las variables de entorno, y suscribirse al
   campo `messages`.
3. Cargar `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET` y
   `RESERVAS_URL`.

## Si el sitio sigue en modo demostración

Abrir `/api/estado` en el sitio. Dice qué variables llegaron, si el calendario responde y
qué hacer con lo que falta. No devuelve credenciales ni datos de las reservas, así que se
puede compartir para pedir ayuda.

Lo más común es haber cargado las variables **después** del último deploy: en Vercel las
variables solo entran en los deploys nuevos, así que hay que volver a desplegar
(*Deployments* → el de arriba → ⋯ → *Redeploy*) o pushear cualquier cambio.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
```

### Modo demostración

Si faltan las credenciales de Google, la página **entra sola en modo demostración**: se
puede navegar y usar el formulario, todos los horarios aparecen libres, y tanto el
formulario como la pantalla final avisan que la reserva no se guardó en ningún lado. Sirve
para mostrar el sitio antes de tener el calendario conectado.

Se apaga solo en cuanto las tres variables de Google están cargadas — no hay ningún
interruptor que pueda quedar mal puesto en producción.

Para forzarlo aunque el calendario esté conectado (probar sin ensuciar la agenda real):

```bash
RESERVAS_MODO_DEMO=1 npm run dev
```

## Estructura

```
src/
  app/
    page.tsx                       página de reserva
    api/availability/route.ts      qué horarios están libres un día
    api/reservations/route.ts      crea la reserva en el calendario
    api/whatsapp/webhook/route.ts  respuesta automática con el link
    api/estado/route.ts            diagnóstico de la conexión con Google
  components/
    booking-form.tsx               el formulario (día → horario → lugares → personas → datos)
  lib/
    config.ts                      toda la configuración por variables de entorno
    time.ts                        fechas y horas con zona horaria explícita
    disponibilidad.ts              reglas de qué se puede reservar, y ocupación por lugar
    google-calendar.ts             lectura y escritura del calendario
    telefono.ts                    formato y validación del teléfono
    whatsapp.ts                    envío de mensajes y validación de firma
docs/
  IDEA.md                          para qué es esto y por qué está hecho así
```
