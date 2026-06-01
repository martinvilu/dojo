# Jutsu Classroom

Jutsu Classroom es una plataforma educativa integral para la gestión académica, diseñada para ofrecer una experiencia rápida y centralizada. Reemplaza herramientas aisladas con un sistema "todo en uno" construido sobre **Firebase**, pensado especialmente para docentes y estudiantes de habla hispana (con soporte nativo para Español Rioplatense).

## 🚀 Arquitectura y Capacidades

1.  **Backend Monolítico en la Nube**: Basado enteramente en **Firebase** (Auth, Firestore, Hosting y Cloud Functions v1) usando Node.js 24.
2.  **Multi-Dashboard Unificado**: Vistas especializadas y control de acceso para **Administradores**, **Profesores** y **Estudiantes**.
3.  **Múltiples Métodos de Autenticación**: Soporte activo para inicio de sesión mediante **Google**, **GitHub** y clásico **Email/Contraseña**.
4.  **Perfil del Estudiante**: Seguimiento académico detallado con métricas locales (Matrícula UNRN, Cohorte).
5.  **Enrolamiento por Código**: Sistema ágil para que los alumnos se sumen a las cursadas utilizando un código de invitación seguro de 6 caracteres generado aleatoriamente.
6.  **UX Pulida y Feedback Global**: Animaciones de carga integradas e interfaces fluidas basadas en JavaScript Vanilla.

## 🛠️ Requisitos Previos

- Cuenta de [Firebase](https://firebase.google.com/).
- Herramientas locales instaladas: `Node.js` y `npm`.
- CLI de Firebase (para despliegues): `npm install -g firebase-tools`

## ⚙️ Configuración y Despliegue

### 1. Inicializar el Proyecto
Configura el entorno en tu terminal:
```bash
firebase login
firebase use jutsu-classroom-mrtin
```

### 2. Backend y Reglas
Aplica las reglas de seguridad de Firestore e instala las dependencias de las Cloud Functions:
```bash
firebase deploy --only firestore:rules
cd functions && npm install && cd ..
```

### 3. Despliegue Completo
```bash
# Sube tanto las Cloud Functions como el Frontend (Hosting)
firebase deploy
```

## 📖 Flujos de Usuario

### 👔 Administrador (`admin@jutsu.com`)
- Crear nuevas materias.
- Visualizar todos los usuarios registrados, sus roles y sus datos académicos (Matrícula, Cohorte).

### 🍎 Profesor (`teacher@jutsu.com`)
- Visualizar las clases asignadas junto a su **Código de Invitación** exclusivo.
- Compartir el código con los estudiantes.
- (En desarrollo) Crear tareas, evaluar entregas y administrar cronogramas.

### 🎓 Estudiante (`student@jutsu.com`)
- Autenticarse de forma rápida (GitHub/Google).
- Completar su **Perfil Académico** (Matrícula y Año de ingreso).
- Sumarse a una cursada insertando el código de invitación del docente en el dashboard principal.
- (En desarrollo) Ver tareas, subir entregas y marcar asistencia.

## 📝 Convenciones del Proyecto
- **Commits Semánticos**: Este proyecto utiliza [Conventional Commits](https://www.conventionalcommits.org/). Todos los commits deben seguir el formato `<tipo>(<ámbito>): <descripción>` (ej. `feat(auth): login con google`, `fix(ui): botón no clickeable`).
- Para más detalles sobre el flujo de trabajo y reglas de contribución (incluidas directivas para IAs), revisa `GEMINI.md` y `DEVELOPMENT.md`.
