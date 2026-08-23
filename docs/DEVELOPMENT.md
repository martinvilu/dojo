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

## 2. Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` / `build` | Desarrollo / build de producción |
| `npx tsc --noEmit` | Chequeo de tipos |
| `npm run lint` | ESLint |
| `cd functions && npm test` | Suite Jest del backend (90 pruebas) |
| `npm run test:rules` | Reglas de Firestore contra emulador (23 escenarios) |
| `npm run test:selenium` | E2E Selenium sobre mock server (56 escenarios) |
| `npm run test:local` | Batería local completa (`scripts/test-local.sh`) |

Los flujos por rol están automatizados en `tests/selenium/` (14 módulos); las guías paso a paso de usuario viven en [`manual/`](../manual/index.md). Antes de cambios masivos en la base de datos, correr siempre la suite de reglas.

## 3. Commits semánticos

Usamos [Conventional Commits](https://www.conventionalcommits.org/): `<tipo>(<ámbito>): <descripción>`

*   **feat**: nueva funcionalidad · **fix**: corrección · **docs**: documentación · **style**: formato · **refactor**: sin feat/fix · **test**: pruebas · **chore**: mantenimiento.

Un commit por solicitud/cambio completado, con push inmediato si aplica.

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

Para el caso concreto de migración de endpoints CSV (orden de despliegue, verificación y rotación de tokens), seguir el [Runbook](RUNBOOK_DESPLIEGUE_CSV.md).
