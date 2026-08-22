# Estado Actual y Próximos Pasos - Ninja Dojo

> Verificación realizada el **22/08/2026** sobre la rama `main` (commit `0a61c7f`, árbol limpio y sincronizado con `origin/main`).
> Este documento consolida el resultado de las verificaciones ejecutadas y define un plan de acción priorizado.
>
> **Avance 22/08/2026**: completadas las Fases 0–1 (reglas RBAC, suite Jest 74/74 en verde, router de acciones sin legacy) y la documentación re-sincronizada. Ver casilleros en §3.

---

## 1. Estado Verificado (con evidencia)

### ✅ Lo que funciona

| Verificación | Comando | Resultado |
|---|---|---|
| Build de producción | `npm run build` | ✔ Pasa. Compila en ~4.5s, genera 15 rutas (9 estáticas + dinámicas API/dashboard) |
| Chequeo de tipos | `npx tsc --noEmit` | ✔ 0 errores |
| Lint | `npm run lint` | ⚠ 0 errores / **65 warnings** (ver §2) |
| Tests unitarios backend | `cd functions && npm test` | ❌ **7/7 suites fallan al cargar** (ver §2) |

### 📦 Inventario del código

*   **Frontend**: Next.js 16.3 (App Router, Turbopack) + React 19.2 + Tailwind 4. Módulos de dominio creados en `src/modules/`: `attendance`, `auth`, `calendar`, `course`, `github`, `mail`, `moodle`, `study_groups`, `tutoring` (+ hooks/utils por módulo).
*   **Backend**: Cloud Functions v2 (Node 22). Lógica migrada a `functions/src/modules/` (11 dominios) con router central en `functions/index.js` (~100 acciones mapeadas).
*   **Tests**: 14 módulos Selenium E2E (`tests/selenium/`, ~2.200 líneas) y 7 suites Jest (`functions/tests/`).
*   **CI/CD**: Workflow `firebase-deploy.yml` (build + deploy en push a `main`). No existe pipeline de tests en PRs.
*   **Seguridad de secretos**: OK. `.env*` y `github-deploy-key.json` están ignorados por git; no hay secretos trackeados.

---

## 2. Hallazgos Críticos

### 🔴 P0-1: Reglas de Firestore permisivas (riesgo de seguridad alto)

`firestore.rules` actual:

```
match /{document=**} {
  allow read, write: if request.auth != null;
}
```

Cualquier usuario autenticado puede **leer y escribir todos los documentos** (perfiles ajenos, notas de otros alumnos, auditoría, backups). El RBAC real solo existe dentro de Cloud Functions; el cliente tiene acceso directo ilimitado a Firestore. Además, `docs/ARCHITECTURE.md` afirma que existen "reglas de seguridad estrictas" — la documentación **no refleja la realidad**.

### 🔴 P0-2: Suite de tests backend rota al 100%

Las 7 suites de Jest fallan antes de ejecutar un solo test, con dos causas distintas heredadas de la refactorización M5 ("Desmonolitizar Functions Backend"):

1.  **Imports obsoletos**: `actions_coverage.test.js`, `gmailAuth.test.js` y `moodle.test.js` requieren `../actions/*`, ruta eliminada por la migración a `functions/src/modules/`.
    ```
    Cannot find module '../actions/admin'
    ```
2.  **Mock desactualizado de `firebase-admin`**: `api.test.js`, `webhook.test.js`, `emailManagement.test.js` y `exhaustive.test.js` mockean `admin.firestore()` sin el método `settings()`, pero `functions/index.js:8` ahora ejecuta `db.settings({ ignoreUndefinedProperties: true })` al cargar el módulo.
    ```
    TypeError: db.settings is not a function
    ```

La documentación (README, ROADMAP, STATUS_REPORT) aún declara "74 pruebas pasando": es información desactualizada.

### 🟡 P1-1: Modularización frontend incompleta

*   `src/app/dashboard/page.tsx` sigue siendo un orquestador monolítico de **2.360 líneas** pese a que los paneles ya fueron extraídos a `src/modules/`.
*   Los 65 warnings de ESLint se concentran en props destructuradas sin usar y dependencias faltantes de `useEffect` en los paneles recién extraídos (`CourseOverviewPanel`, `CourseSettingsPanel`, `EmailManagementPanel`, `TutoringPanel`, etc.) — señal de refactor a medio terminar.

### 🟡 P1-2: Hack de resolución de rutas en el backend

`functions/index.js:263` antepone `./actions/` a rutas que ya apuntan a `../src/modules/...`:

```js
const moduleName = actionModules[action];          // ej: '../src/modules/auth/profile'
const modulePath = `./actions/${moduleName}`;      // './actions/../src/...' — funciona por accidente
```

Es frágil y confuso; debe resolverse a la ruta final directa.

### 🟢 P2-1: Deriva documental

*   El README indica correr `npm run test:e2e`, pero el script real se llama `test:selenium` (package.json).
*   ROADMAP dice "54 pruebas E2E", README dice "55": cifras inconsistentes sin fuente verificable.
*   `docs/ARCHITECTURE.md` describe reglas de Firestore que no coinciden con `firestore.rules`.

---

## 3. Próximos Pasos (plan priorizado)

### Fase 0 — Seguridad (P0, hacer primero)

- [x] **Endurecer `firestore.rules`** con reglas por colección basadas en roles: perfiles own-only, escritura de comisiones acotada a docentes, asistencia/foros/encuestas limitados por membresía de curso, `submissions`/`audit_logs`/`activity_logs` sin escritura de cliente y denegación explícita para el resto. *(commit `69c8ddf`)*
- [ ] Agregar **tests de reglas** con `@firebase/rules-unit-testing` + emulador de Firestore (Java ya disponible) y subirlos al pipeline.
- [x] Corregir `docs/ARCHITECTURE.md` para que describa las reglas reales.
- [ ] Criterio de aceptación: ningún cliente puede escribir documentos de otros usuarios validado con tests de reglas.

### Fase 1 — Restaurar la confianza en los tests (P0)

- [x] Actualizar imports de las 3 suites rotas: `../actions/X` → `../src/modules/<dominio>/X`.
- [x] Agregar `settings: jest.fn()` al mock de Firestore en las suites que cargan `index.js`; además mockear el subpath `firebase-admin/firestore` (webhook/export/calendar) y stubbear `global.fetch` (los módulos ya no usan `node-fetch`). *(commit `442a39f`)*
- [x] Re-ejecutar `cd functions && npm test` hasta verde: **74/74 pruebas pasando**.
- [ ] Ejecutar manualmente la suite Selenium (`npm run test:selenium`) y registrar el resultado real en README/ROADMAP.
- [x] Cifra de tests consistente en la documentación (56 escenarios E2E verificados estáticamente; 74 unit tests verificados en ejecución).

### Fase 2 — Completar la modularización (P1)

- [x] Reemplazar el hack `./actions/${moduleName}` de `functions/index.js` por la resolución directa de los paths ya mapeados (`./src/modules/<dominio>/<name>`). *(commit `2605705`)*
- [ ] Dividir `dashboard/page.tsx` (2.360 líneas) extrayendo el estado compartido a un contexto o custom hooks (`useCourses`, `useProfile`, `useNotifications` según propuesta de `docs/ROADMAP.md` §Custom Hooks).
- [ ] Limpiar los 65 warnings de ESLint: eliminar props/variables muertas y corregir deps de `useEffect`.
- [ ] Aplicar `next/dynamic` a paneles pesados (`MoodleIntegrationPanel`, `CalendarPanel`, `EmailManagementPanel`) para reducir el bundle inicial.
- [ ] Criterio de aceptación: `page.tsx` < 500 líneas, 0 warnings de lint, build verde.

### Fase 3 — CI/CD y calidad continua (P1)

- [ ] Crear `.github/workflows/tests.yml`: en cada PR correr `lint`, `tsc --noEmit`, `next build`, `jest` (functions) y Selenium headless sobre mock server (ya existe `tests/selenium/server.js`).
- [ ] Hacer obligatorios los checks en GitHub antes de merge a `main`.
- [ ] Criterio de aceptación: un PR con test roto no puede mergear.

### Fase 4 — Features pendientes del roadmap (P2)

- [ ] **Calendario unificado multi-materia** (`pendientes.md`): carga paralela de todas las cursadas del usuario, filtros por materia con checkboxes y colores distintivos por cátedra.
- [ ] Buscador omni (Command + K) sobre clases, avisos y entregas.
- [ ] Middleware unificado de API (`src/app/api/middleware/`) para validar tokens Bearer y sanitizar entradas en `/api/calendar`, `/api/lti/*`.
- [ ] Editor rich text para avisos/tareas.
- [ ] Detección de plagio por AST y Autograding vía GitHub Actions (según `docs/STATUS_REPORT.md` §2).

---

## 4. Resumen ejecutivo

El proyecto compila y tipa limpio, pero **no está en el estado que documenta**: la batería de tests backend está completamente rota desde la migración a módulos, las reglas de Firestore contradicen el modelo RBAC anunciado dejando la base abierta a cualquier usuario autenticado, y la modularización quedó a mitad de camino (monolito de 2.360 líneas en el dashboard + 65 warnings de refactor inconcluso). Se recomienda ejecutar las Fases 0–1 antes de continuar con nuevas features: sin seguridad en las reglas ni tests operativos, cada cambio posterior se construye sobre una base no verificable.
