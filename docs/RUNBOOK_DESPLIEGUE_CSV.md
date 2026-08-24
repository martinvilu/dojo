# Runbook: Despliegue y Acciones Manuales

> Cubre los cambios pendientes en dos áreas: **(A)** endurecimiento de `sync_secret` + anti fuerza bruta del webhook, y **(B)** unificación de los exports CSV en `GET /api/export/csv` (App Router).
> Verificado sobre rama `main` local con 32 commits sin pushear + cambios sin commitear.

---

## Paso 0 — Commitear los cambios pendientes

`git status` muestra dos grupos lógicos. Commitearlos separados para poder revertir uno sin afectar al otro:

```bash
# Commit A: seguridad (sesión anterior)
git add functions/src/modules/course/courses.js \
        functions/src/modules/github/assignments.js \
        functions/src/modules/github/webhook.js
git commit -m "fix(security): strengthen sync_secret generation and throttle webhook"

# Commit B: unificación CSV (sesión actual)
git add src/app/api/export/csv/route.ts \
        src/app/api/middleware/api.ts \
        src/modules/course/components/CourseSettingsPanel.tsx \
        src/modules/course/components/CourseStudentsPanel.tsx \
        public/js/app.js \
        functions/index.js \
        functions/src/modules/course/export.js \
        functions/tests/api.test.js \
        docs/ROADMAP.md \
        docs/RUNBOOK_DESPLIEGUE_CSV.md
git commit -m "feat(api): unify CSV exports into App Router /api/export/csv"
```

Sanity check antes de pushear (todo debe pasar):

```bash
(cd functions && npm test)     # 90/90
npx tsc --noEmit               # 0 errores
npm run lint                   # 0 errores
npm run build                  # genera la ruta ƒ /api/export/csv
```

## Paso 1 — Push y orden de despliegue

Un solo push dispara **dos pipelines en paralelo**:

| Pipeline | Disparador | Qué despliega |
|---|---|---|
| `firebase-deploy.yml` | push a `main` | Cloud Functions + Firestore rules (`deploy --only functions,firestore`) |
| Integración git de App Hosting | push a `main` | Frontend Next.js (incluye `/api/export/csv`) |

Mientras ambos terminan (~5–10 min), existe una ventana donde las URLs viejas ya no responden y las nuevas todavía no están. Es esperado; no revertir por eso.

Si hiciera falta deploy manual desde una máquina con credenciales del proyecto:

```bash
firebase deploy --only functions,firestore              # backend
firebase apphosting:rollouts:create dojo                # frontend (App Hosting)
```

En el output del deploy de Functions, confirmar que aparecen como eliminadas:

```
-  deleting function(s)... exportGradesCsv, exportAttendanceCsv
```

## Paso 2 — Verificación post-deploy

Obtener un `courseId` y su `sync_secret` de la colección `courses` en la consola de Firestore, luego:

```bash
APP=https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app

# 1. Sin token → debe responder 401
curl -s -w '\n' "$APP/api/export/csv?courseId=CURSO_ID"

# 2. Token inválido → 401
curl -s -o /dev/null -w '%{http_code}\n' "$APP/api/export/csv?courseId=CURSO_ID&token=TOKEN_FALSO"

# 3. Token válido → 200 y encabezado CSV (probar los 3 tipos)
for t in grades attendance roster; do
  curl -sD - "$APP/api/export/csv?courseId=CURSO_ID&type=$t&token=SECRETO" -o /tmp/out.csv | grep -E 'HTTP|content-type|content-disposition'
  head -1 /tmp/out.csv
done

# 4. Alias legacy → 200 (compatibilidad)
curl -s -o /dev/null -w '%{http_code}\n' "$APP/api/export/csv?id=CURSO_ID&type=asistencia&token=SECRETO"
curl -s -o /dev/null -w '%{http_code}\n' "$APP/api/export/csv?id=CURSO_ID&type=alumnos&token=SECRETO"

# 5. Endpoint viejo → debe responder 404 tras el deploy de Functions
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/exportGradesCsv?courseId=CURSO_ID&token=SECRETO"
```

Además, en la app: abrir **Configuración de cátedra → Sincronización CSV** y **Alumnos → Endpoint CSV**: las URLs mostradas deben apuntar al dominio propio (`/api/export/csv?...`), no a `cloudfunctions.net`.

### Troubleshooting de la verificación

| Síntoma | Causa probable | Acción |
|---|---|---|
| Checks 1–4 dan **404** | La build de App Hosting con la ruta nueva **no está desplegada** (push pendiente, rollout en curso o fallido) | Verificar build marker (abajo) y estado del rollout; reintentar cuando termine |
| Check 1 da 400 | Falta el parámetro `courseId` en la URL probada | Revisar el curl |
| Check 2 da **500** en local | Sin credenciales ADC (`gcloud auth application-default login`) — solo afecta a `npm run dev`, no a producción | Autenticarse o probar contra el entorno desplegado |
| Checks dan 500 en producción | Credenciales del backend de App Hosting | Revisar logs en consola Firebase → App Hosting → Logs |

**Build marker**: para saber qué versión está sirviendo App Hosting, consultar una ruta que solo exista en builds recientes:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$APP/api/me"
# 401 o 405 = build nueva (ruta existe); 404 = build vieja, el rollout aún no aplicó
```

Verificación local sin deploy (los checks 1 y 4 funcionan igual):

```bash
npm run dev &
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/api/export/csv?courseId=X"   # 401
```

Estado del rollout:

```bash
firebase apphosting:backends:list
firebase apphosting:rollouts:create dojo   # forzar un rollout nuevo
```

## Paso 3 — Comunicar a los docentes (obligatorio)

Las URLs absolutas que los docentes copiaron antes a Google Sheets (`=IMPORTDATA("https://us-central1-....cloudfunctions.net/exportGradesCsv?...")`) van a dejar de responder. Mensaje sugerido:

> Se migró el endpoint CSV de notas/asistencia/alumnos al dominio propio. Entrá a tu materia → Configuración (o Alumnos) → "Mostrar URL", copiá la nueva URL y actualizala en tus hojas de cálculo. La vieja deja de funcionar.

Los tokens siguen siendo los mismos; solo cambia el host y el path (`/api/export/csv` + `type=`).

## Paso 4 — Rotación de secrets débiles (recomendado, opcional)

Los cursos/tareas existentes conservan su secret viejo de 8 caracteres hasta rotarse (los nuevos se generan con 32 hex chars vía `crypto.randomBytes`). Para rotar:

```bash
openssl rand -hex 16   # generar valor nuevo
```

- **Cursos**: consola de Firestore → `courses/{courseId}` → reemplazar el campo `sync_secret`.
- **Tareas**: `assignments/{assignmentId}` → campo `sync_secret` (estas NO se regeneran solas al leerse).
- Alternativa para cursos: borrar el campo `sync_secret` → la próxima apertura de Configuración de cátedra lo regenera fuerte automáticamente.

⚠️ Rotar invalida las URLs guardadas de ese curso/tarea (401 hasta actualizarlas). Si se hace, hacerlo junto con la comunicación del Paso 3.

## Rollback

Cada área se revierte independiente:

```bash
git revert <sha-commit-A>   # seguridad: vuelve a Math.random() de 8 chars y saca el throttle
git revert <sha-commit-B>   # CSV: vuelven las Cloud Functions exportGradesCsv/exportAttendanceCsv
git push                    # redespliega ambas pipelines
```

Tras revertir B, verificar que el endpoint viejo responde nuevamente 200.
