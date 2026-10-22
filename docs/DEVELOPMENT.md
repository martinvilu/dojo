# Guía de Desarrollo — Ninja Dojo

Setup, convenciones y pruebas del proyecto. Para arquitectura ver [ARCHITECTURE.md](ARCHITECTURE.md); para el estado y backlog, [ROADMAP.md](ROADMAP.md).

---

## 1. Setup

```bash
npm install          # frontend (Next.js 16, React 19)
cd functions && npm install   # backend (Cloud Functions, Node 22)
npm run dev          # servidor local en http://localhost:3000
```

Requisitos: Node.js 22+, Firebase CLI (`npm install -g firebase-tools`), Chrome/ChromeDriver para Selenium.

### Clave de cifrado de credenciales

La callable `api` cifra con AES-256-GCM los tokens de GitHub y Gmail (`functions/src/lib/encryption.js`) y necesita el secreto `DOJO_ENCRYPTION_KEY` (32 bytes en hex). Para el emulador, crear `functions/.secret.local` (ignorado por git):

```bash
echo "DOJO_ENCRYPTION_KEY=$(openssl rand -hex 32)" > functions/.secret.local
```

Sin la clave, guardar un token falla con un error explícito (nunca se guarda en claro); los tokens legados en claro se siguen leyendo hasta correr la migración.

## 2. Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `build` | Desarrollo / build de producción |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `cd functions && npm test` | Suite Jest del backend (292 pruebas / 29 suites) |
| `npm run test:rules` | Reglas de Firestore contra emulador (24 escenarios) |
| `npm run test:selenium` | E2E Selenium sobre mock server (56 escenarios) |
| `npm run test:local` | Batería local completa (`scripts/test-local.sh`) |

Los flujos por rol están automatizados en `tests/selenium/` (14 módulos); las guías paso a paso de usuario viven en [`manual/`](../manual/index.md). Antes de cambios masivos en la base de datos, correr siempre la suite de reglas.

## 3. Commits semánticos

Usamos [Conventional Commits 1.0](https://www.conventionalcommits.org/es/v1.0.0/). El historial se lee como un changelog: cada commit es **un cambio coherente que compila y pasa los tests por sí solo**.

### 3.1 Formato

```
<tipo>(<ámbito>): <resumen en imperativo, en inglés, sin punto final>

<cuerpo opcional: qué cambia y POR QUÉ, en párrafos de ~72 columnas>

<pies opcionales: BREAKING CHANGE, referencias, co-autores>
```

*   **Resumen**: ≤ 72 caracteres, minúscula inicial, imperativo (`add`, `fix`, `encrypt`; no `added` ni `adds`). Si implementa una propuesta de `mejoras.md`, terminar con su número: `(mejora 3.18)` o `(mejoras 1.01, 1.02)`.
*   **Cuerpo**: explica el motivo y el efecto observable, no repite el diff. Obligatorio en `fix` (qué fallaba y en qué caso) y en cambios de seguridad o de datos.
*   **Idioma**: resumen y cuerpo en inglés, como el resto del historial; la documentación del repo sigue en castellano.

### 3.2 Tipos

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| `feat` | Funcionalidad nueva visible para usuarios o integraciones | `feat(attendance): rotate QR codes server-side with TOTP sessions (mejora 3.18)` |
| `fix` | Corrige un comportamiento incorrecto | `fix(github): bucket weekly commit metrics in local time` |
| `perf` | Mejora de rendimiento sin cambio funcional | `perf(attendance): lazy-load the QR scanner and html5-qrcode (mejora 4.27)` |
| `refactor` | Reestructura sin cambiar comportamiento | `refactor(dashboard): extract useCourseRealtime hook` |
| `test` | Solo tests | `test(rules): cover backend-only academic collections` |
| `docs` | Solo documentación | `docs(plan): record phase 1 and 2 progress` |
| `style` | Formato, sin cambios de lógica | `style(skills): drop unused catch binding` |
| `ci` | Workflows de GitHub Actions | `ci(security): add weekly npm audit and CodeQL analysis` |
| `chore` | Mantenimiento: dependencias, configuración, scripts | `chore(deps): remove unused sonner` |

Un `feat` o `fix` incluye sus propios tests: no se separan en un commit `test` aparte.

### 3.3 Ámbitos

Usar el dominio afectado, alineado con `functions/src/modules/` y `src/modules/`: `api`, `security`, `auth`, `attendance`, `academic`, `assignments`, `github`, `moodle`, `lti`, `calendar`, `mail`, `courses`, `dashboard`, `ui`, `a11y`, `export`, `rules`, `deps`, `ci`. Si un cambio toca dos dominios en serio, probablemente son dos commits.

### 3.4 Cambios incompatibles

Agregar `!` después del ámbito y un pie `BREAKING CHANGE:` que diga qué se rompe y cómo migrar:

```
feat(security)!: encrypt GitHub and Gmail tokens at rest (mejora 3.13)

BREAKING CHANGE: the api function now requires the DOJO_ENCRYPTION_KEY
secret. Set it before deploying and run
scripts/migrations/001-encrypt-credentials.js.
```

Aplica a cambios de contrato de la callable `api`, de reglas de Firestore que quiten acceso, de formato de exports CSV o de requisitos de despliegue.

### 3.5 Cómo partir el trabajo

1.  Un commit por mejora o por tarea del plan; nunca "varios fixes" juntos.
2.  Orden de dependencias: primero la librería o el backend, después la UI que lo usa, al final la documentación.
3.  Cada commit debe pasar `npx tsc --noEmit`, `npm run lint` y `cd functions && npm test`. Para revisar un commit intermedio sin tocar el árbol de trabajo: `git worktree add /tmp/check <sha>`.
4.  Si un archivo mezcla dos cambios, separarlos con `git add -p` antes de commitear.
5.  Commits generados con asistentes de IA llevan el pie `Co-Authored-By:` correspondiente.

## 4. Mantenimiento de la documentación

Cada funcionalidad o cambio arquitectónico debe reflejarse en:

1.  **README.md**: visión general, stack y cifras de pruebas si cambian.
2.  **docs/ROADMAP.md**: estado verificado, backlog e hitos (única fuente de estado).
3.  **docs/ARCHITECTURE.md**: modelo de datos, seguridad o estructura de directorios.
4.  **docs/DEVELOPMENT.md** (este archivo): nuevos scripts o usuarios de prueba.

## 5. Usuarios de prueba (seed)

El seed carga datos consistentes a Firestore de manera idempotente:

```bash
./seed.sh
```

| Rol | Email | UID | Estado Inicial | Cátedra |
| :-- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@jutsu.com` | `admin123` | `approved` | Acceso global |
| **Profesor** | `teacher@jutsu.com` | `teacher123` | `approved` | Titular de `course123` |
| **Estudiante** | `student@jutsu.com` | `student123` | `pending` | Inscripto en `course123` |

Además se crean 20 estudiantes extra (`student_extra_1`…`student_extra_20`, correos estilo `sasukeuchiha@jutsu.com`) inscriptos en `course123`, con estados alternados approved/pending y matrículas `UNRN-10010+`. El seed pre-carga una entrega de Naruto Uzumaki en la tarea "Clon de Sombra Básico" para probar calificación y actividad GitHub.

## 6. Despliegue

```bash
firebase login
firebase use tu-proyecto-id
firebase deploy --only functions,firestore     # backend
# App Hosting: integración git — cada push a main compila y despliega
```

### Antes del primer despliegue de las Fases 1–2 del plan

1. **Cargar el secreto** (el deploy de `api` falla si no existe):
   ```bash
   openssl rand -hex 32 | firebase functions:secrets:set DOJO_ENCRYPTION_KEY --data-file=-
   ```
   Guardar la clave en un gestor de contraseñas: sin ella no se pueden descifrar los tokens.
2. **Desplegar** `firebase deploy --only functions,firestore` (reglas: `active_qr` pasa a solo backend; índices: TTL de `rate_limits`).
3. **Migrar** los tokens existentes, primero en seco y después con `--apply`, con la misma clave:
   ```bash
   DOJO_ENCRYPTION_KEY=<clave> GOOGLE_CLOUD_PROJECT=<proyecto> node scripts/migrations/001-encrypt-credentials.js
   DOJO_ENCRYPTION_KEY=<clave> GOOGLE_CLOUD_PROJECT=<proyecto> node scripts/migrations/001-encrypt-credentials.js --apply
   ```
4. **Rotación**: cargar la clave nueva como `DOJO_ENCRYPTION_KEY` y la anterior como `DOJO_ENCRYPTION_KEY_PREVIOUS` (declararla en `functions/index.js`), volver a correr la migración y luego quitar la anterior.

Para el caso concreto de migración de endpoints CSV (orden de despliegue, verificación y rotación de tokens), seguir el [Runbook](RUNBOOK_DESPLIEGUE_CSV.md).
