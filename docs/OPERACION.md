# Manual de Operación — Ninja Dojo

Despliegue, monitoreo, respaldos y tareas operativas de la plataforma en producción. Para el desarrollo local ver [DEVELOPMENT.md](DEVELOPMENT.md); para los contratos de API, [API.md](API.md).

---

## 1. Entornos

| Componente | Dónde corre | Cómo se despliega |
|---|---|---|
| App Next.js (SSR + rutas `/api/*`) | Firebase App Hosting | Integración git: cada push a `main` compila y publica |
| Cloud Functions (`api`, `webhook`, `importGrades`, `calendar`, `sendDailySummaries`) | Cloud Functions v2, Node 22 | `firebase-deploy.yml` en cada push a `main` |
| Reglas e índices de Firestore | Cloud Firestore | `firebase-deploy.yml` en cada push a `main` |

Proyecto Firebase: `jutsu-classroom-mrtin` (alias `jutsu-main` en `.firebaserc`).

> Todo push a `main` despliega a producción. Mergeá solo con los 4 checks en verde.

## 2. Despliegue

### 2.1. Automático (recomendado)

1. Abrir un PR contra `main` y esperar los 4 checks obligatorios.
2. Mergear. `firebase-deploy.yml` compila la app (verificación), instala `functions/` y ejecuta `firebase deploy --only functions,firestore --force`.
3. App Hosting publica la nueva versión de la app en paralelo.
4. Verificar el despliegue (§3).

Secretos de GitHub Actions requeridos: `FIREBASE_SERVICE_ACCOUNT_JUTSU_CLASSROOM_MRTIN` (o `FIREBASE_SERVICE_ACCOUNT` / `GCP_SA_KEY`) y las variables `NEXT_PUBLIC_FIREBASE_*` del build.

### 2.2. Manual

```bash
firebase login
firebase use jutsu-main
firebase deploy --only firestore:rules        # solo reglas
firebase deploy --only firestore:indexes      # solo índices (incluye la política TTL)
firebase deploy --only functions:api          # una función
firebase deploy --only functions,firestore    # todo el backend
```

Antes de desplegar reglas a mano, correr `npm run test:rules`.

### 2.3. Rollback

- **App**: en la consola de App Hosting, volver a desplegar el *rollout* anterior.
- **Functions / reglas**: `git revert <sha>` en una rama, PR y merge. El workflow redespliega el estado anterior.

## 3. Monitoreo y verificación post-despliegue

| Qué | Cómo | Esperado |
|---|---|---|
| Disponibilidad | `curl -s -o /dev/null -w '%{http_code}' https://<dominio>/api/health` | `200` |
| Dependencias externas | `curl -s https://<dominio>/api/health?deep=1` | `status: "ok"` (`"degraded"` si GitHub no responde) |
| Callable `api` | Login y abrir **Mis Cátedras** | Lista de cursos sin errores |
| Feed iCal | **Cronograma → 📅 Suscribirse a Calendario** y abrir la URL | Archivo `VCALENDAR` |
| Logs de Functions | `firebase functions:log --only api` | Sin `[API Error]` nuevos |

Configurá un monitor externo (Uptime Kuma, Cloud Monitoring) contra `/api/health` cada 1–5 min con alerta ante `503` o timeout. La respuesta no expone datos sensibles.

En los logs, `[API Call]` / `[API Error]` incluyen la acción y el `uid`. Los payloads se recortan y se redactan las claves con aspecto de secreto.

## 4. Tareas programadas y mantenimiento automático

| Tarea | Frecuencia | Notas |
|---|---|---|
| `sendDailySummaries` | Diaria, 20:00 ART | Resumen de notificaciones pendientes por estudiante |
| `purgeDeletedCourses` | Diaria, 03:00 ART | Borra en cascada las cátedras eliminadas hace más de 30 días |
| `cleanupAssignmentData` | Al borrar una tarea | Limpia sus entregas y revisiones entre pares |
| `retryWebhookDeadLetters` | Cada 10 min | Reintenta las notas de autograding que fallaron por errores transitorios. Los eventos agotados quedan en `webhook_dead_letters` con `status: failed` para revisión manual |
| TTL de `processed_webhooks` | Continua | Firestore borra los marcadores de idempotencia del webhook cuando vence `expires_at` (30 días). La política está en `firestore.indexes.json` |
| Dependabot | Semanal | Auto-merge de parches (`dependabot-automerge.yml`) |
| `security.yml` | Cada PR, push y los lunes 09:00 UTC | `npm audit --audit-level=high` (app y functions) + CodeQL |

## 5. Respaldos

Desde **Respaldos** (panel de administrador) o con la acción `createSystemBackup`:

- El respaldo es una instantánea de las colecciones `courses`, `assignments` y `profiles` guardada **como un único documento** en `backups`.
- **No incluye** entregas (`submissions`), asistencia, avisos, foros, notas históricas ni subcolecciones.
- Firestore limita cada documento a 1 MiB, así que con muchos usuarios o cursos el respaldo puede fallar.
- El JSON incluye los campos sensibles de los cursos (token de GitHub, credenciales de Moodle). **Tratá el archivo descargado como un secreto.**

**Restauración granular**: elegí colección y documento en **Respaldos → Restauración Granular**. Solo pisa ese documento.

**Respaldo completo recomendado** (además del integrado): exportaciones programadas de Firestore a Cloud Storage.

```bash
gcloud firestore export gs://<bucket>/backups/$(date +%F) --project jutsu-classroom-mrtin
```

## 6. Secretos y credenciales

| Secreto | Dónde vive | Quién lo ve | Rotación |
|---|---|---|---|
| `sync_secret` del curso | `courses/{id}` | Equipo docente | Borrar el campo en la consola de Firestore: se regenera en la siguiente apertura del curso. Invalida las URLs de planillas CSV, la importación de notas y los feeds iCal que lo usen |
| `calendar_secret` del curso | `courses/{id}` | Docentes y estudiantes | Igual que el anterior; invalida las suscripciones iCal de los estudiantes |
| `sync_secret` de la tarea | `assignments/{id}` | Equipo docente | Lo usa el workflow de autograding; actualizar el secret del repo tras rotarlo |
| Token de GitHub (PAT) | `courses/{id}.github_token`, cifrado con AES-256-GCM (`enc:v1:…`) si hay `TOKEN_ENCRYPTION_KEY` | Solo backend (nunca se devuelve al cliente) | Generar un PAT nuevo con `repo`, `admin:org` y guardarlo en **Ajustes Cátedra** |
| `TOKEN_ENCRYPTION_KEY` | Secret Manager (ver §6.1) | Cloud Functions | **No se rota sin re-cifrar**: los tokens guardados dependen de ella |
| Token de Moodle (`wstoken`) | Curso | Solo backend | Rotarlo en Moodle y actualizarlo en la integración Moodle |
| OAuth de Gmail | Functions (`GMAIL_CLIENT_ID/SECRET`) + tokens por docente | Backend | Reautorizar desde **Mi Perfil → Autorización de Gmail** |

La UI no tiene un botón de rotación (ver [ROADMAP H8](ROADMAP.md)). Los secretos viejos de 8 caracteres siguen siendo válidos hasta que se regeneren. El detalle de esa migración está en el [Runbook CSV](RUNBOOK_DESPLIEGUE_CSV.md).

## 7. Gestión de cuentas

- Las cuentas nuevas se crean como **estudiante pendiente**. Un estudiante se aprueba solo al validar una matrícula `UNRN-#####`; en cualquier otro caso lo aprueba un administrador en **Usuarios**.
- **Alta de un docente**: el administrador cambia el rol a *Profesor* en **Usuarios** y lo asigna a la cátedra en **Cátedras → (cátedra) → Docentes**.
- **Baja**: **Usuarios → 🗑️**. Es irreversible: borra la cuenta de Auth, el perfil, las filas de `course_roster` y las asignaciones docentes. Las entregas y notas históricas se conservan, y los documentos de `enrollments` quedan huérfanos (ver [ROADMAP H7](ROADMAP.md)).

## 8. Incidentes frecuentes

| Síntoma | Diagnóstico | Acción |
|---|---|---|
| `/api/health` devuelve `503` | Firestore no responde o faltan credenciales del Admin SDK en App Hosting | Revisar el estado de Firebase y la cuenta de servicio de App Hosting |
| Los estudiantes no pueden firmar asistencia | QR vencido (> 45 s), GPS > 150 m o curso sin inscripción | Generar un QR nuevo; si no hay GPS, cargar la asistencia a mano en **📋 Control de Asistencia** |
| El autograding no registra notas | `401`: `sync_secret` de la tarea incorrecto; `429`: demasiados fallos desde la IP | Actualizar el secret del workflow; esperar 5 min |
| No se crean repositorios al aceptar tareas | PAT vencido o sin permisos sobre la organización | Renovar el PAT en **Ajustes Cátedra** |
| Las notas no llegan a Moodle | Moodle deshabilitado en el curso, nota conceptual (no numérica) o URL de outcome no HTTPS | Revisar la integración Moodle de la cátedra |
| `security.yml` en rojo | Advisory nuevo en una dependencia | `npm audit fix` sin `--force`; si requiere un salto de versión, abrir PR dedicado (ver [ROADMAP §2.2](ROADMAP.md)) |
