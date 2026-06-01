# Jutsu Classroom (GitHub Classroom Clone)

Jutsu Classroom es una alternativa ligera y auto-hospedada a GitHub Classroom, construida sobre **Supabase** y **GitHub API**. Permite una gestión académica integral, desde el control de repositorios hasta la asistencia y comunicación.

## 🚀 Arquitectura y Capacidades

1.  **Multi-Dashboard**: Vistas especializadas para **Administradores**, **Profesores** y **Estudiantes**.
2.  **Gestión de GitHub**: Creación automática de repositorios individuales desde plantillas (no forks) y control de permisos (Lectura/Escritura).
3.  **Control de Asistencia**: Sistema de **QR dinámico** que se regenera cada 10s para evitar fraudes, con escáner móvil integrado.
4.  **Cronograma Académico**: Calendario cuatrimestral, planificación semanal, temas de clase y repositorio de grabaciones.
5.  **Comunicación Bidireccional**: Anuncios generales por curso y mensajería privada con confirmación de lectura (timestamp).
6.  **Sistema de Entregas**: Ciclo de vida con estados visuales (OK, Correcciones, Rehacer, etc.) y doble fecha límite.

## 🛠️ Requisitos Previos

- Cuenta de [Supabase](https://supabase.com/).
- Organización en GitHub para los repositorios de alumnos.
- **GitHub Personal Access Token (PAT)** con permisos `repo` y `admin:org`.

## ⚙️ Configuración

### 1. Base de Datos y Auth
- Aplica las migraciones en `supabase/migrations/`.
- Configura el proveedor **GitHub** en Supabase Auth.
- **Roles**: Los usuarios son `student` por defecto. Para asignar un Admin/Profesor, edita la tabla `profiles`.

### 2. Edge Functions
Configura los secretos y despliega:
```bash
supabase secrets set GITHUB_ACCESS_TOKEN=tu_token
supabase functions deploy github-classroom-actions
supabase functions deploy attendance-handler
```

### 3. Frontend
Actualiza las constantes en `js/app.js` con tu `SUPABASE_URL` y `SUPABASE_ANON_KEY`.

## 📖 Flujos de Usuario

### 👔 Administrador
- Crear materias y asignarles una organización de GitHub.
- Importar/Exportar la estructura de materias vía JSON para reutilización en nuevos ciclos.

### 🍎 Profesor
- Crear tareas con `due_date` (entrega) y `lock_date` (bloqueo de repo).
- **Control de Acceso**: Bloquear/Desbloquear repositorios individual o masivamente.
- Gestionar el calendario, temas de clase y enlaces a grabaciones.
- Iniciar sesiones de clase con QR dinámico.
- Evaluar entregas y enviar mensajes privados.

### 🎓 Estudiante
- Aceptar tareas (crea repo automático) y enviarlas a revisión.
- Ver estados de corrección mediante iconos (✅, ⚠️, 🔆, ❌, ⭕, 🚫).
- Escanear QR desde el móvil para marcar asistencia.
- Acceder al cronograma y grabaciones de clase.

## 🔒 Seguridad
- **RLS (Row Level Security)**: Aislamiento total de datos entre estudiantes.
- **Server-side Validation**: Las fechas límite y permisos de GitHub se gestionan en Edge Functions seguras.

## 📝 Convenciones del Proyecto
- **Commits Semánticos**: Este proyecto utiliza [Conventional Commits](https://www.conventionalcommits.org/). Todos los commits deben seguir el formato `<tipo>(<ámbito>): <descripción>` (ej. `feat(auth): login con google`, `fix(ui): botón no clickeable`).
- Para más detalles sobre el flujo de trabajo, lee el archivo `DEVELOPMENT.md`.

## 📄 Licencia
MIT
