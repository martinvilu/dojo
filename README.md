# Gaula Classroom (GitHub Classroom Clone)

Gaula Classroom es una alternativa ligera y auto-hospedada a GitHub Classroom, construida sobre **Supabase** y **GitHub API**. Permite a los profesores gestionar asignaturas, distribuir tareas automáticamente y supervisar las entregas de los alumnos.

## 🚀 Arquitectura

El sistema se basa en tres pilares:

1.  **Supabase Database**: Almacenamiento persistente con políticas de seguridad (RLS).
2.  **Supabase Edge Functions**: Lógica de servidor para interactuar de forma segura con la API de GitHub.
3.  **Frontend Vanilla JS**: Interfaz de usuario para alumnos y profesores, desplegable en servicios estáticos.

## 🛠️ Requisitos Previos

- Una cuenta de [Supabase](https://supabase.com/).
- Una organización en GitHub donde se alojarán los repositorios de los alumnos.
- Un **Personal Access Token (PAT)** de GitHub con permisos `repo` y `admin:org`.

## ⚙️ Configuración

### 1. Base de Datos
Aplica las migraciones iniciales situadas en `supabase/migrations/`. Esto creará las tablas y las políticas RLS necesarias.

### 2. Edge Functions
Configura los secretos necesarios para la interacción con GitHub:

```bash
supabase secrets set GITHUB_ACCESS_TOKEN=tu_token_de_acceso_personal
```

Despliega la función:

```bash
supabase functions deploy github-classroom-actions
```

### 3. Frontend
En el archivo `js/app.js`, actualiza las constantes de conexión:

```javascript
const SUPABASE_URL = 'https://tu-proyecto.supabase.co';
const SUPABASE_ANON_KEY = 'tu-anon-key';
```

## 📖 Uso

### Para Profesores
1.  Registra un curso en la tabla `courses` indicando el nombre de tu organización de GitHub.
2.  Añade alumnos a la tabla `course_roster` usando sus correos electrónicos.
3.  Crea tareas en la tabla `assignments` proporcionando el enlace a un repositorio template.

### Para Alumnos
1.  Inicia sesión con GitHub en la aplicación.
2.  Selecciona el curso y la tarea.
3.  Haz clic en **"Accept Assignment"**. El sistema creará un repositorio privado para ti y te añadirá como colaborador.
4.  Trabaja en tu código y haz push a GitHub.
5.  Haz clic en **"Submit for Evaluation"** para marcar tu entrega como lista para revisión.

## 🔒 Seguridad
- **RLS**: Los alumnos solo pueden ver los cursos en los que están inscritos y sus propias entregas.
- **Service Role**: Las operaciones críticas (como actualizar estados de entrega) se realizan a través de la Edge Function usando la `SERVICE_ROLE_KEY` para garantizar integridad.

## 📄 Licencia
MIT
