# Plan de Implementación — SPEC.md (Ninja Dojo / Jutsu Classroom)

> Plan derivado de [`SPEC.md`](../SPEC.md) contrastado contra el código de `main` (`7b3d012`, 22/10/2026).
> Complementa a [`ROADMAP.md`](ROADMAP.md) (estado) y [`mejoras.md`](../mejoras.md) (las 250 propuestas); los IDs `x.yy` remiten a esa lista.

---

## Estado de avance (22/10/2026)

| Fase | Estado | Notas |
|---|---|---|
| F1 Seguridad | ✅ 1.1–1.5 implementadas | Rate limit por `uid` (no por IP: en el aula todos comparten NAT). QR: además se exige inscripción y ubicación cuando hay geocerca, y el XP de asistencia se suma una sola vez. Zod destapó que `updateCourseSettings` y `updateUserProfile` escribían cualquier campo del cliente: ahora tienen lista blanca. |
| F2 Motor académico | ✅ 2.1–2.6 · ⏭️ 2.7 | 2.7 movida a F4: no existe un webhook de eventos de GitHub (`pull_request_review`); el `webhook` actual solo recibe notas del autograding. Se agregaron al formulario de tareas la fecha límite (no había forma de cargarla desde la UI) y "Obligatorio para regularizar". |
| F3 LTI 1.3 Advantage | ✅ 3.1–3.11 | Decisión de seguridad: la plataforma la registra el titular pero la **aprueba un admin**; sin aprobación no entran docentes ni se vinculan cuentas existentes (evita que un Moodle propio suplante cuentas por email). El NRPS/AGS corre en Functions con la misma librería que usan las rutas de Next. |
| F4 Retención | ✅ 4.1–4.8 | El webhook de GitHub quedó como Cloud Function `githubEvents` (no `/api/github/webhook`) para reutilizar el cálculo de vencimientos del backend. `checkAndAlertStudentsAtRisk` usa el motor nuevo (corrige la lectura de la asistencia vieja, tarea 0.1 para alertas). |
| F5 URLs semánticas | ✅ 5.1–5.5 | Las páginas resuelven la ruta en el cliente con una acción autenticada (no en el servidor) para no exponer uid en el HTML. `PUT …/admin/configuracion` no se implementó: Next no permite `page.tsx` y `route.ts` en el mismo segmento; las reglas se guardan con `updateGradingRules`. `cierre-cursada` queda para F6. |

Cambio respecto del principio 3: la lógica pura vive en `functions/src/lib/academic/` (CommonJS) y Next la importa por ruta relativa (`/api/export/csv`), porque Firebase solo despliega el directorio `functions/`; un `shared/` hermano no llegaría a producción.

Requisitos de despliegue: cargar en Secret Manager `DOJO_ENCRYPTION_KEY`, `LTI_TOOL_PRIVATE_KEY` y `GITHUB_WEBHOOK_SECRET` **antes** de mergear, y correr las migraciones `001-encrypt-credentials.js` y `002-semantic-routes.js` (ver `docs/DEVELOPMENT.md` §6).

---

## 0. Diagnóstico: qué del SPEC ya existe y qué falta

Leyenda: ✅ implementado · 🟡 parcial / difiere del SPEC · ⬜ ausente

| § SPEC | Funcionalidad | Estado | Evidencia / brecha |
|---|---|:---:|---|
| 1.1 | Legajo `matricula_unrn`, emails múltiples, merge de perfiles | 🟡 | `submitMatricula`, `addSecondaryEmail`, `mergeProfiles` existen. Falta validar `^UNRN-\d+$` en servidor, `lti_user_sub`, `moodle_user_id` en perfil (solo aparece en `moodle.js`). |
| 1.1 | `account_status` / aprobación | ✅ | `approveUser`, reglas impiden auto-escalada. |
| 1.1 | `academic_condition` calculada | ⬜ | No hay motor de condición. El CSV de export infiere "EN RIESGO" ad hoc. |
| 1.1 | Excepciones de cursada | ⬜ | Sin modelo de excepciones (asistencia, TP puntual, vencimiento). |
| 1.1 | XP, nivel, rango, medallas | 🟡 | Cálculo en el cliente (`StudentNinjaRankCard.tsx`) **y** escrituras paralelas en `profiles/{uid}/xp_logs` (QR). Dos fuentes de verdad; el SPEC pide cálculo sin escrituras redundantes. |
| 1.2 | Assignments + submissions + nota 0–10 validada | ✅ | `functions/src/lib/grades.js`, `assignmentValidation`. |
| 1.2 | Margen de tolerancia / `Fuera de término` / excepción puntual | ⬜ | No hay `tolerance`, ni marca de entrega tardía. |
| 1.2 | Plagio k-gramas/Jaccard | ✅ | `functions/src/modules/github/plagiarism/`. Umbral configurable por curso: verificar. |
| 1.2 | Reglas parametrizables de regularidad y promoción | ⬜ | No existe ningún campo `min_attendance`/`promotion`. **Brecha principal del producto.** |
| 1.3 | Alertas automáticas (4 disparadores) | 🟡 | `checkAndAlertStudentsAtRisk` + `getDropoutRiskAnalysis`. Faltan: inasistencias consecutivas, "Sin repo a N días", "Deserción silenciosa". **Bug:** `checkAndAlertStudentsAtRisk` lee la colección legada `attendance/` mientras QR y carga manual escriben en `courses/{id}/attendance` → falsos positivos de riesgo. |
| 1.3 | Ciclo de vida de alerta (Activa/Contactado/Pospuesta) | ⬜ | Las alertas no se persisten con estado. |
| 1.3 | Timeline de interacciones docente | ⬜ | Solo `mail_logs`; no hay registro multicanal. |
| 1.3 | Foro por clase, reacciones, mejor respuesta | 🟡 | `ClassCommentsThread.tsx` + regla `onlyBestAnswerChanged`. Campo `is_best_answer` (SPEC: `is_solution`); falta notificación al alumno y XP del lado servidor. |
| 1.3 | Tickets contextuales sobre celdas de la ficha | ⬜ | |
| 1.4 | Horarios base + generación de clases | ✅ | `schedule.js`, `CourseSchedulesPanel.tsx`. |
| 1.4 | Kanban curricular | 🟡 | Existe en `CourseSchedulesPanel.tsx` (1102 líneas); verificar accesibilidad por teclado. |
| 1.4 | Snapshots + diff + restauración | 🟡 | `save/get/restoreScheduleVersion`; diff visual presente, revisar cobertura de "movidas/modificadas". |
| 1.4 | Integración YouTube | ⬜ | Sin OAuth de YouTube. |
| 1.4 | QR dinámico + GPS Haversine 150 m | 🟡 | `submitQrAttendance` valida distancia. El token lo genera **el cliente docente** y lo escribe en `active_qr` (regla `isTeacherOf`); no hay TOTP ni rotación servidor (mejora 3.18). |
| 1.4 | Feedback anónimo SHA-256 | ✅ | `useClassFeedback.ts` + regla `class_feedback`. |
| 1.5 | Tutorías con Meet | 🟡 | `tutoring.js` genera un `meeting_link` con ID aleatorio (no es una sala real de Meet). |
| 1.5 | Grupos de estudio + emparejamiento | ✅ | `studyGroups.js`, `findStudyBuddies`. |
| 2.2 | RBAC 3 capas + TA restringido por comisión | 🟡 | `authz.js` + reglas ✅. El rol `ayudante` existe en `course_teachers`, pero no se restringe a **su comisión**. |
| 2.3 | Endpoints con `sync_secret`/`calendar_secret`/Bearer/HMAC/health | ✅ | `src/app/api/middleware/api.ts`. |
| 2.3 | LTI 1.3 OIDC (`login_initiations`, `launch`, `jwks`) | ⬜ | `/api/lti/launch` **decodifica el `id_token` sin verificar firma**, sin `state`/`nonce`, sin login initiation. Rutas en `/api/lti/*` (SPEC: `/api/v1/lti/*`). |
| 2.3 | URLs semánticas `/{asignatura}/{anio}/{cuatri}/{comision}/…` | ⬜ | Hoy `/dashboard?tab=…` y `/dashboard/courses/[id]/[[...slug]]` que redirige a query params. |
| 3.1 | Webhooks HMAC + idempotencia | ✅ | `processed_webhooks`, tests de idempotencia y throttle. |
| 3.1 | Estados por evento PR (changes requested / approved) + audit log | ⬜ | No hay webhook de eventos de GitHub: `functions/src/modules/github/webhook.js` solo recibe notas del autograding (`sync_secret`). `src/lib/github/webhookVerification.ts` existe pero no se usa en ninguna ruta. |
| 3.2 | NRPS 2.0 / AGS 2.0 / Deep Linking 2.0 | 🟡 | `syncMoodleCourseRoster` y `exportGradesToMoodleWebservice` usan **Web Services de Moodle**, no los servicios LTI Advantage. Deep linking existe (`/api/lti/deeplink`). |
| 3.3 | Importador CSV de logs de Moodle | ⬜ | |
| 3.3 | Export CSV / IMPORTDATA | ✅ | `/api/export/csv`; faltan columnas de condición final y alertas formales. |
| 4 | Tokens de diseño, Chivo, a11y (focus trap, ⌘K, offline) | ✅ | `globals.css`, `layout.tsx`, `useFocusTrap`, `CommandPalette`. |
| 5.1 | UC-D17 Simulador de cierre + acta congelada | ⬜ | |
| 7.2 | Backlog Fases 1–4 | ⬜ | Rate limiting, AES-GCM, Zod en functions, `useBeforeUnload`, virtualización, TS en functions, Playwright, Sentry. |

**Conclusión:** la plataforma base (cursos, entregas, GitHub, asistencia, foros, comunidad, seguridad de endpoints) está construida. Lo que el SPEC agrega de verdad son cuatro piezas: **(1)** un motor académico de reglas y condición, **(2)** LTI 1.3 Advantage auténtico, **(3)** un motor de retención con alertas persistentes y bitácora, y **(4)** el esquema de URLs sin PII. El resto es endurecimiento y deuda técnica ya listada en `mejoras.md`.

---

## 1. Principios transversales

1. **Evolución incremental, no reescritura.** Cada épica se monta sobre los módulos existentes (`functions/src/modules/<dominio>`, `src/modules/<dominio>`).
2. **Definition of Done de toda acción nueva:** política en `functions/src/authz.js` (el test de paridad lo exige), esquema Zod del payload, regla Firestore si hay lectura cliente, tests Jest, y escenario en `tests/firestore.rules.test.js` cuando aplica.
3. **Lógica de dominio pura y compartida.** XP, condición académica y alertas se escriben como funciones puras sin I/O en un paquete compartido (`shared/domain/`, consumido por `src/` y `functions/`), testeadas con tablas de casos. Esto adelanta parte de la mejora 3.01 sin bloquearse en ella.
4. **Feature flags por curso** (`courses/{id}.features.*`) para lanzar LTI 1.3, alertas nuevas y URLs semánticas sin romper cátedras en curso.
5. **Migraciones idempotentes** como scripts en `scripts/migrations/NNN-*.js` ejecutables contra el emulador y luego producción, con `--dry-run`.
6. Un PR por tarea, commits convencionales como el historial actual, `npm run test:local` verde antes de cada push.

---

## 2. Fases

Duraciones estimadas para 1 desarrollador a tiempo completo; ajustar según el equipo.

```
F0 Fundamentos ──► F1 Seguridad ──► F3 LTI Advantage ──► F6 Cierre de cursada
       │                                    ▲                    ▲
       └──────► F2 Motor académico ─────────┼──► F4 Retención ───┘
                                            │
                     F5 URLs semánticas ────┘   (paralelizable desde F0)
F7 Rendimiento/TS y F8 Testing/Observabilidad: continuo, en paralelo
```

### Fase 0 — Fundamentos de dominio y deuda bloqueante (1–1,5 semanas)

| # | Tarea | Archivos | Criterio de aceptación |
|---|---|---|---|
| 0.1 | **Unificar el modelo de asistencia** en `courses/{id}/attendance/class_{n}.records`. Migrar `attendance/` legada y reescribir `checkAndAlertStudentsAtRisk`, `markAttendance` y `analytics.js` para leer solo esa fuente. | `attendance.js`, `notifications.js`, `analytics.js`, `scripts/migrations/001-attendance.js` | Un alumno con 100 % de presentes vía QR no aparece en riesgo. Test de regresión. |
| 0.2 | Crear `shared/domain/` con `xp.ts` (fórmula §1.1, nivel, rango, medallas) y tests de tabla. `Nota × 5` suma las notas numéricas de TPs **y de parciales/recuperatorios** (colección `assessments`, Fase 2). El card del alumno y el backend consumen la misma función; `xp_logs` queda como bitácora de solo lectura derivada (o se elimina la escritura). | `StudentNinjaRankCard.tsx`, `attendance.js` | Mismo XP en cliente y en servidor para el seed de 21 alumnos. |
| 0.3 | **Modelo de identidad**: `profiles.{lti_user_sub, moodle_user_id, emails[]}`, validación `^UNRN-\d+$` en servidor (Zod), índice para búsquedas por cada identificador. | `profile.js`, `src/lib/schemas/auth.ts`, `firestore.indexes.json` | Rechazo de legajos mal formados; tests. |
| 0.4 | **Comisiones de primera clase**: `courses/{id}.commissions[]` con `{code, name, staff_uids[]}`; `course_teachers.{commissions[]}` para el TA. Política `authz` "TA solo opera sobre alumnos de sus comisiones". | `courses.js`, `authz.js`, `firestore.rules`, `CourseTeachersPanel.tsx` | Un ayudante de Comisión 1 no puede calificar ni tomar asistencia de Comisión 2 (test de authz + reglas). |
| 0.5 | Renombrar/alias `is_best_answer` → `is_solution` (lectura de ambos durante la transición). | `ClassCommentsThread.tsx`, `firestore.rules` | Sin pérdida de soluciones existentes. |

### Fase 1 — Cierre de seguridad (SPEC 7.2 Fase 1) (2 semanas)

| # | Tarea (mejora) | Detalle | Criterio |
|---|---|---|---|
| 1.1 | Rate limiting en la callable `api` (3.05) | Ventana fija por `uid` en Firestore (`rate_limits/{key}` con TTL) o memoria por instancia + límite global; límites más estrictos para `submitQrAttendance` y acciones de correo. | Test que supera el umbral → `resource-exhausted`. |
| 1.2 | Zod en todas las Cloud Functions (2.07) | Wrapper `withSchema(schema, handler)` aplicado en `actions.js`; reutilizar esquemas de `src/lib/schemas/`. Test de paridad: toda acción registrada tiene esquema. | 100 % de acciones con esquema. |
| 1.3 | QR TOTP server-side (3.18) | Nueva acción `startQrSession` (docente) guarda `secret` + `(lat,lng)` + `expires_at` en `active_qr` **solo vía Admin SDK** (regla pasa a `write: false`). Token = HOTP(secret, ⌊t/15s⌋) de 6 caracteres; `submitQrAttendance` acepta ventana actual ±1. Verificar inscripción y que la clase esté en curso. | Un token capturado deja de valer a los 30 s; el cliente nunca ve el secreto. |
| 1.4 | Cifrado AES-256-GCM en reposo (3.13) | Clave maestra en Secret Manager (`defineSecret`); `lib/secrets.js` gana `encrypt/decrypt` con IV aleatorio y versión de clave. Migrar tokens de Gmail/GitHub/Moodle. | Ningún token legible en Firestore; rotación de clave documentada. |
| 1.5 | `useBeforeUnload` (1.49) | Hook en `src/hooks/`, aplicado a configuración de curso, cronograma y corrección. | Aviso del navegador con cambios sin guardar. |

> La verificación JWT de LTI (3.12) se aborda en la Fase 3 porque requiere rediseñar el flujo completo, no solo verificar la firma.

### Fase 2 — Motor académico: reglas, vencimientos y condición (2,5–3 semanas)

| # | Tarea | Detalle |
|---|---|---|
| 2.1 | **Esquema `grading_rules` por curso con override por comisión**: `min_attendance` (0.75), `required_tps` (todos / lista), `max_exempt_tps` (1), `partial_pass_grade` (4), `promotion_grade` (7), `promotion_ok_ratio` (0.8), `max_late_for_promotion`, `allow_promotion_via_recovery` (bool), `late_tolerance_hours` (horas corridas, 48 por defecto). | UI en `CourseSettingsPanel.tsx`; solo titular escribe. |
| 2.2 | **Evaluaciones parciales en colección propia**: `assessments/{id}` (`course_id`, `commission?`, `kind: 'parcial' \| 'recuperatorio'`, `label` P1/P2/R1/R2, `recovers` → id del parcial que recupera, `date`, `max_grade`) y `assessment_grades/{assessmentId}_{uid}` (nota 0–10 validada con `grades.js`, `absent`, `feedback`). | Acciones `create/update/archiveAssessment`, `gradeAssessment`, `importAssessmentGrades` (CSV); políticas `authz` (TA solo su comisión); reglas: el alumno lee solo sus notas. Panel nuevo `src/modules/course/components/AssessmentsPanel.tsx`. No se mezclan con `assignments`/`submissions`, que siguen siendo exclusivamente TPs con GitHub. |
| 2.3 | **Excepciones** (`course_exceptions/{courseId}_{uid}_{id}`): tipo (`attendance_waiver`, `tp_exempt`, `deadline_extension`), justificación, autor, fecha. Escritura solo vía function + `audit_logs`. |
| 2.4 | **Vencimientos**: al registrar entrega (webhook o manual) calcular `submitted_at` vs `deadline + tolerancia` (± excepción) → `submissions.late = true`; la UI muestra `Fuera de término`. La tolerancia se cuenta en **horas corridas** (feriados y fines de semana incluidos); sin calendario hábil. |
| 2.5 | **Función pura `computeAcademicCondition(student, course, rules)`** (recibe TPs, `assessment_grades`, asistencia y excepciones) en `shared/domain/condition.ts` → `{condition, reasons[], distance_to_promotion, distance_to_regularity}`. Tests de tabla con los casos borde del SPEC (R1 con/sin promoción, TP exceptuado, asistencia exceptuada). |
| 2.6 | Exponer condición: columna en `CourseStudentsPanel`, chip `rounded-full` (§4.2), ficha del alumno, y columnas nuevas en `/api/export/csv` (nota por TP/parcial, promedio, % asistencia, alertas, condición). |
| 2.7 | ~~Estados de entrega completos desde GitHub~~ → **movida a F4**: requiere crear el endpoint `/api/github/webhook` (HMAC `X-Hub-Signature-256`, `processed_webhooks`) y registrarlo en la organización. | — |

### Fase 3 — LTI 1.3 Advantage real (3 semanas)

Requisito externo: **instancia de Moodle 4.2+ de pruebas** (Docker `moodlehq/moodle-docker`). El registro de la herramienta en el campus de la UNRN lo gestiona **el docente**, así que la configuración tiene que ser autoservicio para el titular.

**Rutas.** El estándar IMS (LTI Core 1.3 + Security Framework 1.0) no fija paths: exige que la herramienta exponga una *OIDC Login Initiation URL*, una o más *Redirect URIs* (launch), un *JWKS* público por HTTPS y que estén registradas en la plataforma. Se adoptan los nombres del SPEC, que siguen esa terminología: `/api/v1/lti/login_initiations` (GET y POST), `/api/v1/lti/launch` (Redirect URI, POST `form_post`), `/api/v1/lti/jwks`, y además `/api/v1/lti/deep_linking` y `/api/v1/lti/register` (Dynamic Registration). Las rutas actuales `/api/lti/*` quedan como alias con redirect 307 durante un cuatrimestre.

| # | Tarea | Detalle |
|---|---|---|
| 3.1 | Registro de plataformas (autoservicio del titular) | `lti_platforms/{id}`: `issuer`, `client_id`, `deployment_ids[]`, `auth_login_url`, `auth_token_url`, `jwks_url`, `owner_uid`, cursos vinculados. **IMS LTI Dynamic Registration 1.0** (`/api/v1/lti/register`): el docente pega en Moodle una URL de registro de un solo uso generada desde *Ajustes Cátedra → Integraciones*, y la plataforma queda creada sin copiar datos a mano; formulario manual como alternativa. Par de claves RSA de la herramienta en Secret Manager con rotación por `kid`; `/api/v1/lti/jwks` publica las públicas vigentes. |
| 3.2 | OIDC login initiation | `/api/v1/lti/login_initiations`: valida `iss`/`client_id`/`lti_deployment_id` contra `lti_platforms`, genera `state` + `nonce` (guardados con TTL de 10 min, cookie `SameSite=None; Secure`), redirige a `auth_login_url`. |
| 3.3 | Launch verificado | `/api/v1/lti/launch`: verificar firma RS256 contra JWKS cacheado (librería `jose`), `iss`, `aud`, `exp`, `nonce` de un solo uso, `state`, `deployment_id`, versión `1.3.0`. Mantener `/api/lti/*` como alias con redirect durante una cuatrimestre. |
| 3.4 | Sesión e identidad | Resolver usuario por `(iss, sub)` → `lti_user_sub`; vincular por email/`lis_person_sourcedid` (legajo). Emitir **Firebase Custom Token** y aterrizar según rol (Instructor/TA → Resumen; Learner → dashboard con rango). Actualizar `ultima_actividad_moodle`. Mapeo de roles §2.2; un launch nunca otorga `admin`. |
| 3.5 | Onboarding GitHub | Si el alumno no tiene `github_username`, wizard OAuth GitHub tras el launch. |
| 3.6 | Cliente de servicios LTI | Token OAuth2 `client_credentials` con JWT assertion firmada por la herramienta; caché por scope. |
| 3.7 | NRPS 2.0 | Acción `syncLtiRoster`: paginación por `Link`, checksum SHA-256 del padrón ordenado, escritura solo de altas/bajas, TAs → `course_teachers` con rol `ayudante`. Reemplaza a `syncMoodleCourseRoster` en cursos con LTI 1.3. |
| 3.8 | AGS 2.0 | Crear/obtener *line items* por TP y parcial; publicar `scoreGiven` escalado a `scoreMaximum` con `grades.js`, `comment` = feedback, `activityProgress`/`gradingProgress`. Disparo manual (`ags-publish`) y automático al calificar (cola con reintentos). |
| 3.9 | Deep Linking 2.0 | Migrar `/api/lti/deeplink` a `/api/v1/lti/deep_linking` con respuesta `LtiDeepLinkingResponse` firmada (TPs, parciales y clases como `ltiResourceLink`). |
| 3.10 | Guía para el docente | Página en `manual/` con el paso a paso de Dynamic Registration y del alta manual en Moodle, más qué pedirle al administrador del campus si su rol no permite agregar herramientas externas. |
| 3.11 | Tests | Fixtures de JWT firmados con clave de prueba: firma inválida, `nonce` repetido, `aud` ajeno, `deployment_id` no registrado, rol escalado, token de registro reutilizado. |

### Fase 4 — Retención: alertas, bitácora, consultas (2,5 semanas)

| # | Tarea | Detalle |
|---|---|---|
| 4.1 | Motor de alertas puro `shared/domain/alerts.ts` con los 4 disparadores: asistencia < umbral (≥ 3 clases) o N ausencias consecutivas; TP vencido sin entrega ni PR; sin repo a N días (consulta a la org de GitHub, cacheada); deserción silenciosa (actividad Moodle reciente sin commits/PR). |
| 4.2 | Persistencia `student_alerts/{courseId}_{uid}_{type}` con estados `active` / `contacted` / `snoozed_until` / `resolved`; un *scheduled function* diario recalcula y **no re-dispara** alertas pospuestas o contactadas. Reemplaza el cálculo ad hoc de `checkAndAlertStudentsAtRisk` y lo alimenta `getDropoutRiskAnalysis`. |
| 4.3 | Tarjeta "Alumnos que requieren atención" con acciones de un clic: enviar correo (plantilla del módulo `mail`), agendar tutoría, marcar contactado, posponer N días. |
| 4.4 | **Timeline de interacciones** `contact_logs` (append-only, regla `update/delete: false`): fecha, docente/TA, canal (Email, Discord, Moodle, Presencial), resumen. Los correos enviados se registran solos. |
| 4.5 | **Importador CSV de logs de Moodle**: parseo en Web Worker en el cliente → envío por lotes a la acción `importMoodleLogs`; extracción `user with id '(\d+)'`, hash por evento (`moodle_user_id + hora + evento + contexto`) como ID de documento ⇒ idempotente con archivos solapados; actualiza `ultima_actividad_moodle`. Ruta `admin/integraciones/moodle-csv`. |
| 4.6 | Foro: marcar solución pasa a una acción del servidor (otorga XP vía `xp.ts`, crea notificación al autor). |
| 4.8 | **Webhook de eventos de GitHub** (ex 2.7): `/api/github/webhook` con `verifyGithubWebhook` + `processed_webhooks`; `pull_request` abierto/push → `submitted` (con cálculo de `late`), `pull_request_review` `changes_requested` → `Reentrega pendiente`, `approved` → `OK`, cada cambio en `audit_logs`. |
| 4.7 | **Tickets contextuales** `review_requests`: referencia a celda (`{kind: 'attendance'\|'submission'\|'grade', ref}`), hilo, estado; visibles en el Resumen docente filtrado por comisión. |

### Fase 5 — URLs semánticas sin PII (1,5–2 semanas, paralelizable desde F0)

1. Agregar a cursos `slug` (`b6003-programacion-1`), `year`, `term` (`1c`/`2c`) y a comisiones `slug`; índice único `(slug, year, term)`.
2. Alias opaco nuevo por alumno `profiles.student_public_id` = `st_` + 10 hex de `crypto.randomBytes` (reintento ante colisión), asignado al crear el perfil y por migración `scripts/migrations/00N-student-public-id.js` a los existentes. Índice `student_public_ids/{st_…} → uid` (lectura solo vía function) para resolver la URL en O(1). Nunca aparecen en URLs el `uid` ni el legajo.
3. Rutas App Router: `src/app/[asignatura]/[anio]/[cuatrimestre]/[comision]/{planilla, estudiantes/[sid], estudiantes/[sid]/practicas/[tp], estudiantes/[sid]/asistencias, admin/configuracion}` como *shells* que reutilizan los paneles existentes; leer la guía de rutas dinámicas en `node_modules/next/dist/docs/` antes de implementar (Next 16 con cambios respecto de versiones previas).
4. Las rutas `POST …/admin/lti/*`, `…/moodle-csv` y `…/cierre-cursada` del SPEC se implementan como Route Handlers delgados que llaman a las acciones de la callable (no duplicar lógica).
5. Redirects desde `/dashboard?tab=…` y `/dashboard/courses/[id]/…`; `useDeepLinks` y LTI aterrizan en las nuevas URLs.

### Fase 6 — Cierre de cursada y actas (UC-D17) (1,5 semanas)

1. **Simulador** que corre `computeAcademicCondition` sobre todo el padrón con las reglas vigentes o con reglas hipotéticas, sin escribir.
2. **Detector de casos borde**: alumnos a ≤ 1 punto o ≤ 1 TP de promocionar/regularizar (sale gratis de `distance_to_*` en 2.5).
3. **Congelamiento de acta**: `course_closures/{courseId}` con snapshot inmutable (condición por alumno, reglas usadas, hash SHA-256 del contenido), `audit_logs`, y bloqueo de escritura de notas/asistencia posterior salvo reapertura por titular con justificación.
4. Export del acta en CSV formato SIU Guaraní, que el docente carga en el sistema (la emisión automática 3.43 queda para la Fase 8).

### Fase 7 — Rendimiento, modularización y TypeScript (continuo)

- 4.01/4.04 virtualización con `@tanstack/react-virtual` en grilla de alumnos e hilos de comentarios.
- 2.02/2.03 partir `CourseSchedulesPanel.tsx` (1102 líneas) y `AssignmentsPanel.tsx` (628) — conviene hacerlo **antes** de tocar el Kanban/diff o la cola de corrección.
- 3.01 migrar `functions/` a TypeScript ESM, empezando por los módulos nuevos (alertas, LTI, condición) y consumiendo `shared/domain/`.
- 4.13 SWR entre pestañas; 4.29 Web Workers para CSV masivos (comparte worker con 4.5).
- Eliminar `any` remanente (2.01).

### Fase 8 — Testing moderno, observabilidad y SIU (continuo / final)

- 5.01 Playwright contra emuladores reales (Auth + Firestore + Functions + `seed.sh`), con `@axe-core/playwright`; migrar módulos de Selenium a medida que se tocan sus pantallas. Escenarios prioritarios: launch LTI, QR completo, condición/cierre, TA por comisión.
- 5.07 Sentry con source maps privados en Next y Functions.
- 3.43 emisión automatizada de actas a SIU Guaraní: sujeta a que el docente obtenga acceso a la API institucional; mientras tanto alcanza el CSV de la Fase 6.
- Complementos de producto de menor prioridad: integración YouTube (UC-D06, requiere verificación de la app OAuth de Google por el scope `youtube`), salas Meet reales para tutorías vía Google Calendar API (`conferenceData`), accesibilidad por teclado del Kanban.

---

## 3. Calendario orientativo

| Semanas | Trabajo |
|---|---|
| 1–2 | F0 completa · inicio F5 (slugs y alias) |
| 3–4 | F1 |
| 5–7 | F2 · partición de `AssignmentsPanel` (F7) |
| 8–10 | F3 (con Moodle de pruebas desde la semana 5) |
| 11–13 | F4 · cierre F5 |
| 14–15 | F6 |
| continuo | F7, F8 |

Hito para un cuatrimestre real: **F0 + F1 + F2 + F6** dan el valor académico central (condición y actas) aun sin LTI 1.3; F3 se puede lanzar detrás de flag cuando la UNRN registre la herramienta.

---

## 4. Decisiones tomadas (22/10/2026)

| # | Tema | Decisión | Impacto en el plan |
|---|---|---|---|
| 1 | Identificador público del alumno | Alias nuevo `st_` + 10 hex aleatorios | F5.2 |
| 2 | Tolerancia de entregas | Horas corridas | F2.1, F2.4: sin calendario hábil |
| 3 | XP por nota | `Nota × 5` incluye parciales y recuperatorios | F0.2 |
| 4 | Parciales | Colección separada `assessments` + `assessment_grades` | F2.2, F2.5, F3.8 |
| 5 | Rutas LTI | Endpoints con la terminología de LTI 1.3 / Security Framework (login initiation, redirect URI, JWKS, deep linking, dynamic registration) bajo `/api/v1/lti/*` | F3 |
| 6 | Registro en Moodle y SIU | Lo gestiona el docente | F3.1 autoservicio + Dynamic Registration, F3.10 guía, F6.4 / F8 SIU vía CSV |

Queda abierto un punto menor: si las notas conceptuales (`Aprobado`, `Promocionado`) suman XP. Por ahora no suman: la fórmula usa solo notas numéricas.

---

## 5. Riesgos

| Riesgo | Mitigación |
|---|---|
| Migración de asistencia (0.1) corrompe historial | Script idempotente con `--dry-run`, backup previo con `createSystemBackup`, verificación de conteos. |
| Cookies de terceros bloqueadas en el iframe de Moodle rompen `state` | Lanzar en ventana nueva por defecto o usar el "LTI Platform Storage" (postMessage) cuando Moodle lo soporte. |
| Costos de Firestore del motor de alertas diario | Cálculo por curso en un único job, lecturas por colección (no N+1 como hoy en `checkAndAlertStudentsAtRisk`), checksum para saltar cursos sin cambios. |
| Cambio de reglas a mitad de cuatrimestre altera condiciones | Versionar `grading_rules` con fecha de vigencia y mostrar diff antes de guardar. |
| El rol del docente en el Moodle de la UNRN no permite agregar herramientas LTI 1.3 (en muchos campus eso es exclusivo del administrador del sitio) | Verificarlo apenas arranque F3; la guía 3.10 incluye qué datos pasarle al administrador (URLs de registro/JWKS) para que haga el alta. |
| Revisión de la app de Google para YouTube demora semanas | Dejarlo para el final; no bloquea nada. |
