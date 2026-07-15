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

### 📅 Planificación Base y Cronogramas
- **Gestión del Cronograma**: Profesores y ayudantes pueden visualizar la planificación base (clases y bloques horarios) con un flujo de carga seguro (`getCourseDetails`) que evita errores de permisos o actualizaciones simultáneas de la base de datos.
- **Creación y Edición de Clases**: Herramientas integradas para regenerar y guardar el cronograma de clases de manera automática.

### 📢 Comunicación y Entregas
- **Acuse de Recepción de Avisos**: Los avisos creados por los docentes cuentan con un sistema de confirmación interactivo. Los estudiantes confirman la lectura del aviso presionando "Confirmar Recepción", y los docentes y administradores pueden inspeccionar el listado de lecturas en tiempo real con marcas de tiempo detalladas.
- **Asignaciones**: Carga y gestión de tareas asociadas a las cátedras.

### 🛠️ Infraestructura y Backend
- **Motor Node.js Actualizado**: Configuración optimizada de las Cloud Functions al motor runtime de **Node.js 22** para evitar interrupciones de soporte.
- **Seeds Idempotentes**: Scripts de inicialización y poblamiento de base de datos (`seed.sh` y `functions/seed.js`) optimizados para ser idempotentes usando métodos `PATCH` en lugar de `POST`, garantizando la consistencia en el estado de aprobación de los perfiles de prueba.

## Arquitectura del Sistema
- **Frontend React / Next.js (`src/app/`)**: Implementa la interfaz interactiva y el panel de control de múltiples roles con hidratación de datos en tiempo real mediante Firebase Client SDK.
- **Backend Firebase Cloud Functions (`functions/index.js`)**: Encapsula las operaciones privilegiadas en un controlador de llamadas de API (`api`), asegurando las verificaciones de rol y la seguridad de los datos de Firestore.
- **Firestore (`firestore.rules` / `firestore.indexes.json`)**: Base de datos de documentos flexible orientada a materias, alumnos, entregas y asistencia.

## 📚 Documentación del Sistema

Toda la documentación técnica y funcional del proyecto se encuentra organizada en la carpeta `docs/`:

- **[Arquitectura y Diseño de Datos](file:///home/mrtin/dev/gaula/docs/ARCHITECTURE.md)**: Detalle del modelo de seguridad (RBAC), colecciones de base de datos (Firestore) y la estructura de archivos.
- **[Casos de Uso del Sistema](file:///home/mrtin/dev/gaula/docs/CASOS_DE_USO.md)**: Escenarios detallados por rol (profesor, estudiante, administrador).
- **[Diagramas UML (Mermaid)](file:///home/mrtin/dev/gaula/docs/UML.md)**: Diagrama de Casos de Uso, Modelo Entidad-Relación y Diagrama de Secuencias de flujos críticos.
- **[Guía de Pruebas y Semillas (Testing)](file:///home/mrtin/dev/gaula/docs/TESTING.md)**: Comandos de consola y flujos para simular el comportamiento de la plataforma localmente con la semilla de base de datos.
- **[Roadmap y Plan de Mejoras](file:///home/mrtin/dev/gaula/docs/ROADMAP.md)**: Ideas de evolución técnica y pedagógica adaptadas para diferentes tipos de cátedra.
- **[Estándares de Desarrollo](file:///home/mrtin/dev/gaula/docs/DEVELOPMENT.md)**: Estilo de commits y pautas para el mantenimiento del repositorio.
- **[Estilo de Interfaz (Design Tokens)](file:///home/mrtin/dev/gaula/docs/DESIGN.md)**: Configuración CSS y paletas de colores del sistema.
- **[Propuestas de Codenames](file:///home/mrtin/dev/gaula/docs/NOMBRES.md)**: Sugerencias creativas e informales para nombrar el proyecto.


