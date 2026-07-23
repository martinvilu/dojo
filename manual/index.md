# Manual de Usuario - Jutsu Classroom (Gaula)

Bienvenido a la documentación oficial y manual completo de usuario de **Jutsu Classroom**, la plataforma de gestión académica integral diseñada para la enseñanza de programación, ingeniería de software y materias universitarias.

```{toctree}
:maxdepth: 2
:caption: Contenido del Manual

docentes
estudiantes
administradores
faq
```

```{note}
Jutsu Classroom está optimizado para entornos con alta densidad de código, integración nativa con GitHub, control de asistencia por geolocalización y sincronización de calendarios iCal.
```

---

## 🎯 Descripción General del Sistema

Jutsu Classroom ofrece una experiencia académica fluida dividida en tres perfiles clave:

1. **Estudiantes**: Acceso a cronogramas unificados, firma de asistencia mediante QR dinámico y GPS, aceptación y entrega de tareas sincronizadas con repositorios de GitHub, consulta de grabaciones de clase con marcadores temporales y participación en grupos de estudio y tutorías.
2. **Docentes**: Planificación de clases, generación de códigos QR de asistencia con validación geográfica Haversine, revisión de commits y Pull Requests de GitHub, calificación con retroalimentación, avisos con acuse de recepción y tableros Kanban.
3. **Administradores**: Gestión integral de usuarios, asignación de roles, auditoría de notas, control de versiones del cronograma, respaldos incrementales del sistema en JSON y configuración LTI 1.3 con Moodle.

---

## 🛠️ Tecnologías Principales

- **Frontend**: Next.js 16 (React 19, TypeScript, Tailwind CSS).
- **Backend / Serverless**: Firebase Cloud Functions (Node.js 22), Firebase Auth, Cloud Firestore.
- **Integraciones Externeas**: GitHub REST API, Google Calendar / iCal Feed (.ics), Moodle LTI 1.3.
