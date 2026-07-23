# 👨‍🏫 Manual Detallado del Docente

Este manual describe minuciosamente cada flujo de trabajo y herramienta disponible para **Docentes** y **Jefes de Trabajos Prácticos (JTP)** en Jutsu Classroom.

```{note}
Para acceder a estas funcionalidades, tu usuario debe tener asignado el rol `teacher` o `admin` y poseer el estado de cuenta `approved`.
```

---

## 1. Configuración de Cátedras e Integración con GitHub

### 1.1 Creación y Gestión de Cátedras
1. En la barra lateral izquierda, selecciona la pestaña **Mis Cátedras (Docente)**.
2. Para crear una nueva materia, haz clic en **+ Nueva Cátedra**.
3. Completa el nombre de la materia (ejemplo: *Programación II - 2026*).
4. El sistema generará automáticamente un **Código de Invitación** alfanumérico.

```{tip}
Comparte el Código de Invitación con tus estudiantes para que puedan enrolarse en la materia sin necesidad de cargarlos uno por uno.
```

### 1.2 Configuración del Token de GitHub
Para habilitar la creación automática de repositorios y la inspección de entregas:
1. Dentro de la cátedra, dirígete a **Configuración de Cátedra**.
2. Completa los siguientes campos:
   - **Organización de GitHub (`github_org`)**: El nombre exacto de la organización de GitHub de la materia.
   - **Token de Acceso Personal (`github_token`)**: Un token de GitHub con permisos `repo`, `admin:org` y `read:user`.
3. Haz clic en **Guardar Configuración**.

---

## 2. Planificación del Cronograma y Clases

### 2.1 Carga de Instancias de Clase
El cronograma de clases permite definir las sesiones del cuatrimestre:
- **Número de Clase**: Índice correlativo de la sesión.
- **Fecha**: Día programado (formato `YYYY-MM-DD`).
- **Tema / Título**: Descripción de los temas a abordar.
- **Estado Especial**:
  - `Normal`: Clase presencial habitual.
  - `Clase Remota`: Sesión por videoconferencia.
  - `Examen`: Parcial o final (destacado en color violeta).
  - `Feriado`: Sin actividad (marcado con línea punteada roja).
- **Enlace de Grabación (`video_url`)**: Enlace directo al video grabado (YouTube, Drive, Vimeo).

### 2.2 Marcadores Temporales en Grabaciones (Bookmarks)
Para guiar a los estudiantes en la revisión de los videos grabados:
1. Haz clic en una clase que contenga un `video_url` cargado.
2. En el panel modal, desplázate a la sección **🔖 Marcadores Temporales**.
3. Ingresa el minuto/segundo (ej: `14:30`) y la etiqueta (ej: *Demostración del algoritmo de ordenamiento*).
4. Haz clic en **+ Agregar**. El marcador quedará guardado para todos los estudiantes de la cátedra.

---

## 3. Control de Asistencia mediante Código QR Dinámico y Geo-Fence

### 3.1 Generación de Código QR
1. Desde el cronograma de clases, haz clic en el botón **📷 Asistencia QR** de la clase del día.
2. La pantalla proyectará un código QR gigante acompañado por un código alfanumérico de 6 caracteres.

```{warning}
El código QR se regenera automáticamente cada **45 segundos**. Los alumnos deben escanear el código activo en pantalla.
```

### 3.2 Proximidad Geográfica (Geo-Fence / Haversine)
Si la ubicación GPS está habilitada:
- El servidor calcula la distancia física mediante la fórmula de Haversine entre las coordenadas GPS del docente y las del estudiante.
- Si el estudiante se encuentra a más de **150 metros** del aula, el registro será rechazado automáticamente por el servidor.

---

## 4. Gestión de Tareas y Calificaciones

### 4.1 Creación de Asignaciones (Trabajos Prácticos)
1. Ve a la pestaña **Tareas / Entregas** dentro de la cátedra.
2. Haz clic en **+ Crear Nueva Tarea**.
3. Define los siguientes parámetros:
   - **Título**: Nombre del trabajo práctico.
   - **Descripción / Consigna**: Explicación detallada.
   - **Fecha Límite (`due_date`)**: Fecha y hora tope para entregar a tiempo.
   - **Repositorio Template (`template_repo`)**: Opcional. Repositorio base de GitHub que se clonará automáticamente en la cuenta de cada alumno.

### 4.2 Inspección de Commits, Pull Requests y Comentarios
Al ingresar al detalle de la entrega de un estudiante:
- **Vista de Commits**: Gráfico interactivo con la lista de commits, autor, mensaje, fecha y rama (`main`, `dev`).
- **Pull Requests**: Estado de los PRs creados por el estudiante.
- **Comentarios en Código**: Lectura de los comentarios dejados en el repositorio de GitHub.

### 4.3 Calificación y Retroalimentación
1. Ingresa la calificación numérica o cualitativa en el campo **Nota**.
2. Escribe una devolución detallada en el campo **Feedback**.
3. Haz clic en **Guardar Calificación**. El estudiante recibirá una notificación en su panel.

---

## 5. Avisos a la Cátedra con Acuse de Recepción

1. En la pestaña **Avisos**, escribe el mensaje a transmitir a los estudiantes.
2. Haz clic en **Publicar Aviso**.
3. Podrás inspeccionar la lista de **Acuses de Recepción** en tiempo real para verificar exactamente qué alumnos leyeron la publicación y en qué fecha/hora.

---

## 6. Sincronización de Calendarios iCal (.ics)

1. Dirígete a la pestaña **Calendario**.
2. Selecciona la materia o el *🌐 Calendario Global*.
3. Haz clic en el botón **`📥 Exportar .ics`**.
4. El archivo descargado puede ser importado en Google Calendar, Apple Calendar o Microsoft Outlook para mantener sincronizadas las fechas de parciales y entregas.
