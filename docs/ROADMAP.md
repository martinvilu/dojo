# Roadmap y Estado del Proyecto — Ninja Dojo

> **Única fuente de verdad** para el estado del proyecto, el backlog priorizado y el historial de hitos.
> Última verificación: **18/10/2026** sobre `main` (`7c901db`) y sobre la rama de integración de PRs abiertos (#116).

Otros documentos: [Arquitectura](ARCHITECTURE.md) · [Referencia de API](API.md) · [Guía de Desarrollo](DEVELOPMENT.md) · [Manual de Operación](OPERACION.md) · [Manual de Usuario](../manual/index.md)

---

## 1. Estado verificado

Todas las suites se ejecutaron localmente (Node 24, Java 21, Chrome) el 18/10/2026.

| Check | Comando | Resultado |
|---|---|---|
| Chequeo de tipos | `npx tsc --noEmit` | ✔ 0 errores |
| Lint | `npm run lint` | ✔ 0 errores / 0 advertencias |
| Tests unitarios frontend | `npm run test:unit` | ✔ 48 pruebas / 12 suites (10 archivos) |
| Tests unitarios backend | `cd functions && npm test` | ✔ 239 pruebas / 23 suites |
| Build de producción | `npm run build` | ✔ 21 rutas (10 de API, 11 de páginas incluida `/_not-found`) |
| Reglas de Firestore | `npm run test:rules` | ✔ 23 escenarios (emulador) |
| E2E Selenium | `npm run test:selenium` | ✔ 56 escenarios / 14 módulos (mock server) |
| Auditoría de dependencias (functions) | `npm audit --omit=dev` | ✔ 0 vulnerabilidades tras #116 (antes: 2 altas + 1 crítica) |
| Auditoría de dependencias (app) | `npm audit --omit=dev` | ✘ 5 altas tras #116 (antes: 9). Ver §2.2 |

**Antes de esta verificación** `npm run test:unit` fallaba los domingos por la noche en husos al oeste de UTC (`tests/unit/metrics.test.ts`). La causa era un bug real: las métricas de GitHub agrupaban las horas en hora local y las semanas en UTC. Se corrigió en `7c901db fix(github): bucket weekly commit metrics in local time`, y la suite pasa ahora en UTC, Buenos Aires, Los Ángeles y Auckland.

**CI/CD**: cada PR corre 4 checks obligatorios (`.github/workflows/tests.yml`: Frontend, Backend, Security/rules, E2E) con *branch protection* estricta en `main`. `security.yml` (npm audit + CodeQL) corre en cada PR, en cada push y los lunes; su job `npm audit (.)` **falla hoy** por los advisories de §2.2 (no es un check obligatorio). Cada push a `main` despliega Functions y reglas (`firebase-deploy.yml`), y App Hosting despliega por integración git.

### 1.1. Pull requests y ramas (18/10/2026)

| Situación | PRs | Acción |
|---|---|---|
| Incorporados en #116, un commit semántico cada uno | #94 (deps), #92, #83, #89, #81 (perf), #91, #79, #78 (a11y) | Se cierran solos al mergear #116 (`Closes #N`) |
| Duplicados del mismo cambio | #76, #77, #86, #87, #88 (`useStudentRisk`), #80, #82, #90 (`useTabDataLoader`), #85 (Kanban) | Cerrados con comentario |
| Obsoleto | #74 (`CourseOverviewPanel` ya usa `useStudentRisk`) | Cerrado con comentario |
| PRs cerrados antes sin mergear (#11–#27, #32, #38, #51, #52, #54) | — | Obsoletos: apuntan a rutas que ya no existen o su cambio ya está en `main` |

Los PRs de bots (Jules «Bolt»/«Palette») tienden a repetir la misma optimización en varios PRs paralelos. Antes de abrir uno nuevo conviene revisar `.jules/bolt.md` y los PRs abiertos.

---

## 2. Hallazgos de la verificación

### 2.1. Funcionales (detectados en el código, sin corregir)

| # | Hallazgo | Impacto | Ubicación |
|---|---|---|---|
| H1 | El formulario de tareas no tiene campos de **consigna** ni de **fecha límite**, aunque el backend los acepta y valida | Las tareas creadas desde la UI no tienen `due_date`: nunca disparan la alerta «Tareas Atrasadas», no aparecen en el calendario ni en el feed iCal y no cuentan para el riesgo de abandono | `src/modules/github/components/AssignmentsPanel.tsx` (form de creación), `functions/src/modules/github/assignments.js` (`createAssignment`) |
| H2 | Los códigos de invitación de **docente** (`T-XXXXXX`) y **ayudante** (`A-XXXXXX`) no se pueden usar desde la UI: no se muestran en ningún panel y el campo «Código Cátedra» limita a 6 caracteres. Además, cualquier usuario que conozca uno pasa a rol `teacher` aprobado | Hoy los docentes se dan de alta solo por el administrador. Si se habilita el campo, el código pasa a ser una credencial de alto privilegio | `src/modules/course/components/StudentPanel.tsx` (`maxLength={6}`), `functions/src/modules/course/courses.js` (`enrollCourse`) |
| H3 | El token QR de asistencia lo genera el navegador del docente con `Math.random()` y lo escribe directo en Firestore. La UI lo rota cada 30 s y el servidor lo acepta hasta 45 s. El control de distancia solo corre si **ambos** envían coordenadas | Token predecible en teoría y sin rate limiting del intento (mejora 3.18). Un estudiante que no comparte su ubicación firma sin control de distancia | `src/modules/attendance/components/AttendanceManager.tsx`, `functions/src/modules/attendance/attendance.js` |
| H4 | El `id_token` de los launches LTI se decodifica sin verificar la firma (pendiente conocido, mejora 3.12) | Solo se usa para navegar; no debe usarse para decisiones de acceso | `src/app/api/lti/*` |
| H5 | `seed.sh` escribe directamente en el proyecto de **producción** `jutsu-classroom-mrtin`, usando el token de la Firebase CLI | Correrlo por error sobrescribe perfiles y cursos reales | `seed.sh` |
| H6 | La CLI del Dojo (`cli/`) es solo una especificación: no hay implementación | Las rutas `/api/cli/*` existen pero no tienen cliente | `cli/README.md` |
| H7 | `deleteUser` borra `course_roster` y `course_teachers` pero no `enrollments/{uid}_{courseId}` | Quedan inscripciones huérfanas que siguen apareciendo en consultas por curso | `functions/src/modules/course/admin.js` |
| H8 | No hay forma de rotar `sync_secret` / `calendar_secret` desde la UI | Ante una filtración hay que borrar el campo a mano en la consola de Firestore | `functions/src/modules/course/courses.js` (`ensureCalendarSecret`, `getCourseDetails`) |
| H9 | El botón **Activar** de «👥 Revisión entre Pares» envía solo `{ assignmentId, enabled }`, pero el backend exige una rúbrica de 1 a 8 criterios. Además, `requireCourseTeacher` no deja pasar al admin | La revisión entre pares no se puede activar desde la UI (el usuario ve «La rúbrica debe tener entre 1 y 8 criterios») | `src/modules/github/components/PeerReviewSection.tsx` (`handleToggle`), `functions/src/modules/github/peerreview.js` (`enablePeerReview`) |
| H10 | `enrollCourse` crea la inscripción con `status: 'pending'` y avisa «pendiente de aprobación», pero ningún control lo aplica y la UI no ofrece aprobarla (`updateRosterStudentStatus` no se usa) | El estudiante accede al curso apenas canjea el código; el mensaje es engañoso | `functions/src/modules/course/courses.js`, `functions/src/authz.js` |
| H11 | En tareas grupales, `acceptAssignment` ignora el `groupName` del modal: cada integrante recibe su propio repositorio (`<tarea>-<github_user>`). `addGroupCollaborator` existe en el backend pero ninguna pantalla lo usa | El trabajo grupal no queda vinculado en la plataforma | `src/modules/github/components/AssignmentsPanel.tsx` (`handleAcceptAssignment`), `functions/src/modules/github/assignments.js` |
| H12 | La URL de calendario global (**Configuración**) se guarda con `saveGlobalSettings`, pero ningún calendario ni feed la consume | El administrador cree haber publicado el calendario institucional y no aparece | `src/app/dashboard/hooks/useAdminPanel.ts`, `src/app/api/calendar/route.ts` (solo usa `external_calendars` del curso) |

### 2.2. Dependencias pendientes

| Paquete | Advisory | Por qué sigue | Cómo resolverlo |
|---|---|---|---|
| `next` 16.3.6 | GHSA-cjq9-62q9-8jv4 (SSRF en Image Optimization) | El parche está en 16.4.2, fuera del rango fijado `16.3.6` | Subir `next` y `eslint-config-next` a 16.4.x y correr las 4 suites |
| `@grpc/grpc-js` ≤ 1.13.5 (vía `firebase` → `@firebase/firestore`) | GHSA-m9gg-hp2v-232j, GHSA-f596-whhp-79r4 | Depende de que el SDK cliente de Firebase actualice su dependencia | Actualizar `firebase` cuando publique una versión con grpc ≥ 1.14.5 |

### 2.3. Higiene del repositorio

- En la copia local había cambios sin commitear en `package.json` / `package-lock.json` de la raíz y de `functions/`. El de la raíz agrega `firebase-functions`, que la app Next.js no importa en ningún lado; conviene descartarlo o justificarlo antes de commitear.
- `status.md` (19/09/2026) es el plan de integración con TypeSafe/Jev y `mejoras.md` lleva el seguimiento de las 250 propuestas. El estado vigente vive en este archivo.

---

## 3. Seguridad implementada

*   **Autorización por acción en la callable `api`** (`functions/src/authz.js`): toda acción declara una política (`AUTHENTICATED`, `STAFF`, `ADMIN`, `staffOf(...)`, `memberOf(...)`) y se rechaza si no la tiene; un test verifica la paridad entre el registro y las políticas.
*   **Firestore RBAC**: reglas por colección (perfiles own-only, escrituras privilegiadas solo vía Cloud Functions) con suite de regresión contra emulador.
*   **Secretos de curso separados**: `sync_secret` (solo equipo docente: CSV, importación de notas, autograding) y `calendar_secret` (solo lectura del feed iCal, visible para estudiantes). Ambos de 32 hex chars, comparados en tiempo constante.
*   **Anti fuerza bruta e idempotencia**: el webhook de autograding limita a 10 intentos fallidos por IP cada 5 min y descarta entregas repetidas (`x-dojo-delivery` / `x-github-delivery`).
*   **Sanitización**: Markdown de usuarios sanitizado antes de inyectar HTML; URLs externas de Moodle/LTI restringidas a HTTPS público (anti SSRF) y XML escapado.
*   **Bitácoras sin secretos**: el dispatcher redacta claves que parecen tokens antes de loguear el payload.

---

## 4. Backlog priorizado

### 🔴 Prioridad alta
1.  **Campos de consigna y fecha límite en el formulario de tareas** (H1) y **editor de rúbrica para la revisión entre pares** (H9). Bajo esfuerzo y alto impacto: activan alertas, calendario, analítica de riesgo y peer review.
2.  **Actualizar Next.js a 16.4.x** (§2.2) y dejar en verde `security.yml`.
3.  **Tests E2E contra la app real**: hoy Selenium valida contra un mock server. Agregar un modo contra `firebase emulators:exec` (Auth + Firestore + Functions) con datos seed.
4.  **Tokens QR generados en el servidor** con rate limiting (H3, mejora 3.18).
5.  **Verificación de firma LTI 1.3** contra el JWKS de la plataforma (H4, mejora 3.12).

### 🟡 Prioridad media
6.  **Definir el alta de docentes y estudiantes**: quitar los códigos `T-`/`A-` o exponerlos solo al administrador con expiración (H2), y decidir si la inscripción con código requiere aprobación docente (H10).
7.  **Seed seguro**: apuntar `seed.sh` al emulador por defecto y pedir confirmación explícita para un proyecto real (H5).
8.  **Higiene de cuentas y secretos**: borrar `enrollments` en `deleteUser` (H7) y agregar la rotación de secretos de curso en **Ajustes Cátedra** (H8). Leer la URL de calendario global en los feeds (H12).
9.  **Tareas grupales reales**: un repositorio por equipo a partir del nombre de equipo y una pantalla para sumar integrantes con `addGroupCollaborator` (H11).
10. **Schemas Zod en Cloud Functions** (mejora 2.07) y **cifrado en reposo** de tokens de GitHub/Moodle (mejora 3.13).
11. **Detección de plagio v2**: winnowing para repos grandes y resaltado de fragmentos coincidentes (v1 con fingerprints k-gram ya en producción).
12. **Autograding avanzado**: detección automática del runner y feedback estructurado por test fallido.

### 🟢 Exploratorias
13. Asistente pedagógico de corrección con IA sobre diffs de entregas y señales de riesgo semánticas (ver `status.md`).
14. Implementar la Dojo CLI según `cli/CLI_SPEC.md` (H6).

---

## 5. Historial de hitos

Condensado; el detalle fino vive en `git log`.

| Hito | Commits |
|---|---|
| Modularización frontend/backend por dominios (`src/modules/`, `functions/src/modules/`) | base del árbol actual |
| Firestore RBAC estricto + suite de reglas en CI (23 escenarios) | `69c8ddf`, `9763b71`, `46e261c` |
| CI completo: 4 jobs obligatorios en PR + branch protection en `main` | `aad3c72`, `51935cb` |
| Calendario multi-materia, feed iCal con token, paleta ⌘K, toolbar Markdown | `74f8d85`, `1679951`, `b82b0d1` |
| Dashboard modularizado (<500 líneas, 14 hooks de dominio, 7 componentes de layout) | `fd403ea`…`4d3c851` |
| Detección de plagio v1, peer review, portafolio público, predicción de abandono | `42b806c` y siguientes |
| Auditoría de seguridad: autorización por acción, fin de fugas de secretos, SSRF Moodle, Next 16.3.6 | `ed5a519`, `0e50613`, `3a58fdf`, `c035209` |
| Fase 1 de mejoras: a11y de modales, validación de notas/tareas, webhook idempotente, `/api/health`, Dependabot, CodeQL, banner offline | `dd258de`…`4e647de` |
| Ampliación de cobertura de tests (frontend 48, backend 239) | `3a32b9c` |
| Fix de métricas semanales por huso horario; integración y limpieza de PRs de bots | `7c901db`, #116 |
