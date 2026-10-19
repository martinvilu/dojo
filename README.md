# 🥷 Ninja Dojo (Jutsu Classroom)

> **Plataforma de gestión educativa que fusiona un LMS moderno, integración LTI 1.3 con Moodle, gamificación por rangos y monitoreo de entregas en GitHub.**

Ninja Dojo conecta en tiempo real a **Estudiantes** (incluidos los tutores entre pares), **Docentes** y **Administradores** con herramientas colaborativas modernas, analítica de riesgo académico e integración con **GitHub**, **Moodle 4.2+** y **Google Workspace**.

---

## 🔥 Funcionalidades por rol

### 🎓 Estudiante
*   Gamificación por Rango Ninja & XP: niveles y medallas calculadas según asistencia, entregas, notas y foros.
*   Foros Q&A por clase con reacciones y Modo "Stack Overflow" (respuesta destacada por el docente).
*   Grupos de estudio auto-organizados por afinidad horaria y tutorías entre pares con videollamada.
*   Certificados digitales verificables en PDF (constancias y actas).
*   Suscripción a calendarios iCal/ICS para Google Calendar, Apple Calendar y Outlook.

### 👨‍🏫 Docente
*   Presentismo por QR dinámico (token de 6 caracteres) con validación de proximidad GPS (<150 m) en backend.
*   Alertas tempranas de desempeño (<75% asistencia o tareas atrasadas) y dashboard docente centralizado.
*   Exportación CSV de notas/asistencia/alumnos para Google Sheets o Excel (`/api/export/csv`) e importación de notas corregidas.
*   Tablero Kanban curricular drag & drop, encuestas anónimas por clase, co-docencia con comisiones y reportes PDF.

### 🎓 Integración Moodle 4.2+ & LTI 1.3
*   Deep Linking LTI 1.3 a 6 módulos, keyset JWKS, sincronización de notas (AGS) y auto-matrícula.
*   Generador de respaldos MBZ/XML nativos y sincronización vía Web Services REST.

### ⚙️ Administración
*   RBAC de 3 roles (estudiante, docente, administrador) con autorización por acción en el backend, reglas de Firestore estrictas y suite de regresión de seguridad.
*   Auditoría inmutable de calificaciones, control de versiones de cronogramas y backups granulares.

---

## 🛠️ Stack

*   **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, design system modular.
*   **Backend**: Firebase Auth, Cloud Firestore (offline vía IndexedDB), Cloud Functions v2 (Node 22), Firebase App Hosting (SSR).
*   **Calidad**: tests unitarios frontend (48, `node --test`), Jest backend (239 pruebas / 23 suites), reglas Firestore contra emulador (23 escenarios) y Selenium E2E (56 escenarios / 14 módulos). Los 4 checks son obligatorios en cada PR; además corren npm audit y CodeQL. Estado verificado al 18/10/2026 en [ROADMAP](docs/ROADMAP.md).
*   **Estándares**: LTI 1.3 Advantage, RFC 5545 iCalendar, Moodle 4.2 MBZ.

## 💻 Requisitos previos

Node.js 22+ · Firebase CLI · Java 21 (emulador de Firestore) · Google Chrome (E2E).

## 🚀 Desarrollo local

```bash
npm install                 # frontend
cd functions && npm install # backend
npm run dev                 # http://localhost:3000
```

> ⚠️ El cliente local apunta al proyecto Firebase de producción. Leé la [Guía de Desarrollo](docs/DEVELOPMENT.md) antes de probar con datos.

## 🧪 Pruebas

```bash
npx tsc --noEmit && npm run lint
npm run test:unit           # unitarias frontend (48)
cd functions && npm test    # unitarias backend (239)
npm run test:rules          # reglas Firestore con emulador (23)
npm run test:selenium       # E2E Selenium (56)
```

Más detalles y usuarios seed en la [Guía de Desarrollo](docs/DEVELOPMENT.md).

## ☁️ Despliegue

*   **Functions + Firestore rules**: `firebase deploy --only functions,firestore` (también automático en push a `main` vía GitHub Actions).
*   **App**: Firebase App Hosting con integración git — cada commit en `main` compila y despliega.

Verificación post-despliegue, monitoreo con `/api/health`, respaldos y rotación de secretos: [Manual de Operación](docs/OPERACION.md).

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, modelo de datos, seguridad RBAC |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Estado verificado, hallazgos, backlog priorizado e hitos |
| [docs/API.md](docs/API.md) | Callable `api` (acciones y permisos), rutas `/api/*` y funciones HTTP |
| [docs/OPERACION.md](docs/OPERACION.md) | Despliegue, monitoreo, respaldos, secretos e incidentes |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, convenciones, pruebas y seed |
| [docs/RUNBOOK_DESPLIEGUE_CSV.md](docs/RUNBOOK_DESPLIEGUE_CSV.md) | Runbook de la migración de secretos de 32 chars y del endpoint CSV unificado |
| [docs/UML.md](docs/UML.md) · [docs/CASOS_DE_USO.md](docs/CASOS_DE_USO.md) | Diagramas y escenarios por rol |
| [docs/MOODLE_INTEGRATION.md](docs/MOODLE_INTEGRATION.md) | Detalle de integración Moodle/LTI |
| [manual/index.md](manual/index.md) | Manual de usuario: primeros pasos, estudiantes, docentes, administradores y FAQ |
