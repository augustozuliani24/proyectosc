# La idea

## El problema

La organización del movimiento de Schoenstatt maneja un WhatsApp donde llegan dos cosas
mezcladas:

- **Consultas** sobre el movimiento, que las contesta una persona.
- **Pedidos para reservar el santuario**, que hoy implican ir y venir por chat hasta
  acordar fecha y horario, y después cargarlo a mano en Google Calendar.

Google Calendar ya es la herramienta que se usa para saber cuándo está ocupado el
santuario y quién lo ocupa. Eso funciona bien y no hay que reemplazarlo.

## La solución

Sacar **sólo las reservas** del chat y llevarlas a una página web, dejando las consultas
exactamente como están hoy.

Cuando alguien escribe al WhatsApp del movimiento recibe un mensaje automático con dos
caminos:

- Si es una consulta, sigue escribiendo por el chat y le contesta una persona. **El bot no
  interviene.**
- Si quiere reservar, entra a un link, elige día y horario, y la reserva se carga sola en
  el Google Calendar.

## Decisiones de diseño (y por qué)

**Sin inteligencia artificial.** Una idea previa era usar un modelo de lenguaje para
clasificar cada mensaje entrante (consulta vs. reserva) y extraer los datos. Se descartó:
tiene costo por mensaje, es impredecible y no hace falta. Un mensaje automático con un
link resuelve lo mismo con lógica simple y gratis.

**Horario libre, no franjas fijas.** La persona toca la hora de inicio y la de fin sobre
una grilla de media hora, así una reserva puede ir de 9:00 a 9:30 o de 15:00 a 21:00 sin
que haya que anticipar qué duraciones ofrecer. La grilla solo deja llegar hasta donde
empieza la próxima reserva.

**Varios lugares, una sola agenda.** Se reservan Santuario, Zoom y Cocina por separado, y
una persona puede tomar los que necesite a la vez. Todo va a un mismo Google Calendar
(para no obligar a manejar tres), y cada evento anota qué lugares ocupa. Los eventos
cargados a mano se interpretan por el título, y si no nombran ningún lugar se asume que
ocupan todo: ante la duda, mejor rechazar una reserva de más que superponer dos.

**Sin base de datos.** El Google Calendar es el único registro. Cada evento ya guarda
fecha, horario y quién reservó. Ventajas: quien organiza sigue usando la herramienta de
siempre, no hay dos fuentes de verdad que puedan desincronizarse, y no hay que pagar ni
mantener una base.

**La persona sigue contestando los mensajes.** Era un requisito explícito. Se resuelve con
*WhatsApp Coexistence*, que permite usar el mismo número desde la app del celular y desde
la API al mismo tiempo. El bot sólo manda el mensaje con el link; todo lo demás queda en
la conversación normal.

**El chequeo de disponibilidad se hace en el servidor.** La página muestra los horarios
ocupados para orientar, pero la validación real (que el horario esté libre, dentro del
horario permitido, no en el pasado) se rehace en el servidor al confirmar. Nadie puede
forzar una reserva editando la página.

**Protección contra reservas simultáneas.** Entre que se consulta el calendario y se crea
el evento pasa un instante. Si dos personas reservan lo mismo al mismo tiempo, el servidor
detecta la superposición después de crear el evento, da de baja el suyo y le avisa a la
segunda persona. El calendario nunca queda con dos reservas pisadas.

## Costos

Prácticamente nulos para el volumen de una organización chica:

- La app de WhatsApp Business en el celular: gratis, no cambia.
- Cloud API de Meta: los mensajes de servicio pasan a tener un costo por mensaje desde
  octubre de 2026. A este volumen, centavos por mes.
- Hosting en Vercel (plan Hobby): gratis.
- Google Calendar API: gratis.
- Sin costo de IA, porque no se usa.

Se evita a propósito un intermediario tipo Twilio o 360dialog: simplifican el alta pero
cobran una cuota fija mensual.

## Lo que tiene que hacer la organización

Son trámites ligados a las cuentas del movimiento, no se pueden hacer desde el código:

1. Compartir el Google Calendar del santuario con la cuenta de servicio, con permiso de
   edición (ver README).
2. Dar de alta el número en WhatsApp Cloud API dentro de Meta Business Manager, con la
   verificación del negocio, y activar Coexistence escaneando el QR desde el celular.

La página funciona sin el punto 2: mientras tanto el link se puede pasar a mano. Y sin el
punto 1 también se puede ver y navegar, en modo demostración, sin guardar nada.

## Pendiente de definir

- **Si conviene que las reservas queden confirmadas al instante** o que primero las
  apruebe alguien. Hoy se confirman solas.
