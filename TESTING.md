# Guía de Pruebas y Seed Data

Para validar el sistema y trabajar de manera local con Firebase.

## 🧪 Pruebas de Desarrollo

Actualmente, el sistema está integrado con **Firebase Hosting** y **Cloud Functions v1** alojados en la nube.
Para probar localmente, puedes usar la CLI de Firebase o apuntar tus pruebas al entorno live si estás en una rama de prueba.

### Comandos Útiles

1.  **Servir Localmente (Hosting)**: 
    ```bash
    firebase serve --only hosting
    ```
2.  **Desplegar Cloud Functions**: 
    ```bash
    firebase deploy --only functions
    ```
3.  **Script de Población (Seed)**: 
    Para agregar datos de prueba iniciales a Firestore, ejecuta el script proporcionado:
    ```bash
    ./seed.sh
    ```
    *(Asegúrate de darle permisos de ejecución: `chmod +x seed.sh`)*.

## 👤 Usuarios de Prueba (Seed)

Si ejecutas el script `seed.sh`, se crearán o asumirán usuarios pre-configurados. Inicia sesión con el email listado y usa tus métodos de autenticación (ej. Google Auth) si corresponde, o simplemente Email/Contraseña (si los diste de alta por allí):

| Rol | Email | Propósito |
| :--- | :--- | :--- |
| **Admin** | `admin@jutsu.com` | Crear materias. Ver todos los usuarios. |
| **Profesor** | `teacher@jutsu.com` | Ver cursos asignados y compartir códigos de invitación. |
| **Estudiante** | `student@jutsu.com` | Completar perfil, enrolarse a cursos por código. |

## 📡 Simulación de Enrolamiento

Para probar el flujo de la plataforma:
1. Entra como **Admin** y crea un nuevo curso llamado "Test Course".
2. Asigna ese curso a un profesor (manualmente en base de datos o por las herramientas en progreso).
3. Entra como **Profesor**, ve a "Mis Clases" y copia el **Código de Invitación** de 6 caracteres.
4. Entra como **Estudiante** por primera vez. Deberías ver un campo para colocar el código. Pégalo allí y dale a "Sumarme".
5. Verifica que ahora el curso aparece en "Mi Cursada".
