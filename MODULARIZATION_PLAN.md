# Plan de Modularización Implacable

Este documento describe la estrategia de reorganización para el proyecto Ninja Dojo (Jutsu Classroom), dividiendo el sistema en módulos independientes y altamente cohesivos. 
El objetivo es migrar la lógica y los componentes desde archivos monolíticos (como `src/app/dashboard/page.tsx` y `functions/index.js`) hacia sus respectivos módulos funcionales.

## Estructura de Módulos (Frontend: `src/modules/`, Backend: `functions/src/modules/`)

### 1. Módulo Autenticación (`auth`)
**Responsabilidad:** Autenticación de usuarios por email, OAuth con Google y GitHub, y gestión de sesión.
* **Frontend:**
  * Componentes de Login/Registro.
  * Contextos o Hooks para la sesión del usuario.
* **Backend:**
  * Triggers de creación/eliminación de usuarios (`auth.onCreate`, `auth.onDelete` si aplican).

### 2. Módulo Correo (`mail`)
**Responsabilidad:** Envío de correos electrónicos, programación de envío, autenticación OAuth para Gmail, plantillas de correo.
* **Frontend:**
  * Componentes: `EmailManagementPanel.tsx`, `DirectEmailModal.tsx`.
* **Backend:**
  * Archivos a migrar: `emailTemplates.js`, `gmailAuth.js`, `scheduledEmails.js`, `notifications.js` (lo relacionado a email).
  * Lógica de OAuth con Google Workspace/Gmail.

### 3. Módulo GitHub (`github`)
**Responsabilidad:** Integración con GitHub, creación de prácticas/tareas (assignments) basadas en plantillas, y obtención de información de repositorios (commits, PRs).
* **Frontend:**
  * Carpeta `src/components/dashboard/github`.
  * Integraciones para vincular cuentas de GitHub.
* **Backend:**
  * Lógica relacionada con llamadas a la API de GitHub, webhooks.

### 4. Módulo Cátedra (`course`)
**Responsabilidad:** Planificación de materias, cronograma, asignación de docentes y ayudantes, métricas generales de cursada.
* **Frontend:**
  * Componentes de gestión de cátedra: `TeacherPanel.tsx`, `AdminPanel.tsx` (lo relacionado a cursos).
* **Backend:**
  * Archivos a migrar: `courses.js`, `admin.js`, `stats.js`, `schedule.js`.

### 5. Módulo Calendario (`calendar`)
**Responsabilidad:** Visualización interactiva del cronograma, publicación de eventos y generación/obtención de eventos en formato ICS (iCalendar).
* **Frontend:**
  * Carpeta `src/components/dashboard/calendar`.
* **Backend:**
  * Rutas API: `src/app/api/calendar` (o delegación en funciones).

### 6. Módulo Tutorías (`tutoring`)
**Responsabilidad:** Gestión de la bolsa de tutores, solicitudes de tutoría, aceptación/rechazo y reprogramación.
* **Frontend:**
  * Carpeta `src/components/dashboard/tutoring`.
* **Backend:**
  * Archivo a migrar: `tutoring.js`.

### 7. Módulo Grupos de Estudio (`study_groups`)
**Responsabilidad:** Creación, unión y gestión de grupos de estudio entre pares.
* **Frontend:**
  * Componentes específicos para grupos de estudio (actualmente en StudentPanel u otros).
* **Backend:**
  * Archivo a migrar: `studyGroups.js`.

---

## Estrategia de Ejecución Continua
Se realizarán commits incrementales módulo por módulo, sin hacer push inmediato. Cada commit incluirá:
1. Creación de la estructura del módulo (`src/modules/[module]`).
2. Movimiento de componentes frontend y refactorización de importaciones.
3. Movimiento de lógica backend y refactorización de `functions/index.js` y `functions/actions`.
4. Pruebas y validación para garantizar que no se rompe la funcionalidad (usando tests).
