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

### Estudiantes Adicionales (Seed)
Adicionalmente, se crean **20 estudiantes extra** con UIDs del tipo `student_extra_1` al `student_extra_20` (con correos como `sasukeuchiha@jutsu.com`, `sakuraharuno@jutsu.com`, hasta `saradauchiha@jutsu.com`). 
- Todos están inscriptos y registrados en la cátedra `course123`.
- Su estado de aprobación (`account_status`) se define alternadamente (los de índice par en estado `approved` y los impares en `pending`) para facilitar pruebas.
- Cuentan con matrículas institucionales precargadas (`UNRN-10010` en adelante).

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

### 4. Aprobación de Matrículas Pendientes (Admin)
1. Inicia sesión como el **Admin** (`admin@jutsu.com`).
2. Dirígete a la pestaña **Usuarios**.
3. Deberías ver a varios de los 20 estudiantes adicionales con estado "Pendiente" y el botón **"Aprobar"** habilitado.
4. Presiona **"Aprobar"** en cualquiera de ellos para verificar que el estado cambie automáticamente a "Aprobado" y se actualice en la base de datos de Firestore.

### 5. Monitoreo de Actividad de GitHub y Calificación Directa (Profesor ↔ Estudiante)
El seed de la base de datos pre-carga una entrega enviada para **Naruto Uzumaki** (`student@jutsu.com`) en la tarea "Clon de Sombra Básico" para realizar pruebas inmediatas.
1. Inicia sesión como el **Profesor** (`teacher@jutsu.com`).
2. Haz clic en **Ver Detalle** de la cátedra "Introducción al Ninjutsu" y navega a la subpestaña **Tareas**.
3. En la tarjeta de la tarea "Clon de Sombra Básico", haz clic en **📂 Ver Entregas y Actividad**.
4. Se desplegará el listado de alumnos. Verás la entrega de Naruto Uzumaki en estado **"Entregado"** con su enlace de repositorio.
5. Haz clic en **🔍 Ver Actividad GitHub**.
6. Se abrirá el panel interactivo en tiempo real con 3 pestañas:
   * **Commits**: Lista de commits en el repositorio con autor, mensaje y fecha.
   * **Pull Requests**: Lista de solicitudes de cambios abiertas/cerradas con enlaces.
   * **Comentarios**: Comentarios de código e hilos de discusión del repositorio.
7. En el formulario de abajo, ingresa una **Nota** (ej: `9`) y un **Feedback** (ej: `Excelente uso del chakra.`), y haz clic en **Guardar Calificación**.
8. Cierra sesión e ingresa como **Estudiante** (`student@jutsu.com`).
9. Ve a la subpestaña **Tareas** y verifica que en "Clon de Sombra Básico" puedes ver tu nota, el feedback, y expandir la misma actividad de tu repositorio mediante la pestaña de actividad en tu panel personal.

### 6. Asistencia QR Dinámica y Geolocalización (Profesor ↔ Estudiante)
1. Inicia sesión como el **Profesor** (`teacher@jutsu.com`).
2. Ingresa a la materia, ve a **Cronograma** y abre la clase deseada presionando **📋 Control de Asistencia**.
3. En la tarjeta de asistencia, haz clic en el botón **🛡️ Generar QR Dinámico**.
4. La aplicación solicitará acceso a tu ubicación GPS (para registrar las coordenadas del aula) y proyectará un modal con un código QR, el código de presentismo alfanumérico de 6 dígitos (ej: `A7B9X2`) y un contador de 5 minutos de expiración.
5. Inicia sesión como **Estudiante** (`student@jutsu.com`) en tu dispositivo (puedes simularlo abriendo otro navegador).
6. Entra a la cátedra y en la clase activa del cronograma verás el botón **📷 Firmar Presente QR**. Haz clic en él.
7. Acepta el acceso a la geolocalización de tu navegador e ingresa el código alfanumérico de 6 caracteres que se muestra en la pantalla del docente.
8. Presiona **Confirmar Presente**.
   * Si estás a menos de 150 metros del docente, tu asistencia se guardará como **Presente** y el badge en tu cronograma cambiará en tiempo real.
   * Si las coordenadas GPS están fuera de rango o el código expiró, el sistema denegará el presente con un mensaje descriptivo.


