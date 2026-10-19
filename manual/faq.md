# ❓ Preguntas Frecuentes y Solución de Problemas

Consultas habituales y soluciones a los problemas más comunes, agrupadas por tema.

---

## 1. Cuenta e ingreso

### Me aparece «Unable to process request due to missing initial state…» al entrar con Google o GitHub

El navegador bloquea el almacenamiento de sesión o las cookies de terceros (pasa en modo incógnito y en Brave o Safari con protección estricta).

1. Permití las cookies de terceros para el sitio de la plataforma.
2. Abrí la plataforma en una ventana normal, fuera del modo incógnito.
3. Si sigue fallando, ingresá con correo y contraseña.

### Olvidé mi contraseña

En la pantalla de ingreso escribí tu correo y tocá **¿Olvidaste tu contraseña?**. Si tu cuenta usa correo y contraseña, te llega un enlace para crear una nueva. Si ingresás con Google o GitHub, la contraseña se recupera en ese proveedor.

### «Demasiados intentos fallidos»

Después de varios intentos con una contraseña incorrecta, la cuenta se bloquea temporalmente por seguridad. Esperá unos minutos o restablecé la contraseña.

### «Tu sesión se cerró…» al volver a la plataforma

Se cambió la contraseña de tu cuenta o se usó **Cerrar sesión en todos los dispositivos**. Volvé a ingresar. Si no fuiste vos, cambiá la contraseña y avisá a la coordinación.

### Quedé en «Registro en Proceso de Aprobación»

- **Si sos estudiante de la UNRN**: ingresá tu matrícula con el formato `UNRN-12345` (UNRN- y al menos 5 dígitos) y presioná **Validar Matrícula**.
- **Si sos docente o no tenés matrícula**: un administrador tiene que aprobar tu cuenta. Avisale a la coordinación.

### «Formato de matrícula inválido»

La matrícula tiene que empezar con `UNRN-` en mayúsculas, seguida solo de números (mínimo 5). Ejemplo válido: `UNRN-10234`.

### Soy docente y no veo mis cátedras

Tu cuenta tiene que tener rol **Profesor** y estar asignada a la cátedra. Las dos cosas las hace un administrador (ver [Administradores §2.3](administradores.md)).

## 2. Inscripción

### «Código de invitación inválido»

- Revisá que sean los 6 caracteres que te dio el docente, sin espacios.
- El código se compara en mayúsculas: no importa cómo lo escribas.
- Si lo copiaste de un mensaje, puede haber cambiado una `O` por un `0`. Pedile el código al docente otra vez.

## 3. Asistencia y geolocalización

### «Estás demasiado lejos del aula para registrar asistencia»

El servidor calcula la distancia entre tu ubicación y la del docente al generar el QR. El máximo es 150 m.

1. Confirmá que estás en el aula.
2. Activá el GPS y dale permiso de ubicación al navegador.
3. Si estás en interiores, acercate a una ventana y reintentá con un QR nuevo.

### «El código de asistencia ha expirado o no es válido»

El QR cambia cada 15 segundos y cada código vale como máximo 30 segundos. Escaneá el que se está proyectando en ese momento.

### «No hay un código de asistencia activo en este momento»

El docente todavía no generó el QR o ya cerró la toma de asistencia.

### «Esta clase requiere tu ubicación para firmar asistencia»

El docente fijó la ubicación del aula. Activá el GPS, dale permiso de ubicación al navegador y volvé a escanear.

### «Este código corresponde a una clase diferente»

Abriste el escáner desde otra clase. Volvé a **Escanear QR** desde la barra lateral.

### La cámara no abre

- Dale permiso de cámara al sitio en el navegador.
- Cerrá otras aplicaciones que estén usando la cámara.
- Usá la opción de escribir el código de 6 caracteres a mano.

## 4. GitHub y entregas

### No puedo aceptar la tarea en GitHub

- Cargá tu **Usuario de GitHub** exacto en **Mi Perfil** y guardá.
- Si el error menciona permisos o el token, avisale al docente: el token de GitHub de la cátedra puede estar vencido.

### Acepté la tarea pero no veo el repositorio

Revisá tu correo y las notificaciones de GitHub: tenés que aceptar la invitación como colaborador del repositorio en la organización de la materia.

### Mis commits no aparecen

- Confirmá que hiciste `git push` al repositorio de la tarea (no a un fork propio).
- Revisá que el correo de tus commits esté vinculado a tu cuenta de GitHub.

### El docente cargó la nota y no la veo

Recargá la pestaña **Tareas**. Si la nota es conceptual («Aprobado») aparece como texto, no como número.

## 5. Calendario

### ¿Cómo sincronizo el calendario con el celular?

- **Suscripción que se actualiza sola**: en **Cronograma**, **📅 Suscribirse a Calendario**, o en el calendario, **📅 Añadir a Google Calendar**.
- **Copia del momento**: **📥 Exportar .ics** y abrir el archivo en el teléfono. No refleja los cambios posteriores.

### La suscripción dejó de funcionar

El docente pudo haber regenerado el token del calendario. Volvé a suscribirte con la URL nueva.

## 6. Docentes

### Las «Tareas Atrasadas» nunca aparecen

Las tareas creadas desde el formulario actual no tienen fecha límite, y sin fecha no hay atraso (ver [Docentes §5.1](docentes.md)).

### No puedo activar la revisión entre pares

Es una limitación conocida: la pantalla todavía no permite definir la rúbrica que exige el sistema (ver [Docentes §5.4](docentes.md)).

### «Los ayudantes de cátedra no pueden modificar la planificación base»

Los ayudantes pueden corregir, tomar asistencia y publicar avisos, pero no cambiar fechas, horarios ni clases. Pedile el cambio al titular.

### «La nota debe ser un número entre 0 y 10 o una calificación conceptual»

Usá números de 0 a 10 (`8`, `7,5`, `9.25`) o una palabra sin símbolos (`Aprobado`, `Ausente`). No se aceptan `9/10`, `15` ni negativos.

## 7. Conexión

### Apareció «Sin conexión a Internet. Los cambios no se guardarán hasta que vuelvas a conectarte.»

Se cortó internet. Lo que ya estaba cargado sigue visible, pero nada de lo que cargues se guarda hasta que vuelva la conexión, así que evitá cargar notas o asistencia mientras tanto. Al reconectarte aparece un aviso verde y podés seguir.
