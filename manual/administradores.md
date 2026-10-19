# 🛡️ Manual del Administrador

Funciones reservadas al rol **Administrador**: alta de cátedras, gestión de cuentas y roles, asignación de docentes, configuración global y respaldos. Para el despliegue y la operación técnica, ver el [Manual de Operación](../docs/OPERACION.md).

```{important}
El administrador puede borrar usuarios de forma irreversible y descargar respaldos con datos sensibles (incluidos los tokens de GitHub y Moodle de las cátedras). Tratá esos archivos como secretos.
```

---

## 1. Cátedras

En **Cátedras** (barra lateral):

1. En **Gestión de Cátedras**, completá **Nombre de la Cátedra** (ej. «Programación II») y **Organización GitHub** (ej. `unrn-prog2-2026`).
2. Presioná **Crear Nueva Cátedra**. Se generan automáticamente el código de invitación para estudiantes y los secretos de suscripción.
3. **Ver Detalle** abre la cátedra con las mismas pestañas que ve el docente.

La baja de cátedras todavía no tiene botón en la interfaz: existe la acción de backend `deleteCourse`, reservada al administrador. Para cerrar una cursada sin borrar datos, archivá sus tareas.

## 2. Usuarios

### 2.1. Aprobar cuentas

Las cuentas nuevas quedan **pendientes**. Los estudiantes que validan su matrícula UNRN se aprueban solos; al resto (docentes, invitados, estudiantes sin matrícula) los aprobás vos.

En **Usuarios**, buscá a la persona y presioná **Aprobar**. También hay una vista con buscador en `/dashboard/users`.

### 2.2. Roles y datos del perfil

- Cambiá el rol con el selector: **Administrador**, **Profesor** o **Estudiante**. El cambio aplica en la siguiente acción del usuario.
- Asigná la **comisión** desde el selector de la fila.
- **✏️ Editar** abre el perfil completo: **Nombre Completo**, rol, **Estado de Cuenta** (Aprobado / Pendiente), **Comisión**, **Matrícula** y **Cohorte**. Confirmá con **Guardar Cambios**.

### 2.3. Dar de alta a un docente

1. Pedile que ingrese una vez a la plataforma (queda como estudiante pendiente).
2. En **Usuarios**, aprobá la cuenta y cambiá su rol a **Profesor**.
3. En **Cátedras → Ver Detalle → Docentes**, elegí el docente en **Asignar Nuevo Profesor** y confirmá.
4. Para quitarlo de la cátedra, usá la columna **Acciones** de esa misma tabla.

```{note}
Las cátedras también tienen códigos de invitación de docente (`T-…`) y de ayudante (`A-…`) que asignan el rol automáticamente, pero hoy no se muestran en ninguna pantalla y el campo de inscripción solo acepta 6 caracteres. Usá el procedimiento de arriba (ver [ROADMAP H2](../docs/ROADMAP.md)).
```

### 2.4. Borrar un usuario

1. En la fila del usuario, presioná **Borrar**.
2. Leé la **Advertencia: Borrar Usuario** y confirmá con **Sí, borrar permanentemente**.

Se eliminan, sin vuelta atrás:

- la cuenta de inicio de sesión (Firebase Auth);
- el perfil;
- sus inscripciones en las cursadas (quedan registros huérfanos en `enrollments`, ver [ROADMAP H7](../docs/ROADMAP.md));
- sus asignaciones como docente o ayudante.

Las entregas y notas históricas se conservan.

## 3. Configuración global

En **Configuración → Configuración Global del Sistema**, cargá la URL de un calendario ICS institucional (por ejemplo, el de feriados y mesas de examen de la universidad) y presioná **Guardar Configuración**.

```{note}
Hoy la URL global se guarda pero ningún calendario la usa todavía (ver [ROADMAP H12](../docs/ROADMAP.md)). Para que un calendario externo aparezca en el feed de una cátedra, cargalo en **Ajustes Cátedra → Calendarios Externos ICS**.
```

## 4. Respaldos

En **Respaldos**:

- **💾 Crear Respaldo Completo Ahora**: guarda una instantánea de **cátedras**, **tareas** y **usuarios/perfiles**.
- **Descargar JSON**: baja el respaldo a tu computadora.
- **Restauración Granular**: elegí un elemento (cátedra, tarea o perfil) del respaldo y presioná **Restaurar** para devolverlo a ese estado sin tocar el resto.

```{warning}
El respaldo integrado **no incluye** entregas, asistencia, avisos, foros ni el historial de notas, y puede fallar con bases grandes (límite de 1 MiB por documento de Firestore). Para un respaldo completo, programá exportaciones de Firestore (ver [Manual de Operación §5](../docs/OPERACION.md)).
```

## 5. Integración LTI 1.3 con Moodle

La herramienta se registra en Moodle con URLs del **dominio de la app** (App Hosting), no de Cloud Functions:

| Dato | Valor |
|---|---|
| URL de la herramienta / launch | `https://<dominio>/api/lti/launch` |
| Keyset (JWKS) | `https://<dominio>/api/lti/jwks` |
| Deep Linking (Content Selection URL) | `https://<dominio>/api/lti/deeplink` |
| Servicios | Assignment and Grade Services, Names and Role Provisioning |

Cada docente encuentra la guía completa de registro en **Ajustes Cátedra → 🎓 Integración Moodle → 📖 Guía de Registro LTI**. El detalle técnico está en [MOODLE_INTEGRATION.md](../docs/MOODLE_INTEGRATION.md).

```{note}
Los estudiantes que llegan desde Moodle por primera vez se inscriben solos solo en cátedras con Moodle habilitado, nunca como docentes, y en estado pendiente.
```

## 6. Calendario

**Calendario Global** muestra los eventos de todas las cátedras, con los mismos filtros y vistas que el resto de los roles.
