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
2. Rechaza tokens de sesiones revocadas (`AUTH_SESSION_REVOKED`): si el `auth_time` del token es anterior a `tokensValidAfterTime` del usuario (cambio de contraseña o `signOutEverywhere`).
3. Aplica el **rate limit** (`functions/src/lib/rateLimit.js`): 120 llamadas por minuto por usuario y límites propios para acciones sensibles (matrícula, códigos de invitación, QR, correos, respaldos, plagio). Al superarlo responde `resource-exhausted` con `details.code = "RATE_LIMITED"` y `retryAfterSeconds`.
4. Valida el payload (`functions/src/lib/validate.js`): objeto de hasta 512 KB y 20 niveles; todo campo de primer nivel con forma de ID (`id`, `*Id`, `*_id`, `*Uid`) y `courseIds` deben ser IDs de documento seguros (sin `/`, sin `__…__`, ≤ 256 caracteres). Si no, `INVALID_ARGUMENT`.
5. Busca la acción en `functions/src/actions.js`. Si no existe, responde `invalid-argument: Acción desconocida`.
6. Carga el perfil del llamador y aplica la **política de acceso** declarada en `functions/src/authz.js`. Una acción sin política se rechaza (`permission-denied`, fail closed).
7. Ejecuta el handler con el SDK admin y registra la llamada en la bitácora, redactando las claves que parecen secretos (`token`, `secret`, `password`, `api_key`, `sourcedid`).

Todo error llega al cliente como `HttpsError` con un **código semántico** en `details.code` (`functions/src/lib/errors.js`) y el mensaje en español para mostrar al usuario:

| Estado | Códigos |
|---|---|
| `invalid-argument` | `INVALID_ARGUMENT`, `VALIDATION_FAILED`, `UNKNOWN_ACTION` |
| `not-found` | `NOT_FOUND`, `COURSE_NOT_FOUND`, `ASSIGNMENT_NOT_FOUND`, `SUBMISSION_NOT_FOUND`, `PROFILE_NOT_FOUND`, `STUDY_GROUP_NOT_FOUND`, `BACKUP_NOT_FOUND`, `SESSION_NOT_FOUND`, `SCHEDULE_VERSION_NOT_FOUND` |
| `unauthenticated` | `UNAUTHENTICATED`, `AUTH_INVALID_TOKEN`, `AUTH_SESSION_REVOKED` (el cliente cierra la sesión y vuelve al login) |
| `permission-denied` | `FORBIDDEN`, `ADMIN_ONLY`, `NOT_COURSE_MEMBER`, `ASSISTANT_NOT_ALLOWED` |
| `failed-precondition` | `FAILED_PRECONDITION`, `ASSIGNMENT_PAST_DUE`, `GITHUB_NOT_CONFIGURED`, `MOODLE_NOT_CONFIGURED` |
| `already-exists` | `ALREADY_EXISTS` |
| `resource-exhausted` | `RATE_LIMITED` (con `retryAfterSeconds`) |
| `unavailable` | `UPSTREAM_ERROR` (GitHub, Moodle, Gmail o Google Sheets fallaron) |
| `internal` | `INTERNAL` |

Los handlers lanzan `dojoError('COURSE_NOT_FOUND', 'Curso no encontrado')`; un `Error` genérico se reporta como `INTERNAL`.

### 1.2. Políticas de acceso

| Política | Quién pasa |
|---|---|
| `AUTHENTICATED` | Cualquier usuario logueado. El handler opera sobre su propio `uid` y hace sus propios chequeos |
| `STAFF` | Rol `teacher` o `admin` |
| `ADMIN` | Rol `admin` |
| `staffOf(objetivo)` | Docente asignado (titular o ayudante) al curso del objetivo, o `admin` |
| `titularOf(objetivo)` | Docente **titular** del curso del objetivo, o `admin`. Un ayudante recibe `permission-denied` con `ASSISTANT_NOT_ALLOWED` |
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
| `getProfile` | AUTHENTICATED | Devuelve el perfil y lo crea en el primer login con el email, nombre y foto del **ID token verificado** (rol `student`, estado `pending`, salvo los emails de `SEED_ADMIN_EMAILS` / `SEED_TEACHER_EMAILS`). Registra cada inicio de sesión nuevo en `profiles/{uid}/security_log` |
| `exportMyData` | AUTHENTICATED | JSON con todos los datos personales de la cuenta (perfil, membresías, entregas, asistencia, foros, revisiones escritas, tutorías, grupos, XP, notificaciones y accesos), sin datos de terceros. Límite 5/h |
| `requestAccountDeletion` / `cancelAccountDeletion` | AUTHENTICATED | Marca o retira el pedido de baja (`deletion_requested_at`, motivo opcional); la baja la ejecuta un admin con `deleteUser` |
| `signOutEverywhere` | AUTHENTICATED | Revoca los refresh tokens del usuario: todas sus sesiones se cierran en la próxima llamada |
| `getSecurityLog` | AUTHENTICATED | Últimos 20 inicios de sesión propios: fecha, proveedor, user agent e IP enmascarada |
| `updateProfile` | AUTHENTICATED | Nombre, usuario de GitHub, matrícula y cohorte propios |
| `submitMatricula` | AUTHENTICATED | Valida `UNRN-` + ≥5 dígitos y aprueba la cuenta |
| `addSecondaryEmail` | AUTHENTICATED | Vincula un correo adicional |
| `getXpLogs` | AUTHENTICATED | Bitácora de XP propia |
| `mergeProfiles` | ADMIN | Fusiona dos perfiles duplicados |

**Administración** (`modules/course/admin.js`, `modules/system/*`)

| Acción | Política | Descripción |
|---|---|---|
| `getAdminUsers`, `getAdminCourses`, `getAdminCourseDetails` | ADMIN | Listados globales |
| `approveUser`, `updateUserRole`, `updateUserProfile` | ADMIN | Gestión de cuentas. `updateUserProfile` acepta solo `full_name`, `role`, `matricula_unrn`, `cohorte`, `commission` y `account_status`. Todo cambio de rol actualiza el custom claim `role` del usuario (si el rol baja, revoca sus sesiones) |
| `deleteUser` | ADMIN | Borra Auth, perfil, inscripciones y asignaciones docentes |
| `getGlobalSettings` | AUTHENTICATED | Configuración global (p. ej., calendario ICS institucional) |
| `saveGlobalSettings` | ADMIN | Guarda la configuración global: `globalCalendarIcsUrl` (https) y `allowed_email_domains` (hasta 20 dominios). Otras claves se ignoran |
| `logActivity` | AUTHENTICATED | Registra un evento de actividad propio |
| `getActivityLogs` | ADMIN | Bitácora de actividad |
| `createSystemBackup`, `getSystemBackups`, `downloadSystemBackup`, `restoreBackupDocument`, `deleteBackup` | ADMIN | Respaldos y restauración granular |

**Cursos** (`modules/course/courses.js`)

| Acción | Política | Descripción |
|---|---|---|
| `createCourse` | ADMIN | Alta de cátedras |
| `deleteCourse` / `restoreCourse` | ADMIN | Borrado lógico (`deleted_at`, `purge_after` a 30 días) y restauración. Una cátedra eliminada desaparece de los listados, sus códigos de invitación y feeds dejan de funcionar y `authz` rechaza las acciones de sus miembros con `COURSE_NOT_FOUND` |
| `assignTeacher`, `removeTeacher` | ADMIN | Equipo docente |
| `getCourseDetails`, `getCourseTeachers`, `getCourseRoster` | memberOf(course) | Los estudiantes reciben una proyección sin `sync_secret`, credenciales ni códigos de invitación docentes |
| `getStudentCourses` | AUTHENTICATED | Cursos del llamador |
| `getTeacherCourses` | STAFF | Cursos asignados (todos si es admin) |
| `enrollCourse` | AUTHENTICATED | Canjea un código: el de estudiante crea una inscripción `pending`; `T-…` / `A-…` asignan titular o ayudante y promueven a `teacher` |
| `getCourseSettings` | staffOf(course) | Ajustes de la cátedra sin credenciales (`has_github_token` en lugar del token) y con `course_role`. Los ayudantes no reciben los códigos de invitación docentes |
| `updateCourseName`, `updateCourseSettings` | titularOf(course) | `updateCourseSettings` acepta solo los campos editables (lista blanca con validación de tipos); un `github_token` vacío conserva el actual. Guardar `class_instances` crea una versión automática del cronograma |
| `cloneCourseExtraData` | titularOf(course, newCourse) | Copia ajustes de otra cátedra |
| `updateRosterStudentStatus`, `syncGuaraniRoster` | titularOf(course) | Estado de inscripciones / importación de roster |
| `setStudentCommission` | staffOf(course) | Asigna la comisión de un estudiante inscripto (`commissions.{courseId}`, máximo 60 caracteres). Reemplaza la escritura directa del perfil desde el navegador |

**Cronograma** (`modules/course/schedule.js`): `getScheduleVersions` — staffOf(course); `saveScheduleVersion`, `restoreScheduleVersion` — titularOf(course); `getComparisonCourses` — STAFF.

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
| `createAssignment`, `updateAssignment` | titularOf(course) / titularOf(assignment) | Campos validados: `title`, `description`, `due_date`, `template_repo` (`org/repo`), `is_group`, `create_feedback_pr` |
| `archiveAssignment` | titularOf(assignment) | Pasa la tarea a solo lectura |
| `getTeacherAssignments` | STAFF + courseIds de staff | |
| `getAssignmentSubmissions` | staffOf(assignment) | |
| `getCourseSubmissions` | staffOf(course) | Todas las entregas del curso en una llamada (consultas `in` por lotes, perfiles con `getAll`), con `assignmentId` y `assignmentTitle`. `pendingOnly: true` devuelve solo las entregadas sin nota (índice `assignment_id + status`) |
| `gradeSubmission` | staffOf(submission) | Nota 0–10 (coma o punto decimal) o conceptual de letras (`Aprobado`); feedback ≤ 5000 caracteres; queda en historial inmutable |
| `toggleAccess` / `massToggleAccess` | staffOf(submission) / titularOf(assignment) | Marca una entrega (o todas las de la tarea) como bloqueada (`is_locked`) |
| `syncGradesFromSpreadsheet` | staffOf(assignment) | Importa notas desde la URL de una planilla de Google Sheets |
| `getStudentAssignments` | AUTHENTICATED + courseIds de miembro | |
| `acceptAssignment` | memberOf(assignment) | Crea el repositorio del estudiante desde la plantilla |
| `submitAssignment` | AUTHENTICATED | Marca la entrega como presentada (el handler verifica la autoría) |
| `addGroupCollaborator` | memberOf(submission) | Solo el autor de la entrega o el equipo docente |
| `getStudentGithubActivity`, `getStudentCommits` | AUTHENTICATED | Commits, PRs y comentarios del repositorio |
| `detectAssignmentPlagiarism` | staffOf(assignment) | Similitud por fingerprints k-gram entre entregas |
| `enablePeerReview` | titularOf(assignment) | Activa la revisión entre pares |
| `getMyReviewAssignments` | memberOf(course) | Entregas que me tocan revisar (2 por revisor, rotación determinística) |
| `submitPeerReview` | memberOf(assignment) | |
| `getPeerReviewFeedback` | AUTHENTICATED | Feedback agregado y anónimo de mi entrega |
| `setSubmissionPortfolioVisibility`, `getMyPortfolio` | AUTHENTICATED | Portafolio público `/p/{uid}` |

**Asistencia** (`modules/attendance/attendance.js`)

| Acción | Política | Descripción |
|---|---|---|
| `startQrAttendance` | staffOf(course) | Abre la toma de asistencia de `classNumber`: crea en `courses/{id}/active_qr/current` una sesión con un secreto aleatorio, la ubicación opcional del aula y `expires_at` (TTL, 4 h). Devuelve `{ secret, period, serverTime, hasLocation }` para que el docente derive los códigos |
| `stopQrAttendance` | staffOf(course) | Cierra la sesión: ningún código vuelve a validar |
| `submitQrAttendance` | memberOf(course) | Valida el código rotativo (HMAC-SHA256 del intervalo de 15 s; se aceptan el vigente y el anterior) y, si la sesión tiene ubicación, exige la del estudiante a ≤ 150 m (Haversine). Suma 10 XP una sola vez por clase |

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
| `exportCourseToMoodleXml`, `getMoodleLtiDeepLinkContent` | staffOf(course) |
| `syncMoodleCourseRoster`, `syncMoodleCourseContents` | titularOf(course). `syncMoodleCourseRoster` (igual que `syncGuaraniRoster`) compara el SHA-256 del padrón con el de la última sincronización (`courses.roster_sync`) y devuelve `unchanged: true` sin escribir si no cambió; `force: true` la fuerza |
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
| `webhook` | `POST` JSON | Recibe notas de autograding. Cuerpo `{ assignmentId, sync_secret, grades: [{ matricula, grade, feedback }] }` (el `sync_secret` es el **de la tarea**). Idempotente por cabecera `x-dojo-delivery` o `x-github-delivery`. Responde `401` con secreto inválido y `429` tras 10 fallos por IP en 5 min. Si la escritura falla por un error transitorio responde `202 { queued: true, retryId }` y el evento pasa a la cola `webhook_dead_letters` |
| `importGrades` | `POST` CSV o JSON `?courseId=&token=` | Importa notas corregidas en planilla. `token` = `sync_secret` del curso |
| `calendar` | `GET ?id=&token=` | Feed iCal equivalente servido desde Functions; la app genera enlaces a `/api/calendar` |
| `dailyFirestoreExport` | Todos los días 04:00 (ART) | Export completo de Firestore a `BACKUP_BUCKET` (`gs://…/firestore/AAAA-MM-DD`) |
| `purgeDeletedCourses` | Todos los días 03:00 (ART) | Borra en cascada las cátedras cuyo `purge_after` venció: membresías, tareas, avisos, grupos, versiones, correos y subcolecciones |
| `onSubmissionGradeChange` | Trigger `onDocumentWritten` de `submissions/{id}` | Registra en `audit_logs` todo cambio de nota o feedback con su origen (`manual`, `spreadsheet`, `csv_import`, `autograding`) y autor (`graded_by`), y sincroniza la nota con Moodle si la entrega llegó por LTI |
| `onClassCommentUpdated` | Trigger `onDocumentUpdated` de `courses/{id}/class_comments/{id}` | Notifica al autor cuando su mensaje se marca como solución |
| `retryWebhookDeadLetters` | Cada 10 minutos | Reprocesa la cola `webhook_dead_letters` con backoff exponencial (5 min × 2ⁿ, hasta 6 intentos; luego `status: failed`) |
| `cleanupAssignmentData` | Trigger `onDocumentDeleted` de `assignments/{id}` | Borra las entregas y revisiones entre pares de la tarea eliminada (la auditoría de notas se conserva) |
| `sendDailySummaries` | Todos los días 20:00 (America/Argentina/Buenos_Aires) | Agrupa por estudiante las notificaciones marcadas como pendientes de resumen y envía un resumen diario |

La plantilla de workflow de GitHub Actions para autograding se descarga desde **Tareas → 🤖 Plantilla Autograding**.
