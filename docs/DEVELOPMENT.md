# Guía de Desarrollo — Ninja Dojo

Setup, convenciones y pruebas del proyecto. Para la arquitectura ver [ARCHITECTURE.md](ARCHITECTURE.md); para los contratos de API, [API.md](API.md); para el estado y el backlog, [ROADMAP.md](ROADMAP.md); para desplegar y operar, [OPERACION.md](OPERACION.md).

---

## 1. Requisitos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22+ (CI usa 22; también funciona con 24) | App y Cloud Functions |
| Firebase CLI | `npm install -g firebase-tools` | Emulador, despliegue |
| Java | 21 | Emulador de Firestore (`test:rules`) |
| Google Chrome | estable | E2E Selenium (ChromeDriver lo resuelve `selenium-webdriver`) |

## 2. Setup

```bash
npm install                    # app Next.js 16 / React 19
cd functions && npm install    # Cloud Functions (Node 22, CommonJS)
cd .. && npm run dev           # http://localhost:3000
```

> ⚠️ **El entorno local apunta a producción.** `src/lib/firebase/clientApp.ts` fija el proyecto `jutsu-classroom-mrtin` y no conecta los emuladores, así que `npm run dev` lee y escribe datos reales y llama a las Cloud Functions desplegadas. Para experimentar sin riesgo, usá los tests (que corren contra mocks o el emulador) o una cuenta de prueba.

### 2.1. Variables de entorno

| Variable | Dónde | Uso |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `.env` / `.env.local` | API key web de Firebase (pública por diseño; hay un valor por defecto) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `.env.local` | Validadas por `src/lib/env.ts` (opcionales) |
| `NEXT_PUBLIC_APP_URL` | App Hosting | URL pública; se usa para armar enlaces LTI y de suscripción |
| `GITHUB_WEBHOOK_SECRET` | App Hosting | Validado por `src/lib/env.ts` |
| `TYPESAFE_API_KEY` | `.env.local` | Cliente de TypeSafe/Jev (ver `status.md`) |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | Functions | OAuth de Gmail para el envío de correos (sin ellas se usan valores *mock*) |
| `SEED_ADMIN_EMAILS` | Functions (solo emulador) | Emails que se crean como `admin` en el primer login |
| `SEED_TEACHER_EMAILS` | Functions (solo emulador) | Subconjunto de `SEED_ADMIN_EMAILS` que se crea como `teacher` |

Los archivos `.env*` están en `.gitignore`. Nunca commitear tokens de GitHub, Moodle ni la clave `github-deploy-key.json`.

## 3. Scripts y suites

| Comando | Qué hace | Estado al 18/10/2026 |
|---|---|---|
| `npm run dev` / `npm run build` / `npm start` | Desarrollo / build de producción / servidor | Build ✔ 21 rutas |
| `npx tsc --noEmit` | Chequeo de tipos | ✔ |
| `npm run lint` | ESLint 9 (`eslint-config-next`) | ✔ |
| `npm run test:unit` | Tests de `src/lib` y utilidades con `node --test` y `--experimental-strip-types` (`tests/unit/*.test.ts`) | ✔ 48 |
| `cd functions && npm test` | Jest del backend (`functions/tests/`) | ✔ 239 |
| `npm run test:rules` | Reglas de Firestore contra el emulador (`tests/firestore.rules.test.js`) | ✔ 23 |
| `npm run test:selenium` | E2E Selenium contra un mock server (`tests/selenium/`, 14 módulos) | ✔ 56 |
| `npm run test:local` | Levanta `npm run dev` con instrucciones para simular LTI | — |

Los 4 checks obligatorios del CI (`.github/workflows/tests.yml`) son: **Frontend** (tsc + lint + unit + build), **Backend** (jest), **Security** (reglas) y **E2E** (selenium). Antes de abrir un PR conviene correr al menos `tsc`, `lint`, `test:unit` y `functions/npm test`; antes de tocar `firestore.rules` o el acceso a datos, también `test:rules`.

### 3.1. Escribir tests

- **Unitarios frontend**: lógica pura en `src/lib/` o `src/modules/*/utils/`, importada con extensión `.ts`. Si el código depende de la fecha u hora, probalo con varios husos: `TZ=UTC npm run test:unit` y `TZ=America/Argentina/Buenos_Aires npm run test:unit`.
- **Backend**: los handlers reciben `(payload, context)`; los tests arman un `context` con un `db` simulado. Toda acción nueva necesita una política en `authz.js`; `functions/tests/` verifica la paridad.
- **Reglas**: agregá el escenario permitido **y** el denegado.

## 4. Estructura

```
src/
  app/            App Router: páginas (dashboard, login, p/[uid]) y rutas /api/*
  components/     UI compartida (CommandPalette, ModuleErrorBoundary)
  hooks/          useFocusTrap, useOnlineStatus, useDebounce
  lib/            api.ts (callable), firebase/, schemas Zod, markdown, health, env
  modules/<dominio>/{components,hooks,utils,types.ts}
functions/
  index.js        callable api, HTTP (webhook, importGrades, calendar) y cron
  src/actions.js  registro acción → módulo
  src/authz.js    política de acceso por acción
  src/modules/<dominio>/
tests/            unit/, selenium/, firestore.rules.test.js
docs/ manual/     documentación técnica / manual de usuario
cli/              especificación de la Dojo CLI (sin implementación)
```

Dominios: `attendance`, `auth`, `calendar`, `course`, `github`, `mail`, `moodle` / `integrations`, `notifications`, `study_groups`, `system`, `tutoring`.

## 5. Convenciones

### 5.1. Commits semánticos

[Conventional Commits](https://www.conventionalcommits.org/): `<tipo>(<ámbito>): <descripción en inglés, imperativo>`.

`feat` · `fix` · `perf` · `refactor` · `docs` · `test` · `style` · `chore` · `ci` · `build`. El ámbito es el dominio o la herramienta (`attendance`, `github`, `a11y`, `deps`, `security`…). El cuerpo explica el **porqué** y, si corresponde, referencia la mejora (`mejora 3.08`) o el PR (`Closes #92`).

Un commit por cambio lógico. Los PRs de bots se integran con un commit semántico propio en lugar del título original del bot.

### 5.2. Pull requests

- `main` está protegida: requiere los 4 checks y que la rama esté al día.
- Los agentes Jules («⚡ Bolt», «🎨 Palette») abren PRs en paralelo que a menudo repiten la misma optimización. Antes de mergear uno, buscá duplicados por archivo tocado y cerrá los demás con un comentario que apunte al elegido.
- Dependabot agrupa los bumps y auto-mergea los parches (`dependabot-automerge.yml`).

### 5.3. Mantener la documentación

| Si cambia… | Actualizar |
|---|---|
| Estado de los checks, hallazgos, backlog | `docs/ROADMAP.md` (única fuente de estado) |
| Acciones de la callable, rutas `/api/*`, funciones | `docs/API.md` |
| Modelo de datos, seguridad, estructura | `docs/ARCHITECTURE.md` |
| Scripts, variables, usuarios de prueba | este archivo |
| Despliegue, monitoreo, respaldos | `docs/OPERACION.md` |
| Pantallas o flujos que ve el usuario | `manual/` |
| Cifras de pruebas o stack | `README.md` |

## 6. Datos de prueba (seed)

> ⚠️ `seed.sh` escribe con `curl` directo en el Firestore del proyecto **de producción** `jutsu-classroom-mrtin`, con el token de tu sesión de Firebase CLI. Sobrescribe los documentos con esos IDs. No lo corras salvo que sepas exactamente qué vas a pisar.

| Rol | Email | UID | Estado inicial | Cátedra |
| :-- | :--- | :--- | :--- | :--- |
| Admin | `admin@jutsu.com` | `admin123` | `approved` | Acceso global |
| Profesor | `kakashi@jutsu.com` | `teacher123` | `approved` | Titular de `course123` |
| Estudiante | `student@jutsu.com` | `student123` | `pending` | Inscripto en `course123` |

Se crean además 20 estudiantes (`student_extra_1`…`student_extra_20`) inscriptos en `course123` con estados alternados y matrículas `UNRN-10010+`, y una entrega precargada de Naruto Uzumaki para probar calificación y actividad de GitHub. `functions/seed.js` carga datos equivalentes con el Admin SDK y también apunta a `jutsu-classroom-mrtin`: para usarlo contra el emulador, exportá antes `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`. En el emulador de Functions, `SEED_ADMIN_EMAILS` / `SEED_TEACHER_EMAILS` crean cuentas privilegiadas en el primer login.

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `test:unit` falla solo a ciertas horas | Lógica que mezcla hora local y UTC | Usá siempre el mismo huso para agrupar y probá con varios `TZ` (ver `7c901db`) |
| `next build` falla con *Symlink … points out of the filesystem root* | `node_modules` es un symlink (p. ej., en un `git worktree`) | Instalá las dependencias en el propio directorio (`npm ci`) |
| `test:rules` no arranca | Falta Java o el puerto 8080 está ocupado | Instalá Java 21 y liberá el puerto |
| `MODULE_TYPELESS_PACKAGE_JSON` en los tests | Advertencia de Node al importar `.ts` | Ya se silencia en el script `test:unit` |
| La API responde `permission-denied` | La acción no tiene política o el usuario no es miembro/docente del curso | Revisá `functions/src/authz.js` |
