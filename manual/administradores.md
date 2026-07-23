# 🛡️ Manual del Administrador del Sistema

Este manual documenta las funciones avanzadas reservedas para los usuarios con el rol `admin` en Jutsu Classroom.

```{important}
El rol de Administrador posee acceso total al sistema, incluyendo la capacidad de eliminar usuarios en Auth/Firestore, descargar volcados de base de datos y restaurar versiones del sistema.
```

---

## 1. Panel de Administración de Usuarios (`AdminPanel`)

### 1.1 Aprobación de Cuentas Nuevas
1. Accede a la pestaña **Panel Admin** en el menú lateral.
2. En la sección **Usuarios Pendientes de Aprobación**, revisa las solicitudes registradas.
3. Haz clic en **Aprobar Usuario** para concederle acceso a la plataforma.

### 1.2 Cambios de Rol
- Puedes modificar el rol de cualquier usuario registrado entre `admin`, `teacher` y `student` desde el selector desplegable.
- El cambio impacta inmediatamente en las reglas de seguridad de Firestore y Auth.

### 1.3 Eliminación Física de Usuarios en Cascada
1. En la tabla de usuarios, ubica al usuario y haz clic en el botón rojo **🗑️ Borrar Usuario**.
2. Se desplegará un **Modal de Advertencia Crítica** solicitando confirmación explícita.
3. Al confirmar, el sistema ejecuta la acción remota `deleteUser` que borra:
   - Su cuenta en **Firebase Auth**.
   - Su documento de perfil en la colección `/profiles/{uid}`.
   - Todas sus inscripciones en `/course_roster` y `/enrollments`.
   - Sus asignaciones docentes en `/course_teachers`.

---

## 2. Gestión de Respaldos de Sistema (Backups JSON)

### 2.1 Crear un Respaldo Completo
1. Ve a la sección **Respaldos de Sistema**.
2. Haz clic en **📦 Crear Respaldo Ahora**.
3. El sistema tomará una captura instantánea de las colecciones `courses`, `assignments` y `profiles`.

### 2.2 Descarga y Restauración Granular
- **Descargar Backup**: Haz clic en **📥 Descargar JSON** para bajar el volcado completo comprimido a tu computadora local.
- **Restaurar Elemento**: Permite seleccionar una colección y el ID de un documento para restaurar una versión previa de manera individual sin afectar el resto de la base de datos.

---

## 3. Control de Versiones de Cronograma (VCS)

Los administradores y docentes titulares pueden inspeccionar el historial de versiones del cronograma:
- Cada cambio en las instancias de clase guarda automáticamente un snap con la versión, fecha, hora y autor.
- Permite comparar versiones previas (*Diff View*) y restaurar una versión anterior en caliente.

---

## 4. Integración LTI 1.3 con Moodle (4.2+)

Jutsu Classroom soporta integración LTI 1.3 Advantage con Moodle:
- **JWKS Endpoint**: `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/api/lti/jwks`
- **Launch Endpoint**: `https://us-central1-jutsu-classroom-mrtin.cloudfunctions.net/api/lti/launch`

```{note}
Para más detalles sobre la configuración de llaves públicas RSA y JWT con Moodle, consulta la guía [MOODLE_INTEGRATION.md](file:///home/mrtin/dev/gaula/docs/MOODLE_INTEGRATION.md).
```
