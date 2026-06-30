# Jutsu Classroom

Jutsu Classroom es una plataforma híbrida de gestión educativa que integra un frontend moderno con **Next.js** y lógica en el cliente con **Vanilla JS**, respaldado por **Firebase**. La aplicación permite la creación de cursos, inscripción mediante enlaces/códigos, planificación detallada con bloques de tiempo, integración con GitHub para entregas y conexión con YouTube para grabaciones.

## Requisitos Previos

- Node.js (v18+)
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

Antes de desplegar el front-end o si haces cambios en el back-end (`/functions`) o base de datos:

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

## Arquitectura Híbrida
- **Next.js** (`src/app/`): Proveedor del enrutamiento estático y esqueleto de la UI.
- **Vanilla JS** (`public/js/app.js`): Controla la lógica de autenticación, hidratación y manipulación del DOM en el lado del cliente sin fricciones de re-renderizado reactivo complejo.
- **Firebase Functions** (`functions/index.js`): Lógica de servidor y operaciones que requieren permisos elevados (ej. validaciones, roles, invitaciones).
