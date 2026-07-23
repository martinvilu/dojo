# ❓ Preguntas Frecuentes y Solución de Problemas (FAQ)

Esta sección reúne las consultas habituales y soluciones a problemas técnicos frecuentes en Jutsu Classroom.

---

## 1. Problemas de Inicio de Sesión y Autenticación

### ❓ Me aparece el error "Unable to process request due to missing initial state..." al iniciar sesión con GitHub o Google.

```{warning}
Este mensaje ocurre cuando el navegador bloquea el almacenamiento local `sessionStorage` o las cookies de terceros (común en Modo Incógnito o navegadores con protección estricta como Brave/Safari).
```

**Solución**:
1. Desactiva el bloqueo de cookies de terceros para el sitio de la plataforma.
2. Abre la aplicación en una ventana normal de navegador fuera del Modo Incógnito.
3. Si el problema persiste, usa el inicio de sesión con correo y contraseña.

---

## 2. Asistencia y Geolocalización

### ❓ Intento firmar la asistencia con QR y me aparece "Estás demasiado lejos del aula".
- **Causa**: Tu celular o computadora está enviando coordenadas GPS desactualizadas o la señal de ubicación no es precisa.
- **Solución**:
  1. Asegúrate de estar físicamente dentro del aula.
  2. Desactiva y vuelve a activar el GPS de tu dispositivo.
  3. Refresca la página y vuelve a otorgar permisos de ubicación al navegador.

### ❓ El código QR dice "El código de asistencia ha expirado".
- **Causa**: Han transcurrido más de 45 segundos desde que se generó ese código en la pantalla del docente.
- **Solución**: Escanea el código QR nuevo que se esté proyectando en ese instante en la pantalla.

---

## 3. GitHub y Entregas

### ❓ No puedo crear mi repositorio de tarea en GitHub.
- **Causa**: No tienes configurado tu usuario de GitHub en tu perfil.
- **Solución**: Ve a **Mi Perfil**, ingresa tu nombre de usuario exacto de GitHub y guarda los cambios antes de aceptar la tarea.

---

## 4. Calendario e iCal

### ❓ ¿Cómo sincronizo el calendario con mi teléfono celular?
1. Haz clic en **`📥 Exportar .ics`** desde la pestaña **Calendario**.
2. Abre el archivo `.ics` descargado en tu dispositivo. Tu aplicación de calendario (Google Calendar / Apple Calendar) te preguntará en qué agenda agregar los eventos.
