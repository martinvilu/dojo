# Plan de Trabajo - Implementación de Mejoras (Actualizado)

Este plan detalla el estado y la estrategia de desarrollo para la implementación de las mejoras prioritarias descritas en el roadmap de la plataforma Jutsu Classroom, habiendo completado satisfactoriamente todas las fases.

---

## 📅 Resumen de Implementación por Fases

```mermaid
gantt
    title Cronograma de Implementación de Mejoras (Completado)
    dateFormat  YYYY-MM-DD
    section Fase 1: Calidad y Frontend
    Refactorizar y modularizar dashboard/page.tsx :done, 2026-07-13, 1d
    section Fase 2: Funcionalidades
    Foro de Consultas por Clase (Q&A Markdown) :done, 2026-07-13, 1d
    Asistencia QR Dinámica con Geolocalización :done, 2026-07-13, 1d
    section Fase 3: Offline y UX
    Modo Claro/Oscuro Dinámico :done, 2026-07-13, 1d
    Persistencia Offline IndexedDB (Firestore) :done, 2026-07-13, 1d
    section Fase 4: Integraciones
    GitHub: Commits, PRs y Comentarios (Docente/Alumno) :done, 2026-07-13, 1d
```

---

## 🛠️ Detalle de Tareas Implementadas

### 📂 Fase 1: Modularización y Limpieza de Código (Completado)
*   **Tarea 1.1: Separación de Paneles por Rol**
    *   Se extrajo la vista de administración al componente [AdminPanel.tsx](file:///home/mrtin/dev/gaula/src/components/dashboard/AdminPanel.tsx).
    *   Se modularizó la inscripción del alumno en [StudentPanel.tsx](file:///home/mrtin/dev/gaula/src/components/dashboard/StudentPanel.tsx).
    *   Se modularizó el panel de perfil del usuario en [ProfilePanel.tsx](file:///home/mrtin/dev/gaula/src/components/dashboard/ProfilePanel.tsx).
    *   Se extrajo la lista de cursos asignados al docente a [TeacherPanel.tsx](file:///home/mrtin/dev/gaula/src/components/dashboard/TeacherPanel.tsx).
    *   Se integraron todos de forma limpia en el componente principal, reduciendo significativamente su complejidad.

### 💬 Fase 2: Interacción y Presentismo (Completado)
*   **Tarea 2.1: Foro / Q&A por Clase (Interacción Estudiante ↔ Profesor)**
    *   Implementación de foro en tiempo real (`onSnapshot`) a nivel de clase usando la subcolección `class_comments`.
    *   Soporte Markdown en la renderización de comentarios y consultas (con código fuente).
    *   **Mejora de Q&A**: Integración de reacciones emoji (👍, 🎉, ❤️) y Modo "Stack Overflow" permitiendo a los docentes marcar respuestas como Solución destacada.
*   **Tarea 2.2: Gestión de Asistencia / Presentismo QR**
    *   **Vista Docente**: Botón para generar código QR de asistencia en tiempo real con código alfanumérico de respaldo (6 caracteres) y geolocalización del docente. Incluye cronómetro de expiración de 5 minutos.
    *   **Vista Estudiante**: Botón interactivo "Firmar Presente QR" que solicita la ubicación GPS del dispositivo del estudiante y valida la proximidad con el profesor (límite de 150 metros) en el backend (Cloud Function).
*   **Tarea 2.3: Alertas Tempranas de Desempeño**
    *   Subpestaña **Alumnos y Alertas** que monitoriza el presentismo y tareas entregadas por estudiante en tiempo real, emitiendo avisos ante inasistencias acumuladas o entregas vencidas.
*   **Tarea 2.4: Integración con Google Sheets (Planilla Completa)**
    *   Botón para exportar la matriz completa de notas, asistencias, alertas tempranas y condición académica final a formato CSV compatible de forma nativa con Google Sheets y Excel.


### 🔌 Fase 3: UX y Resiliencia Offline (Completado)
*   **Tarea 3.1: Modo Claro/Oscuro Integrado**
    *   Diseño responsive con alternador de tema en la barra lateral, persistido a través de `localStorage` y controlado mediante variables CSS en [globals.css](file:///home/mrtin/dev/gaula/src/app/globals.css).
*   **Tarea 3.2: Modo Offline PWA (IndexedDB)**
    *   Se habilitó persistencia local robusta en Firebase mediante `enableIndexedDbPersistence` en [clientApp.ts](file:///home/mrtin/dev/gaula/src/lib/firebase/clientApp.ts), garantizando acceso sin conexión a clases e inscripciones.

### 🔗 Fase 4: Integración con GitHub (Completado)
*   **Tarea 4.1: Visualización de Actividad de Repositorios**
    *   **Backend**: Cloud Function `getStudentGithubActivity` unificada que recupera commits, pull requests y comentarios de código de forma autorizada tanto para estudiantes como para docentes/administradores.
    *   **Frontend**: Pestañas interactivas en la misma plataforma para visualizar:
        *   **Commits**: sha corto, mensaje del commit y fecha de subida.
        *   **Pull Requests**: número de PR, título del PR, estado de PR (open/closed/merged) con enlaces directos a GitHub.
        *   **Comentarios**: autor del comentario de código, contenido y fecha.
    *   **Calificación Inline**: Permite al docente calificar y escribir un feedback para el alumno directamente desde la misma interfaz interactiva de visualización de actividad.
    *   **Bitácora de Auditoría (Audit Logs)**: Las calificaciones hechas de forma inline guardan logs inmutables con diffs de los cambios (nota y comentario previo vs nuevo) legibles en una línea de tiempo en el panel del docente.

