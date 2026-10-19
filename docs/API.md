# Referencia de API — Ninja Dojo

Contratos de las interfaces programáticas de la plataforma. Para el modelo de seguridad completo ver [ARCHITECTURE.md §2](ARCHITECTURE.md); para el estado y los pendientes, [ROADMAP.md](ROADMAP.md).

La plataforma expone tres superficies:

1. **Callable `api`** (Cloud Functions v2): la usa la app web para todas las operaciones privilegiadas.
2. **Rutas HTTP de App Router** (`src/app/api/`): integraciones externas (iCal, planillas, Moodle/LTI, CLI, monitoreo).
3. **Funciones HTTP y programadas** (`functions/index.js`): webhook de autograding, importación de notas y resumen diario.

---

## 1. Callable `api`

### 1.1. Invocación

```ts
import { api } from "@/lib/api";

const courses = await api("getStudentCourses");
await api("gradeSubmission", { submissionId, grade: "8,5", feedback: "Bien" });
```

`api(action, payload)` llama a `httpsCallable(functions, "api")` con `{ action, payload }`. El dispatcher (`functions/index.js`):

1. Rechaza llamadas sin sesión (`unauthenticated`).
2. Busca la acción en `functions/src/actions.js`. Si no existe, responde `invalid-argument: Acción desconocida`.
3. Carga el perfil del llamador y aplica la **política de acceso** declarada en `functions/src/authz.js`. Una acción sin política se rechaza (`permission-denied`, fail closed).
4. Ejecuta el handler con el SDK admin y registra la llamada en la bitácora, redactando las claves que parecen secretos (`token`, `secret`, `password`, `api_key`, `sourcedid`).

Los errores no controlados de un handler llegan al cliente como `internal` con el mensaje original.

### 1.2. Políticas de acceso

| Política | Quién pasa |
|---|---|
| `AUTHENTICATED` | Cualquier usuario logueado. El handler opera sobre su propio `uid` y hace sus propios chequeos |
| `STAFF` | Rol `teacher` o `admin` |
| `ADMIN` | Rol `admin` |
| `staffOf(objetivo)` | Docente asignado (titular o ayudante) al curso del objetivo, o `admin` |
| `memberOf(objetivo)` | Docente o estudiante inscripto en el curso del objetivo, o `admin` |
| `withScopedCourseIds(...)` | Además de la política base, filtra `payload.courseIds` a los cursos accesibles en lugar de rechazar la llamada |

El curso de cada objetivo se resuelve así:

| Objetivo | Campo del payload | Curso |
|---|---|---|
| `course` | `courseId` (o `course_id`, `course`) | El indicado |
| `newCourse` | `newCourseId` | El indicado (curso destino de una clonación) |
| `assignment` | `assignmentId` | `course_id` de la tarea |
| `submission` | `submissionId` | Curso de la tarea de la entrega |
| `announcement` | `announcementId` | `course_id` del aviso |
| `scheduledEmail` | `emailId` | `course_id` del correo programado |
| `studyGroup` | `groupId` | `course_id` del grupo |

La membresía se valida con los IDs predecibles `course_teachers/{courseId}_{uid}` y `enrollments/{uid}_{courseId}`, los mismos que usan las reglas de Firestore.

### 1.3. Catálogo de acciones

**Perfil propio** (`functions/src/modules/auth/profile.js`)

| Acción | Política | Descripción |
|---|---|---|
| `getProfile` | AUTHENTICATED | Devuelve el perfil y lo crea en el primer login (rol `student`, estado `pending`, salvo los emails de `SEED_ADMIN_EMAILS` / `SEED_TEACHER_EMAILS`) |
| `updateProfile` | AUTHENTICATED | Nombre, usuario de GitHub, matrícula y cohorte propios |
| `submitMatricula` | AUTHENTICATED | Valida `UNRN-` + ≥5 dígitos y aprueba la cuenta |
| `addSecondaryEmail` | AUTHENTICATED | Vincula un correo adicional |
| `getXpLogs` | AUTHENTICATED | Bitácora de XP propia |
| `mergeProfiles` | ADMIN | Fusiona dos perfiles duplicados |

**Administración** (`modules/course/admin.js`, `modules/system/*`)

| Acción | Política | Descripción |
|---|---|---|
| `getAdminUsers`, `getAdminCourses`, `getAdminCourseDetails` | ADMIN | Listados globales |
| `approveUser`, `updateUserRole`, `updateUserProfile` | ADMIN | Gestión de cuentas |
| `deleteUser` | ADMIN | Borra Auth, perfil, inscripciones y asignaciones docentes |
| `getGlobalSettings` | AUTHENTICATED | Configuración global (p. ej., calendario ICS institucional) |
| `saveGlobalSettings` | ADMIN | Guarda la configuración global |
| `logActivity` | AUTHENTICATED | Registra un evento de actividad propio |
| `getActivityLogs` | ADMIN | Bitácora de actividad |
| `createSystemBackup`, `getSystemBackups`, `downloadSystemBackup`, `restoreBackupDocument`, `deleteBackup` | ADMIN | Respaldos y restauración granular |

**Cursos** (`modules/course/courses.js`)

| Acción | Política | Descripción |
|---|---|---|
| `createCourse`, `deleteCourse` | ADMIN | Alta y baja de cátedras |
| `assignTeacher`, `removeTeacher` | ADMIN | Equipo docente |
| `getCourseDetails`, `getCourseTeachers`, `getCourseRoster` | memberOf(course) | Los estudiantes reciben una proyección sin `sync_secret`, credenciales ni códigos de invitación docentes |
| `getStudentCourses` | AUTHENTICATED | Cursos del llamador |
| `getTeacherCourses` | STAFF | Cursos asignados (todos si es admin) |
| `enrollCourse` | AUTHENTICATED | Canjea un código: el de estudiante crea una inscripción `pending`; `T-…` / `A-…` asignan titular o ayudante y promueven a `teacher` |
| `updateCourseName`, `getCourseSettings`, `updateCourseSettings` | staffOf(course) | Ajustes; los ayudantes no pueden modificar la planificación base. Guardar `class_instances` crea una versión automática del cronograma |
| `cloneCourseExtraData` | staffOf(course, newCourse) | Copia ajustes de otra cátedra |
| `updateRosterStudentStatus`, `syncGuaraniRoster` | staffOf(course) | Estado de inscripciones / importación de roster |

**Cronograma** (`modules/course/schedule.js`): `saveScheduleVersion`, `getScheduleVersions`, `restoreScheduleVersion` — staffOf(course); `getComparisonCourses` — STAFF.

**Avisos** (`modules/course/announcements.js`)

| Acción | Política |
|---|---|
| `createAnnouncement` | staffOf(course) |
| `getTeacherAnnouncements` | STAFF |
| `getStudentAnnouncements` | AUTHENTICATED + courseIds de miembro |
| `acknowledgeAnnouncement` | memberOf(announcement) |
| `getAnnouncementAcknowledgements` | staffOf(announcement) |

**Tareas y entregas** (`modules/github/assignments.js`, `peerreview.js`, `plagiarism/`, `modules/course/portfolio.js`)

| Acción | Política | Descripción |
|---|---|---|
| `createAssignment`, `updateAssignment` | staffOf(course) / staffOf(assignment) | Campos validados: `title`, `description`, `due_date`, `template_repo` (`org/repo`), `is_group`, `create_feedback_pr` |
| `archiveAssignment` | staffOf(assignment) | Pasa la tarea a solo lectura |
| `getTeacherAssignments` | STAFF + courseIds de staff | |
| `getAssignmentSubmissions` | staffOf(assignment) | |
| `gradeSubmission` | staffOf(submission) | Nota 0–10 (coma o punto decimal) o conceptual de letras (`Aprobado`); feedback ≤ 5000 caracteres; queda en historial inmutable |
| `toggleAccess` / `massToggleAccess` | staffOf(submission) / staffOf(assignment) | Marca una entrega (o todas las de la tarea) como bloqueada (`is_locked`) |
| `syncGradesFromSpreadsheet` | staffOf(assignment) | Importa notas desde la URL de una planilla de Google Sheets |
| `getStudentAssignments` | AUTHENTICATED + courseIds de miembro | |
| `acceptAssignment` | memberOf(assignment) | Crea el repositorio del estudiante desde la plantilla |
| `submitAssignment` | AUTHENTICATED | Marca la entrega como presentada (el handler verifica la autoría) |
| `addGroupCollaborator` | memberOf(submission) | Solo el autor de la entrega o el equipo docente |
| `getStudentGithubActivity`, `getStudentCommits` | AUTHENTICATED | Commits, PRs y comentarios del repositorio |
| `detectAssignmentPlagiarism` | staffOf(assignment) | Similitud por fingerprints k-gram entre entregas |
| `enablePeerReview` | staffOf(assignment) | Activa la revisión entre pares |
| `getMyReviewAssignments` | memberOf(course) | Entregas que me tocan revisar (2 por revisor, rotación determinística) |
| `submitPeerReview` | memberOf(assignment) | |
| `getPeerReviewFeedback` | AUTHENTICATED | Feedback agregado y anónimo de mi entrega |
| `setSubmissionPortfolioVisibility`, `getMyPortfolio` | AUTHENTICATED | Portafolio público `/p/{uid}` |

**Asistencia** (`modules/attendance/attendance.js`)

| Acción | Política | Descripción |
|---|---|---|
| `submitQrAttendance` | AUTHENTICATED | Valida el token QR activo del curso (≤ 45 s) y, si el QR tiene ubicación, la distancia Haversine (≤ 150 m). Suma 10 XP |
| `markAttendance` | AUTHENTICATED | Presente propio en una clase de un curso en el que el llamador está inscripto |

**Analítica y notificaciones** (`modules/course/stats.js`, `analytics.js`, `modules/notifications/`)

| Acción | Política |
|---|---|
| `getTeacherDashboardStats` | STAFF |
| `getCourseDashboardStats`, `getDropoutRiskAnalysis`, `notifyCourseStudents`, `checkAndAlertStudentsAtRisk` | staffOf(course) |
| `getStudentNotifications`, `markNotificationsRead` | AUTHENTICATED |

`getDropoutRiskAnalysis` calcula un puntaje 0–100: inasistencia 45 %, tareas pendientes 35 %, entregas tardías 10 % y sin participación en el foro 10 %.

**Correo** (`modules/mail/*`)

| Acción | Política |
|---|---|
| `getGmailAuthUrl`, `saveGmailAuthCode`, `getGmailAuthStatus`, `disconnectGmailAuth`, `sendGmailNotification` | STAFF |
| `getEmailTemplates`, `saveEmailTemplate`, `getScheduledEmails`, `createScheduledEmail`, `sendDirectStudentEmail`, `getMailLogs` | staffOf(course) |
| `cancelScheduledEmail` | staffOf(scheduledEmail) |
| `triggerScheduledEmailNow` | staffOf(course, scheduledEmail) |

**Colaboración** (`modules/study_groups/`, `modules/tutoring/`)

| Acción | Política |
|---|---|
| `createStudyGroup`, `getStudyGroups`, `findStudyBuddies` | memberOf(course) |
| `joinStudyGroup`, `leaveStudyGroup`, `updateStudyGroupChatLinks`, `postStudyGroupMessage`, `getStudyGroupMessages` | memberOf(studyGroup) |
| `registerAsTutor`, `getCourseTutors`, `bookTutoringSession`, `getTutoringSessions` | memberOf(course) |
| `updateTutoringSessionStatus` | AUTHENTICATED (el handler valida que sea el tutor o el estudiante de la sesión) |

**Moodle** (`modules/integrations/moodle.js`)

| Acción | Política |
|---|---|
| `moodleAutoEnroll` | AUTHENTICATED: solo cursos con Moodle habilitado, nunca como docente, inscripción `pending` |
| `exportCourseToMoodleXml`, `syncMoodleCourseRoster`, `syncMoodleCourseContents`, `getMoodleLtiDeepLinkContent` | staffOf(course) |
| `exportGradesToMoodleWebservice` | staffOf(course, assignment) |

### 1.4. Agregar una acción

1. Exportar el handler `async function miAccion(payload, context)` desde su módulo. `context` trae `uid`, `db`, `admin`, `request` y el perfil del llamador.
2. Registrarla en `ACTION_MODULES` (`functions/src/actions.js`).
3. Declarar su política en `ACTION_POLICIES` (`functions/src/authz.js`). El test de paridad falla si falta.
4. Agregar tests en `functions/tests/`.

---

## 2. Rutas HTTP de App Router

Se sirven desde Firebase App Hosting en el mismo dominio que la app. Cada ruta usa un único esquema de autenticación, centralizado en `src/app/api/middleware/api.ts`.

| Ruta | Método | Autenticación | Descripción |
|---|---|---|---|
| `/api/health` | GET, HEAD | Ninguna | Estado de la plataforma. Ver §2.1 |
| `/api/calendar?id={courseId}&token={secret}` | GET | `calendar_secret` o `sync_secret` del curso | Feed iCalendar (RFC 5545) con clases, exámenes, feriados y entregas |
| `/api/export/csv?id={courseId}&token={sync_secret}&type={tipo}` | GET | `sync_secret` (solo equipo docente) | CSV separado por `;`. `type`: `grades` (por defecto), `attendance` / `asistencia`, `roster` / `alumnos` / `alertas` |
| `/api/me` | GET | `Authorization: Bearer <Firebase ID token>` | Perfil del usuario autenticado |
| `/api/cli/courses` | GET | Bearer | Cursos del usuario (modo cloud de la Dojo CLI) |
| `/api/cli/assignments?courseId={id}` | GET | Bearer + membresía | Tareas de un curso |
| `/api/lti`, `/api/lti/launch` | POST (form) | `id_token` LTI (**sin verificar firma**) | Launch LTI 1.3 desde Moodle; redirige al módulo pedido (`targetModule`, `courseId`, `assignmentId` o sus variantes `custom_*`) |
| `/api/lti/deeplink` | POST (form), GET | `id_token` LTI | Deep Linking: devuelve a Moodle enlaces a los módulos de la cátedra |
| `/api/lti/jwks` | GET | Ninguna | Keyset público de la herramienta |

Los tokens de suscripción se comparan en tiempo constante. Las respuestas con datos de curso llevan `Cache-Control: private, no-store`.

**Ejemplo — Google Sheets:**

```text
=IMPORTDATA("https://<dominio>/api/export/csv?id=<courseId>&token=<sync_secret>&type=attendance")
```

La URL lista para copiar está en **Alumnos y Alertas → URL de Endpoint CSV**.

### 2.1. `/api/health`

```bash
curl -s https://<dominio>/api/health          # liveness + lectura de Firestore
curl -s https://<dominio>/api/health?deep=1   # además sondea la API de GitHub
```

```json
{
  "status": "ok",
  "timestamp": "2026-10-18T23:00:00.000Z",
  "checks": {
    "firestore": { "status": "ok", "latency_ms": 42, "required": true }
  }
}
```

- `200` con `status: "ok"` o `"degraded"` (falló un sondeo opcional, como GitHub).
- `503` con `status: "down"` (falló Firestore).
- El cuerpo nunca incluye credenciales ni contenido de documentos.

---

## 3. Funciones HTTP y programadas (`functions/index.js`)

| Función | Disparador | Contrato |
|---|---|---|
| `webhook` | `POST` JSON | Recibe notas de autograding. Cuerpo `{ assignmentId, sync_secret, grades: [{ matricula, grade, feedback }] }` (el `sync_secret` es el **de la tarea**). Idempotente por cabecera `x-dojo-delivery` o `x-github-delivery`. Responde `401` con secreto inválido y `429` tras 10 fallos por IP en 5 min |
| `importGrades` | `POST` CSV o JSON `?courseId=&token=` | Importa notas corregidas en planilla. `token` = `sync_secret` del curso |
| `calendar` | `GET ?id=&token=` | Feed iCal equivalente servido desde Functions; la app genera enlaces a `/api/calendar` |
| `sendDailySummaries` | Todos los días 20:00 (America/Argentina/Buenos_Aires) | Agrupa por estudiante las notificaciones marcadas como pendientes de resumen y envía un resumen diario |

La plantilla de workflow de GitHub Actions para autograding se descarga desde **Tareas → 🤖 Plantilla Autograding**.
