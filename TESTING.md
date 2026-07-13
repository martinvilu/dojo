# Guía de Pruebas y Seed Data

Este documento describe cómo levantar el entorno y validar las características de Jutsu Classroom (roles, planificación, acuses de recibo).

## 🧪 Pruebas de Desarrollo

El frontend corre localmente con Next.js y consume las Firebase Cloud Functions en producción o en el emulador local.

### Comandos Útiles

1.  **Iniciar Servidor Local Frontend**:
    ```bash
    npm run dev
    ```
2.  **Desplegar Cloud Functions & Reglas**:
    ```bash
    firebase deploy --only functions,firestore
    ```
3.  **Ejecutar Seed de Base de Datos**:
    Para cargar datos iniciales consistentes a Firestore de manera idempotente (usando `PATCH`):
    ```bash
    ./seed.sh
    ```

---

## 👤 Usuarios de Prueba (Seed)

Al ejecutar `./seed.sh` se crean tres perfiles iniciales en la colección `profiles` con IDs predeterminados:

| Rol | Email | UID | Estado Inicial | Cátedra Asignada |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin@jutsu.com` | `admin123` | `approved` | Ninguna (acceso global) |
| **Profesor** | `teacher@jutsu.com` | `teacher123` | `approved` | Docente titular de `course123` |
| **Estudiante** | `student@jutsu.com` | `student123` | `pending` | Inscripto en `course123` |

---

## 📋 Escenarios y Flujos de Prueba

### 1. Cambio Manual de Roles (Admin)
1. Inicia sesión como el **Admin** (`admin@jutsu.com`).
2. Dirígete a la pestaña **Usuarios**.
3. Localiza un usuario en la tabla. En la columna **Rol**, utiliza el menú desplegable (Select) para cambiar su rol (ej: de `Estudiante` a `Profesor`).
4. Confirma el cuadro de diálogo. La página se recargará y el rol quedará actualizado en Firestore.

### 2. Gestión y Visualización de Clases (Profesor/Ayudante)
1. Inicia sesión como el **Profesor** (`teacher@jutsu.com`).
2. Haz clic en **Ver Detalle** de la cátedra "Introducción al Ninjutsu".
3. Dirígete a la subpestaña **Cronograma**.
4. Haz clic en **🔄 Regenerar Clases** para generar automáticamente los bloques horarios y clases basándose en la configuración de la materia.
5. Haz clic en **💾 Guardar Cronograma**. Las clases se persistirán en Firestore.
6. Cierra sesión e ingresa con otro profesor asignado o con un **Estudiante** (`student@jutsu.com`). Verifica que las clases planificadas se muestren correctamente y no desaparezcan.

### 3. Acuse de Recepción de Avisos (Profesor ↔ Estudiante)
1. Inicia sesión como **Profesor** (`teacher@jutsu.com`), ve a la materia y entra a la subpestaña **Avisos**.
2. Escribe un mensaje en el cuadro de texto y haz clic en **Enviar Aviso**.
3. Inicia sesión como **Estudiante** (`student@jutsu.com`), entra a la misma cátedra y navega a **Avisos**.
4. Verás el aviso con un botón **"Confirmar Recepción"**. Haz clic en él. El estado cambiará a `Acuse de recepción confirmado ✓`.
5. Vuelve a iniciar sesión como **Profesor** o **Admin**. En el aviso correspondiente, haz clic en **"Ver Acuses de Recepción"**. Deberías ver listado al estudiante con su nombre, correo y la fecha/hora en la que leyó el aviso.
