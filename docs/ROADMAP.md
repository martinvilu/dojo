# Roadmap y Estado de Funcionalidades - Ninja Dojo

Este documento detalla el estado actual del sistema, la arquitectura modularizada, el roadmap de pruebas E2E/Unitarias y la planificación estratégica de mejoras a futuro para la plataforma **Jutsu Classroom / Ninja Dojo**.

---

## 📊 Estado del Sistema (Roadmap de Mejoras Completado)

### 1. Sistema de Diseño y Componentes Modularizados (UI/UX)
*   [x] **Design System Unificado (`src/components/dashboard/ui/`)**: Abstracción y estandarización de componentes reutilizables:
    *   `BaseModal.tsx`: Contenedor modal con portal DOM (`document.body`), escucha de tecla <kbd>Escape</kbd>, accesibilidad ARIA y dimensiones adaptativas (`min-w-[280px] sm:min-w-[480px]`).
    *   `AlertBadge.tsx`: Badges de alertas tempranas con contraste de alto impacto y dimensiones fijas (`min-w-[170px]`) para estados `critical`, `warning`, `success`, `info`.
    *   `ToastNotification.tsx`: Notificaciones emergentes unificadas con portales z-index elevadísimo (`z-[999999]`), animaciones fluidas y cierre manual/automático.
*   [x] **Navegación e Interfaz Contenida**: Modal y Toast containments para garantizar compatibilidad completa con viewports estrechos, dispositivos móviles e incrustaciones iFrame LTI.

### 2. Experiencia del Estudiante
*   [x] **Gamificación (Rango Ninja)**: Cálculo dinámico de XP (asistencia, tareas entregadas, promedio de calificaciones, participación en foros y mejores respuestas), niveles y medallas de honor de cursada (Maestro de Chakra, Asistencia Perfecta, Ninja Activo, Solucionador).
*   [x] **Foros y Preguntas y Respuestas por Clase (Q&A)**: Hilos de consulta en tiempo real por clase, reacciones emoji (👍, 🎉, ❤️) y Modo "Stack Overflow" (solución/respuesta correcta destacada por el docente).
*   [x] **Grupos de Cursada Auto-organizados**: Subpestaña "Grupos de Estudio" para la creación de grupos y emparejamiento inteligente de compañeros afines según su turno/disponibilidad horaria.
*   [x] **Módulo de Tutorías Académicas (Mentoría entre Pares)**: Subpestaña "Tutorías" para postularse como tutor, listar tutores de la cursada, reservar mentorías con sala de videoconferencia generada automáticamente en Google Meet.
*   [x] **Certificados Digitales de Alumno Regular y Examen Final**: Descarga e impresión directa en PDF de constancias de regularidad y actas de examen final con código de autenticidad.
*   [x] **Sincronización de Calendario (Exportación iCal/ICS)**: Endpoint nativo `/api/calendar` y exportación instantánea del cronograma dinámico de clases y entregas a Google Calendar, Apple Calendar y Outlook mediante archivos `.ics` e iCal feeds.
*   [x] **Marcadores Temporales en Grabaciones (Bookmarks)**: Sistema de etiquetado por timestamps en grabaciones de video para acceder instantáneamente a explicaciones clave.
*   [ ] **Buscador Rápido Inteligente (Command + K)**: Barra de búsqueda omni-buscadora (Spotlight Search) accesible desde teclado para buscar temas de clases, avisos o entregas.
*   [ ] **Portafolio de Proyectos Públicos**: Configuración opcional de entregas de GitHub como públicas en el perfil del estudiante.

### 3. Experiencia Docente
*   [x] **Registro de Asistencia mediante QR Dinámico**: Generación de token alfanumérico temporal (6 caracteres) con geolocalización de docente y validación de proximidad GPS (< 150m) en el backend (Cloud Function).
*   [x] **Calificación y Registro de Notas Numéricas**: Modal interactivo para que los docentes registren calificaciones del 1 al 10 con notificaciones instantáneas.
*   [x] **Exportación de Reportes Académicos PDF**: Generación en 1 clic de reportes consolidados de cursada optimizados para impresión/PDF.
*   [x] **Integración Bidireccional con Hojas de Cálculo (Sheets/Excel)**: Exportación en 1 clic a endpoints CSV nativos (`exportGradesCsv` y `exportAttendanceCsv`) dentro de secciones desplegables.
*   [x] **Alertas Tempranas de Desempeño**: Panel "Alumnos y Alertas" con cálculo en tiempo real de regularidad (<75%) y tareas atrasadas.
*   [x] **Espacio de Co-Docencia Coordinada**: Gestión de comisiones de estudiantes y vinculación de docentes responsables por comisión con filtros multi-vista.
*   [x] **Tablero Kanban para Planificación Curricular**: Vista interactiva drag & drop para reorganizar cronogramas entre Teóricas, Prácticas, Feriados y Exámenes.
*   [x] **Módulo de Encuestas Estudiantiles Anónimas (Class Feedback)**: Valoración anónima (1-5 estrellas), nivel de comprensión y comentarios.
*   [ ] **Editor de Texto Enriquecido (Rich Text)**: Reemplazo de campos de texto plano en avisos y tareas por editor WYSIWYG.
*   [ ] **Corrección Automática de Código**: Integración con GitHub Actions para ejecución automatizada de tests unitarios en entregas.

### 4. Infraestructura, Calidad y Pruebas
*   [x] **Suite Unificada E2E Selenium WebDriver (56 Escenarios Automatizados)**: Batería completa en 14 módulos que cubre las funcionalidades del usuario en los 4 roles (**Estudiante**, **Tutor**, **Docente**, **Administrador**):
    *   `design-system.test.js`: Pruebas de Modales, Badges de Alerta y Toast notifications.
    *   `login.test.js`, `modals.test.js`, `dashboard.test.js`, `attendance.test.js`, `features.test.js`, `student.test.js`, `teacher.test.js`, `tutor.test.js`, `admin.test.js`, `roles.test.js`, `moodle.test.js`, `calendar.test.js`, `toast.test.js`.
*   [x] **Suite de Backend Jest (74 Pruebas Unitarias)**: Cobertura total de endpoints REST, triggers Firebase y lógica de negocio en `functions/`.
*   [x] **Endpoint iCal / ICS `/api/calendar`**: App Router API route (`src/app/api/calendar/route.ts`) con soporte iCal VCALENDAR y respuestas JSON.
*   [x] **Integración LTI 1.3 con Moodle (4.2+)**: Endpoints `/api/lti/launch` y `/api/lti/jwks` con módulo generador de respaldos MBZ/XML.
*   [x] **Bitácora de Auditoría de Notas y VCS de Cronograma**: Registro histórico inmutable de calificaciones y control de versiones de planificación con visor de diff.

---

## 🏗️ Propuesta de Mejoras Estructurales y Arquitectura

### 🏛️ 1. Desacoplamiento de Lógica con Custom Hooks (`src/hooks/`)
Actualmente, partes de la lógica de estado y llamadas a la API se encuentran en los componentes principales. Se propone estructurar el código en Custom Hooks especializados:
*   `useAttendance.ts`: Lógica de firma de presente por QR, generación de tokens y consulta de historial.
*   `useCalendarEvents.ts`: Filtrado de cronograma, exportación `.ics` y suscripción a Google Calendar.
*   `useTutorMentorship.ts`: Gestión de solicitudes de tutoría, perfil de materias y videoconferencias.

### ⚡ 2. Optimización de Carga y Carga Diferida (`next/dynamic`)
Para reducir el tamaño del paquete JavaScript inicial en clientes con conexiones lentas:
*   Implementar `dynamic()` imports en paneles pesados del Dashboard (`MoodleIntegrationPanel`, `EmailManagementPanel`, `CalendarPanel`).

### 🔒 3. Middleware Unificado de Autenticación y Autorización (`src/app/api/middleware/`)
*   Crear un wrapper middleware para los endpoints del App Router (`/api/calendar`, `/api/csv-export`, `/api/lti/launch`) que valide tokens Bearer de Firebase Auth y sanitice entradas en un solo punto.

### 🤖 4. Pipeline de Integración Continua (CI/CD)
*   Configurar un workflow de GitHub Actions (`.github/workflows/e2e-tests.yml`) para ejecutar automáticamente headless Chrome Selenium tests y pruebas Jest en cada Pull Request.

---

## 💡 Funcionalidades Potenciales Futuras (Próxima Fase)

### 🤖 Inteligencia Artificial & Asistencia Pedagógica
1. **Asistente Pedagógico de Corrección por IA**: Sugerencia automática de notas y comentarios analizando diffs de código con soluciones modelo (Gemini API).
2. **Generador Automático de Cuestionarios**: Creación instantánea de evaluaciones rápidas adaptadas al temario de cada clase.
3. **Resúmenes Automáticos de Clases Grabadas**: Transcripción y síntesis inteligente con marcadores temporales automáticos.

### 📈 Analítica Avanzada & Gestión Institucional
4. **Matriz de Competencias y Progreso Académico**: Tablero del mapa de habilidades teóricas y prácticas adquiridas.
5. **Predicción de Abandono Escolar con Machine Learning**: Detección de patrones tempranos de deserción combinando entregas, asistencias e interacción.
6. **Tablero de Métricas de Rendimiento en GitHub**: Gráficos de frecuencia de commits, horarios de mayor productividad y cambios por alumno.

### 🤝 Colaboración & Aprendizaje Experiencial
7. **Simulador de Code Reviews en Equipo**: Flujo donde los estudiantes revisan y comentan Pull Requests de sus compañeros.
8. **Salas de Estudio Virtuales con Pizarra Interactiva (Whiteboard)**: Espacio síncrono integrado con dibujo vectorial y chat.
9. **Desafíos Semanales de Código (Coding League)**: Desafíos cortos semanales estilo LeetCode que otorgan XP adicional.
