# Ninja Dojo

Ninja Dojo es una plataforma híbrida de gestión educativa que integra un frontend interactivo y reactivo desarrollado con **Next.js** (React, TypeScript y Tailwind CSS) respaldado por un backend serverless en **Firebase** (Authentication, Firestore, Cloud Functions y App Hosting).

La aplicación permite la gestión de cátedras, inscripción de estudiantes y profesores mediante códigos de acceso, planificación interactiva de cronogramas, envío de avisos generales y asignación de tareas con soporte de colaboración grupal.

## Requisitos Previos

- Node.js (v22+)
- Firebase CLI (`npm install -g firebase-tools`)
- Cuenta de Google para autenticación y despliegue

## Instalación y Desarrollo Local

1. Instalar las dependencias de la aplicación (Next.js):
   ```bash
   npm install
   ```

2. Instalar las dependencias de Cloud Functions:
   ```bash
   cd functions
   npm install
   cd ..
   ```

3. Ejecutar el servidor de desarrollo local:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en el navegador para ver la aplicación.

## Despliegue en Firebase

El proyecto utiliza varios servicios de Firebase: Authentication, Firestore, Cloud Functions y App Hosting.

### 1. Despliegue de Reglas de Firestore y Cloud Functions

Antes de desplegar el front-end o si realizas cambios en el back-end (`/functions`) o base de datos:

```bash
# Iniciar sesión en Firebase (si no lo has hecho)
firebase login

# Asegúrate de usar el proyecto correcto
firebase use tu-proyecto-id

# Desplegar Funciones y reglas de Firestore
firebase deploy --only functions,firestore
```

### 2. Despliegue de la Aplicación Web (Firebase App Hosting)

La aplicación Next.js está configurada para desplegarse mediante **Firebase App Hosting**.

**Opción A: Despliegue Automatizado (Recomendado)**
App Hosting funciona conectándose directamente a tu repositorio de GitHub.
1. Ve a la consola de Firebase > App Hosting.
2. Conecta tu repositorio de GitHub.
3. Cada vez que hagas `git push` a la rama principal (`main` o `master`), Firebase construirá y desplegará automáticamente la nueva versión.

**Opción B: Creación manual del backend de App Hosting**
Si aún no has creado el entorno de App Hosting en la consola, puedes hacerlo vía CLI:
```bash
firebase apphosting:backends:create
```
Sigue las instrucciones interactivas para vincular tu repositorio de GitHub y rama de despliegue.

## Estado del Proyecto y Funcionalidades Recientes

El proyecto se encuentra en un estado funcional avanzado con las siguientes características añadidas y consolidadas recientemente:

### 🎓 Gestión Académica e Inscripción
- **Asignación Manual de Roles**: Los administradores pueden gestionar los roles de los usuarios registrados del sistema (Admin, Profesor, Estudiante) a través de menús desplegables directos que impactan en sus perfiles de Firestore.
- **Inscripción y Acceso Resiliente**: Los estudiantes pueden enrolarse en cátedras mediante códigos generados de manera dinámica. La recuperación de cátedras por el estudiante consulta de manera cruzada las colecciones de inscripciones (`enrollments` y `course_roster`) evitando desapariciones de registros en la interfaz.
- **Asociación Docente**: Soporte para la asignación y desasignación manual de profesores a las aulas y cátedras desde el panel de control del administrador.

### 📅 Planificación Base, Calendario y Marcadores
- **Visualización Directa y Filtro de Cátedras**: Acceso directo al calendario con selector dinámico para alternar entre *🌐 Calendario Global* y materias específicas.
- **Sincronización iCal (.ics)**: Exportación instantánea del cronograma de clases y entregas en formato estandarizado `.ics` compatible con Google Calendar, Outlook y Apple Calendar.
- **Marcadores Temporales en Grabaciones (Bookmarks)**: Etiquetado de minutos específicos en videos de clases (timestamps) con títulos descriptivos para acceso rápido.

### 📢 Comunicación, Entregas y Perfil de Usuario
- **Usuario de GitHub Requerido**: Registro y validación obligatoria del nombre de usuario de GitHub (`github_user`) con alerta preventiva en el dashboard.
- **Seguimiento de Commits y PRs**: Integración limpia con GitHub REST API para monitorear commits, Pull Requests y comentarios en entregas.
- **Acuse de Recepción de Avisos**: Los avisos creados por los docentes cuentan con confirmación interactiva de lectura.

### 🛠️ Infraestructura y Seguridad
- **Eliminación Física de Usuarios**: Borrado en cascada (Firebase Auth + Firestore) por administradores con modal de advertencia preventiva.
- **Suite de Pruebas Unitarias Exhaustivas**: 58/58 tests unitarios pasando en el backend con Jest.

## 📚 Documentación del Sistema

Toda la documentación técnica y funcional del proyecto se encuentra organizada en `docs/` y `manual/`:

- **[Manual de Usuario (MyST Markdown)](file:///home/mrtin/dev/gaula/manual/index.md)**: Guía completa de uso por características para [Docentes](file:///home/mrtin/dev/gaula/manual/docentes.md) y [Estudiantes](file:///home/mrtin/dev/gaula/manual/estudiantes.md).
- **[Arquitectura y Diseño de Datos](file:///home/mrtin/dev/gaula/docs/ARCHITECTURE.md)**: Detalle del modelo de seguridad (RBAC), colecciones de base de datos (Firestore) y la estructura de archivos.
- **[Casos de Uso del Sistema](file:///home/mrtin/dev/gaula/docs/CASOS_DE_USO.md)**: Escenarios detallados por rol (profesor, estudiante, administrador).
- **[Diagramas UML (Mermaid)](file:///home/mrtin/dev/gaula/docs/UML.md)**: Diagrama de Casos de Uso, Modelo Entidad-Relación y Diagrama de Secuencias de flujos críticos.
- **[Guía de Pruebas y Semillas (Testing)](file:///home/mrtin/dev/gaula/docs/TESTING.md)**: Comandos de consola y flujos para simular el comportamiento de la plataforma localmente con la semilla de base de datos.
- **[Roadmap y Plan de Mejoras](file:///home/mrtin/dev/gaula/docs/ROADMAP.md)**: Estado del sistema e ideas de evolución técnica y pedagógica adaptadas por categoría.
- **[Estándares de Desarrollo](file:///home/mrtin/dev/gaula/docs/DEVELOPMENT.md)**: Estilo de commits y pautas para el mantenimiento del repositorio.
- **[Estilo de Interfaz (Design Tokens)](file:///home/mrtin/dev/gaula/docs/DESIGN.md)**: Configuración CSS y paletas de colores del sistema.
- **[Propuestas de Codenames](file:///home/mrtin/dev/gaula/docs/NOMBRES.md)**: Sugerencias creativas e informales para nombrar el proyecto.
