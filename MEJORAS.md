# Registro de Mejoras e Innovaciones - Jutsu Classroom / Ninja Dojo

Este documento rastrea el estado de ejecución de las mejoras planeadas, las innovaciones arquitectónicas implementadas y las propuestas de evolución del sistema.

---

## 📊 Estado de Ejecución de Mejoras

### 1. Experiencia del Estudiante
*   [x] **Gamificación (Rango Ninja)**: Puntos XP dinámicos (asistencia, tareas entregadas, promedio de calificaciones, participación en foros y respuestas correctas), niveles y medallas de honor de cursada (Maestro de Chakra, Asistencia Perfecta, Ninja Activo, Solucionador).
*   [x] **Módulo de Tutorías Académicas (Mentoría entre Pares)**: Conexión entre alumnos avanzados (tutores) y estudiantes que requieren ayuda, con reserva de horarios de mentoría y videollamadas automáticas en Google Meet.
*   [x] **Grupos de Cursada Auto-organizados**: Herramienta de emparejamiento inteligente para crear grupos de estudio y resolver dudas con compañeros de horarios afines.
*   [x] **Foros y Preguntas y Respuestas (Q&A)**: Hilos de discusión por clase con reacciones emoji (👍, 🎉, ❤️) y Modo "Stack Overflow" en donde el docente destaca la respuesta correcta.
*   [x] **Certificados Digitales Verificables**: Módulo de emisión y descarga PDF de constancias de alumno regular y actas de examen final con folio/libro.
*   [x] **Sincronización de Calendario iCal/ICS**: Exportación del cronograma a Google Calendar, Apple Calendar y Outlook mediante archivos `.ics` y feed HTTP `/api/calendar`.

### 2. Experiencia Docente
*   [x] **Registro de Asistencia mediante QR Dinámico**: Código QR/Token alfanumérico dinámico de 6 caracteres con validación de proximidad GPS (< 150m) en el backend (Cloud Function).
*   [x] **Integración Bidireccional con Hojas de Cálculo (Sheets/Excel)**: Exportación en 1 clic de notas y asistencia a endpoints CSV nativos (`exportGradesCsv` y `exportAttendanceCsv`) integrados en secciones desplegables.
*   [x] **Calificación y Registro de Notas Numéricas**: Modal de calificación directa (1 a 10) con retroalimentación instantánea al estudiante.
*   [x] **Exportación de Reportes Académicos PDF**: Generación de reportes consolidados de cursada listos para imprimir o guardar como PDF.
*   [x] **Alertas Tempranas de Desempeño**: Sistema automático que identifica a estudiantes con asistencias críticas (<75%) o tareas atrasadas, notificando de manera proactiva.
*   [x] **Espacio de Co-Docencia Coordinada**: Gestión de comisiones de estudiantes y vinculación de docentes responsables por comisión con filtros multi-vista.
*   [x] **Tablero Kanban para Planificación Curricular**: Vista interactiva drag & drop para reorganizar clases entre Teóricas, Prácticas, Feriados y Exámenes.
*   [x] **Módulo de Encuestas Estudiantiles Anónimas**: Sondeos anónimos rápidos (1-5 estrellas) sobre la marcha de las clases para ajustar la metodología pedagógica.
*   [x] **Dashboard Docente Centralizado**: Panel unificado con cola de correcciones, consultas pendientes y estudiantes en riesgo académico.

### 3. Infraestructura, Calidad y Plataforma
*   [x] **Sistema de Diseño UI Modularizado (`src/components/dashboard/ui/`)**:
    *   `BaseModal.tsx`: Contenedor modal accesible con portal DOM, backdrop blur `z-[99999]`, tecla <kbd>Escape</kbd> y ancho adaptable (`min-w-[280px] sm:min-w-[480px]`).
    *   `AlertBadge.tsx`: Badges de alerta de alto contraste (`critical`, `warning`, `success`, `info`) con dimensiones mínimas fijas (`min-w-[170px]`).
    *   `ToastNotification.tsx`: Notificaciones emergentes con portal DOM elevadísimo (`z-[999999]`) y descarte automático o manual `✕`.
*   [x] **Suite de Pruebas Selenium E2E Unificada (54 Pruebas Automatizadas)**: Cobertura del 100% de funcionalidades y roles (**Estudiante**, **Tutor**, **Docente**, **Administrador**) en 14 módulos de prueba.
*   [x] **Endpoint HTTP `/api/calendar`**: API route en Next.js App Router para servir feeds RFC 5545 iCalendar VCALENDAR y respuestas JSON.
*   [x] **Integración LTI 1.3 con Moodle 4.2+ & Respaldos MBZ**: Endpoints `/api/lti/launch`, `/api/lti/jwks` y generador nativo de paquetes de respaldo XML / MBZ.
*   [x] **Paginación y Caché IndexedDB en Firestore**: Estrategias de limitación de lecturas y soporte offline completo.
*   [x] **Modo Oscuro Integrado**: Temas dinámicos Claro/Oscuro controlados por variables semánticas CSS y localStorage.
*   [x] **Bitácora de Auditoría de Notas (Audit Logs)**: Registro histórico inmutable de calificaciones con detalle de usuario, fecha y diffs.
*   [x] **Control de Versiones de Cronograma (VCS)**: Historial visual de versiones de planificación con herramientas para restaurar cambios o comparar variaciones.
*   [x] **Backups Incrementales y Recuperación Granular**: Respaldos continuos en la nube para restaurar elementos individuales en 1 clic.
*   [x] **Compresión Multimedia en Background**: Optimizador de recursos didácticos para acelerar el acceso con datos móviles.

---

## 🏗️ Propuesta de Mejoras Estructurales Recomendadas

1. **Custom Hooks para Desacoplamiento de Estado (`src/hooks/`)**:
   * Abstraer la lógica de estado de presentismo (`useAttendance.ts`), calendario (`useCalendarEvents.ts`) y mentorías (`useTutorMentorship.ts`) fuera de los componentes de vista.
2. **Dynamic Imports (`next/dynamic`)**:
   * Aplicar carga diferida en módulos de dashboard voluminosos (`MoodleIntegrationPanel`, `CalendarPanel`, `EmailManagementPanel`) para reducir el payload JavaScript inicial.
3. **Middleware de API Centralizado (`src/app/api/middleware/`)**:
   * Implementar validación de tokens de Firebase Auth, sanitización de entrada y manejo de CORS unificado para los handlers de `/api/`.
4. **Pipeline CI/CD Automatizado (`.github/workflows/e2e-tests.yml`)**:
   * Ejecución headless automática de las 54 pruebas Selenium y 74 pruebas Jest en cada Pull Request.
