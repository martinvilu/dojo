# Roadmap y Estado del Proyecto — Ninja Dojo

> **Única fuente de verdad** para el estado del proyecto, el backlog priorizado y el historial de hitos.
> Última verificación: **23/08/2026** sobre la rama `main`.

Otros documentos: [Arquitectura](ARCHITECTURE.md) · [Guía de Desarrollo](DEVELOPMENT.md) · [Runbook de Despliegue](RUNBOOK_DESPLIEGUE_CSV.md) · [Manual de Usuario](../manual/index.md)

---

## 1. Estado verificado

| Check | Comando | Resultado |
|---|---|---|
| Build de producción | `npm run build` | ✔ 15 rutas |
| Chequeo de tipos | `npx tsc --noEmit` | ✔ 0 errores |
| Lint | `npm run lint` | ✔ 0 errores |
| Tests unitarios backend | `cd functions && npm test` | ✔ 90 pruebas / 9 suites |
| Reglas de Firestore | `npm run test:rules` | ✔ 23 escenarios (emulador) |
| E2E Selenium | `npm run test:selenium` | ✔ 56 escenarios / 14 módulos (mock server) |

**CI/CD**: cada PR corre 4 jobs obligatorios (Frontend, Backend, Security/E2E — `.github/workflows/tests.yml`); cada push a `main` despliega Functions+Rules (`firebase-deploy.yml`) y App Hosting despliega por integración git.

---

## 2. Seguridad implementada

*   **Firestore RBAC**: reglas por colección (perfiles own-only, escrituras privilegiadas solo vía Cloud Functions) con suite de regresión contra emulador.
*   **Tokens de suscripción fuertes**: `sync_secret` de 32 hex chars (`crypto.randomBytes`) para cursos y tareas; los viejos de 8 chars siguen válidos hasta rotarse (ver runbook).
*   **Anti fuerza bruta**: throttle en el webhook de autograding (10 intentos fallidos / 5 min por IP).
*   **Endpoints externos unificados**: iCal (`/api/calendar`) y CSV (`/api/export/csv`) tras el middleware compartido `requireCourseSubscriptionToken`; Bearer JWT disponible (`requireBearerUser`) para rutas con identidad de usuario.

---

## 3. Backlog priorizado

### 🔴 Prioridad alta
1.  **Tests E2E contra la app real**: hoy Selenium valida contra mock server. Agregar un modo contra `firebase emulators:exec` (Auth+Firestore+Functions) con datos seed para cubrir login real, permisos y flujos end-to-end.
2.  **Verificación manual de UI sin cobertura automatizada**: deep-links LTI, detalle de curso por rol, encuestas anónimas y paleta ⌘K.

### 🟡 Prioridad media
3.  **Completar modularización del dashboard**: dividir `dashboard/page.tsx` por debajo de 500 líneas. Ya se extrajeron 8 hooks a `src/app/dashboard/hooks/` (~2.356 → ~1.940 líneas); quedan deep-links/params, carga de detalle de curso y estados de perfil.
4.  **Detección de plagio v2**: winnowing para repos grandes y resaltado de fragmentos coincidentes (v1: fingerprints k-gram ya en producción).
5.  **Autograding avanzado**: detección automática del runner según archivos del repo y feedback estructurado por test fallido (plantillas Node/pytest listas).
6.  **Adoptar `requireBearerUser`** a medida que se sumen rutas API con identidad de usuario.

### 🟢 Exploratorias
7.  Asistente pedagógico de corrección con IA (Gemini API) sobre diffs de entregas.
8.  Predicción de abandono con analítica temprana (asistencia + entregas + foro).
9.  Tablero de métricas GitHub por alumno (frecuencia de commits, horarios, PRs).
10. Evaluación entre pares (peer review con rúbricas) y portafolio público de proyectos.

---

## 4. Historial de hitos

Condensado; el detalle fino vive en `git log`.

| Hito | Commits |
|---|---|
| Modularización frontend/backend por dominios (`src/modules/`, `functions/src/modules/`, M1–M5) | base del árbol actual |
| Hardening de dependencias y limpieza de lint/a11y (65 warnings → 0) | `af32f38`, `0b488f1`, `8cd7f4c` |
| Firestore RBAC estricto + suite de reglas en CI (23 escenarios) | `69c8ddf`, `9763b71`, `46e261c` |
| Reparación de la suite Jest tras la migración a módulos | `442a39f`, `2605705` |
| CI completo: 4 jobs obligatorios en PR + branch protection en `main` | `aad3c72`, `51935cb` |
| Calendario multi-materia, feed iCal real con token, ⌘K, toolbar Markdown | `74f8d85`, `1679951`, `b82b0d1`, `9356f83`, `eca7c82` |
| Hooks de dominio extraídos del dashboard (8 hooks, −420 líneas) | `fd403ea`…`4d3c851` |
| Detección de plagio v1 (k-gram fingerprinting) | `42b806c` |
| Middleware Bearer JWT + plantillas de autograding Node/pytest | `097f0de`, `4fe77a3` |
| Cierre de fuga de credenciales de curso y backdoor de seed | `369c442` |
| Unificación de exports CSV en `/api/export/csv` (App Router) | pendiente de commit |
