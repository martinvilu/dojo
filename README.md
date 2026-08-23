# 🥷 Ninja Dojo (Jutsu Classroom)

> **Plataforma de gestión educativa que fusiona un LMS moderno, integración LTI 1.3 con Moodle, gamificación por rangos y monitoreo de entregas en GitHub.**

Ninja Dojo conecta en tiempo real a **Estudiantes**, **Tutores**, **Docentes** y **Administradores** con herramientas colaborativas modernas, analítica de riesgo académico e integración con **GitHub**, **Moodle 4.2+** y **Google Workspace**.

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
*   RBAC de 4 roles con reglas de Firestore estrictas y suite de regresión de seguridad.
*   Auditoría inmutable de calificaciones, control de versiones de cronogramas y backups granulares.

---

## 🛠️ Stack

*   **Frontend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS 4, design system modular.
*   **Backend**: Firebase Auth, Cloud Firestore (offline vía IndexedDB), Cloud Functions v2 (Node 22), Firebase App Hosting (SSR).
*   **Calidad**: Jest (90 pruebas), Selenium E2E (56 escenarios / 14 módulos), reglas Firestore contra emulador (23 escenarios) — los 4 checks son obligatorios en cada PR.
*   **Estándares**: LTI 1.3 Advantage, RFC 5545 iCalendar, Moodle 4.2 MBZ.

## 💻 Requisitos previos

Node.js 22+ · Firebase CLI · Chrome/ChromeDriver (para E2E).

## 🚀 Desarrollo local

```bash
npm install                 # frontend
cd functions && npm install # backend
npm run dev                 # http://localhost:3000
```

## 🧪 Pruebas

```bash
cd functions && npm test    # unitarias backend (90)
npm run test:rules          # reglas Firestore con emulador (23)
npm run test:selenium       # E2E Selenium (56)
```

Más detalles y usuarios seed en la [Guía de Desarrollo](docs/DEVELOPMENT.md).

## ☁️ Despliegue

*   **Functions + Firestore rules**: `firebase deploy --only functions,firestore` (también automático en push a `main` vía GitHub Actions).
*   **App**: Firebase App Hosting con integración git — cada commit en `main` compila y despliega.

Para migraciones operativas (orden de despliegue, verificación post-deploy), ver el [Runbook](docs/RUNBOOK_DESPLIEGUE_CSV.md).

## 📚 Documentación

| Documento | Contenido |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitectura, modelo de datos, seguridad RBAC |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Estado verificado, backlog priorizado e hitos |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, convenciones, pruebas y seed |
| [docs/RUNBOOK_DESPLIEGUE_CSV.md](docs/RUNBOOK_DESPLIEGUE_CSV.md) | Despliegue y acciones manuales operativas |
| [docs/UML.md](docs/UML.md) · [docs/CASOS_DE_USO.md](docs/CASOS_DE_USO.md) | Diagramas y escenarios por rol |
| [docs/MOODLE_INTEGRATION.md](docs/MOODLE_INTEGRATION.md) | Detalle de integración Moodle/LTI |
| [manual/index.md](manual/index.md) | Manual de usuario (docentes, estudiantes, admins) |
