# Estado de Tareas - Ninja Dojo

Este documento detalla explícitamente las tareas completadas, en curso y pendientes en el proyecto, sirviendo como registro histórico y planificador de actividades.

---

## 1. Tareas Completadas (Entregadas en `main`)

### 🌳 Git & VCS
- [x] **Visualizador del Flujo de Trabajo Git (Git Commits Visualizer)**:
  - Renderizado de gráfico de ramas (`main`, `dev`, `feature/alerts`) mediante nodos interconectados verticalmente en la línea de tiempo.
  - Gráfico estadístico de barras (distribución de trabajo) que calcula y muestra el aporte porcentual de commits de cada participante.
  - Integrado tanto en la vista del estudiante como en la revisión del docente.
- [x] **Control de Versiones de Cronograma (VCS)**:
  - Historial y guardado manual/automático de versiones del cronograma de clases.
  - Visor interactivo de diferencias (diff) y restauración rápida en caliente.

### 🔌 Integración con Moodle (4.2+)
- [x] **Arquitectura de URIs REST Dedicadas**:
  - Rutas dinámicas unificadas: `/dashboard/activities/[id]`, `/dashboard/courses/[id]` y `/dashboard/users/[id]`.
- [x] **Manejador de Lanzamiento LTI 1.3**:
  - Endpoint `/api/lti/launch` (POST) para procesar tokens firmados de Moodle, extraer datos de usuario y redireccionar al recurso correspondiente.
- [x] **Exposición de Keyset JWKS**:
  - Endpoint `/api/lti/jwks` (GET) para firma de tokens y seguridad de la herramienta externa.
- [x] **Matrícula / Auto-Inscripción del Estudiante**:
  - Acción `moodleAutoEnroll` para inscribir al usuario LTI directamente en la cátedra en su primer acceso.
- [x] **Vinculación Proactiva de GitHub**:
  - Modal/interrogante interactivo para enlazar el usuario de GitHub si el estudiante auto-matriculado no posee uno asociado en su perfil.
- [x] **Sincronización Automática de Calificaciones (AGS)**:
  - Envío automático de notas normalizadas (escala decimal) al Gradebook de Moodle tras calificar desde Ninja Dojo.
  - Logs históricos guardados en `audit_logs` con la respuesta del servidor de Moodle.
- [x] **Integración Completamente Opcional**:
  - Switch de activación "Integración con Moodle" en Ajustes de Cátedra de Profesores. Validación en backend para omitir la sincronización si no está habilitada.

### 🎨 Experiencia de Usuario & UI/UX
- [x] **Sistema Toast de Notificaciones Flotantes**:
  - Interceptor global de `window.alert` en el Dashboard para capturar popups nativos y transformarlos en toasts flotantes dinámicos, no intrusivos y autocerrables.
- [x] **Temas Claro y Oscuro**:
  - Control de tema mediante variables CSS y persistencia en `localStorage`.

### 🚀 Infraestructura, CI/CD & Calidad
- [x] **Deploy Resiliente en GitHub Actions**:
  - Ajuste en `.github/workflows/firebase-deploy.yml` para soportar fallbacks de secrets (`FIREBASE_SERVICE_ACCOUNT` y `FIREBASE_TOKEN`).
- [x] **Corrección del Error de Prerenderizado**:
  - Clave de fallback `AIzaSyFakeKeyForBuildPrerendering_NoCrash` en `clientApp.ts` para evitar fallos de inicialización de Firebase durante `next build`.
- [x] **Cobertura de Pruebas**:
  - Pruebas unitarias de Jest creadas para `moodleAutoEnroll`. 41/41 pruebas pasando exitosamente en la suite general del backend.

---

- [x] **M1: Refactorizar Componentes de GitHub en Cliente**:
  - Extraer `CommitVisualizer.tsx` y `GithubActivityPanel.tsx` de `page.tsx` hacia `/src/components/dashboard/github/`.
- [x] **M2: Aislación de Módulos (ToastNotification)**:
  - Extracción y modularización del sistema de toasts flotantes en `ToastNotification.tsx`.
- [x] **Moodle Calendar Sync**:
  - Exposición de la URL de exportación de cronograma (.ics) en la UI de Ajustes de Cátedra para que Moodle se suscriba automáticamente.

- [x] **M3: Aislación de Módulos (TutoringPanel)**:
  - Extracción del módulo de tutorías académicas entre pares, reservas de mentorías y sus modales en `TutoringPanel.tsx`.
- [x] **M4: Aislación de Módulos de Asistencia y Consultas**:
  - Mover `AttendanceManager.tsx` (asistencia y QR) e `Hilos de Consultas` (`ClassCommentsThread.tsx`) a componentes independientes.
- [x] **M5: Desmonolitizar Functions Backend**:
  - Dividir `functions/index.js` en submódulos de acciones independientes cargadas de forma dinámica en `/functions/actions/`.

---

## 2. Tareas por Completar (Pendientes / Futuras)

### 🛡️ Funcionalidades Futuras
- [ ] **Detección de Plagio y Copias**:
  - Analizador de código estático por similitud estructural de AST para alertar posibles copias entre repositorios de alumnos.
- [ ] **Autograding Integrado**:
  - Vinculación con GitHub Actions para correr pruebas unitarias y sincronizar el porcentaje de aprobación de tests directo a la nota del alumno.
