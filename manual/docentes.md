# Manual del Docente

Este manual detalla cada una de las funcionalidades disponibles para los **Docentes** y **Administradores** en Jutsu Classroom.

```{note}
Para acceder al panel docente, la cuenta debe poseer el rol `teacher` o `admin` y estar previamente aprobada por la administración.
```

---

## 1. Gestión de Cátedras y Configuración

### Creación y Selección de Cátedras
El docente puede administrar múltiples cátedras desde el panel izquierdo. Al seleccionar una cátedra, se habilitan las pestañas específicas de planificación, entregas y estudiantes.

```{tip}
Cada cátedra genera un **Código de Invitación único** para que los estudiantes se inscriban de forma autónoma sin intervención manual.
```

### Configuración de GitHub
- **Organización de GitHub (`github_org`)**: Especifica la organización donde se crearán los repositorios de entregas.
- **Token de Acceso Personal (`github_token`)**: Necesario para crear repositorios, asignar permisos y leer commits y Pull Requests.

---

## 2. Planificación y Cronograma de Clases

### Carga de Instancias de Clase
Los docentes pueden estructurar el cronograma definiendo cada clase con:
- **Número de Clase**: Índice secuencial.
- **Fecha y Hora**: Día programado.
- **Estado Especial**: `Normal`, `Clase Remota`, `Examen`, `Feriado`.
- **Enlace a Grabación (`video_url`)**: Enlace al video grabado de la sesión.

### Marcadores Temporales en Grabaciones (Bookmarks)
Los docentes y auxiliares pueden etiquetar momentos clave dentro de las grabaciones de las clases (ejemplo: `08:15 - Introducción al algoritmo`).

```{important}
Los marcadores temporales permiten a los estudiantes saltar directamente a la explicación teórica o demostración práctica sin revisar el video completo.
```

---

## 3. Registro de Asistencia mediante Código QR y Geo-Fence

### Generación de Código QR Dinámico
1. Desde el detalle de la clase, el docente hace clic en **"Generar Código QR de Asistencia"**.
2. Se muestra un código QR dinámico y un código alfanumérico que cambia automáticamente cada **45 segundos**.

```{warning}
La asistencia requiere que los estudiantes se encuentren dentro del rango geográfico permitido (máximo 150 metros del aula) si la geolocalización está activa.
```

---

## 4. Gestión de Tareas y Calificaciones

### Creación de Entregas
- **Título y Descripción**: Detalles del trabajo práctico.
- **Fecha Límite (`due_date`)**: Límite estricto para entregas a tiempo.
- **Repositorio Template (`template_repo`)**: Repositorio base que se clonará para cada estudiante.

### Seguimiento de Commits y Pull Requests
El docente puede visualizar en tiempo real:
- Total de commits enviados por el estudiante.
- Pull Requests abiertos y cerrados.
- Comentarios en el código y rama de trabajo (`main`, `dev`, etc.).

---

## 5. Exportación e Integración de Calendario (iCal)

Docentes y estudiantes pueden sincronizar el cronograma con clientes externos (Google Calendar, Outlook, Apple Calendar) haciendo clic en **"Exportar .ics"** dentro del panel del calendario.
