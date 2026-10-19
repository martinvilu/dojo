# 👨‍🏫 Manual del Docente

Flujos de trabajo para **docentes titulares** y **ayudantes de cátedra**: configurar la materia, planificar el cronograma, tomar asistencia, gestionar tareas con GitHub, comunicarse con los estudiantes y seguir su desempeño.

```{note}
Necesitás rol **Profesor** y estar asignado a la cátedra. Las dos cosas las hace un administrador (ver [Administradores](administradores.md)).

Los **ayudantes** corrigen entregas, toman asistencia, publican avisos, envían correos y siguen las alertas. Lo estructural queda para el **titular**: ajustes de la cátedra, cronograma y sus versiones, crear, editar o archivar tareas, revisión entre pares y sincronización de alumnos con Moodle o Guaraní. Esas opciones no se les muestran.
```

---

## 1. Tus cátedras

**Mis Cátedras** muestra una tarjeta por materia asignada, con la organización de GitHub, el **Código de Invitación Estudiante** y el estado de la cátedra.

- Compartí el **código de invitación** con tus estudiantes: lo ingresan en su panel para inscribirse.
- Hacé clic en la tarjeta para entrar. La primera pestaña es **📊 Resumen**.

## 2. Configurar la cátedra — *Ajustes Cátedra*

Completá esta pestaña al comienzo del cuatrimestre y presioná **Guardar Configuración**.

| Sección | Campos |
|---|---|
| **Datos Generales** | **Fecha de Inicio de Cursada**, **Duración en Semanas**, **GitHub Personal Access Token (PAT)**, **Calendarios Externos ICS** (URLs separadas por comas) y **Texto de Portada** |
| **📅 URL del Calendario de la Cátedra** | URL de suscripción para Moodle o Google Calendar (**Copiar** / **📅 Google Calendar**) |
| **Horarios Semanales recurrentes** | Día, **Hora Inicio** y **Tipo clase** (Teoría, Práctica o Laboratorio). **Añadir Horario** / **Eliminar** |
| **Co-Docencia & Responsables de Comisión** | **Agregar Comisión** y asignar un docente responsable a cada una |
| **📊 Sincronización de Planilla de Notas** | URL para conectar las notas con Google Sheets o Excel |
| **Clonar Ajustes de Otra Cátedra** | Copia la configuración de otra materia tuya (por ejemplo, la cursada anterior) |
| **🎓 Integración Moodle** | Ver §10 |

### 2.1. Token de GitHub

El PAT permite crear los repositorios de los estudiantes y leer su actividad.

1. Usá el enlace **🔑 Generar PAT en GitHub con permisos necesarios (repo, admin:org) ↗**.
2. Pegá el token y guardá.

```{important}
El token nunca vuelve a mostrarse: la plataforma lo usa solo en el servidor. Si vence, generá uno nuevo y guardalo de nuevo. La organización de GitHub de la materia la define el administrador al crear la cátedra.
```

## 3. Cronograma — *Cronograma*

### 3.1. Generar las clases

Con la fecha de inicio, la duración y los horarios ya cargados en **Ajustes Cátedra**, presioná **🔄 Regenerar Clases** en **Gestión de Clases**. Se crea una clase por cada horario semanal durante toda la cursada.

```{warning}
Regenerar reemplaza la lista de clases: perdés los temas, enlaces y estados especiales ya cargados (la plataforma pide confirmación). Si ya los cargaste, guardá antes una versión (§3.4).
```

### 3.2. Editar cada clase

| Campo | Uso |
|---|---|
| Estado | **Normal**, **Clase Remota**, **Examen** o **Feriado / Sin Clase** |
| **Tema Principal** | Título visible en el cronograma y el calendario |
| **Descripción / Contenido** | Texto con formato Markdown (barra de herramientas incluida) |
| **Link Presentación / Material** | Diapositivas, apuntes |
| **Link Grabación Clase** | YouTube, Drive, Vimeo |

Presioná **💾 Guardar Cronograma**. Cada guardado crea además una versión automática.

### 3.3. Vista Kanban

**📊 Tablero Kanban** muestra las clases en cuatro columnas (**📖 Teóricas**, **🛠️ Prácticas**, **🌴 Feriados**, **🏆 Exámenes**). Arrastrá una clase a otra columna para cambiar su tipo o estado y después presioná **💾 Guardar Cronograma**. **📋 Lista** vuelve a la vista normal.

### 3.4. Versiones y comparación

- **💾 Guardar Versión**: guarda una instantánea con nombre (ej. «Planificación Inicial 2026»).
- **📜 Historial/Comparar**: lista las **Versiones Guardadas** con su autor y permite **Restaurar** una. La restauración se confirma recién al presionar **💾 Guardar Cronograma**. En **Comparación Interanual**, **📂 Cargar Otras Cátedras** muestra el diff de clases contra otra cursada.

### 3.5. Encuestas y foro de cada clase

- **📊 Feedback Anónimo**: valoración promedio, cantidad de encuestas completadas, nivel de comprensión general y comentarios escritos de los estudiantes.
- **Foro de Consultas**: respondé las preguntas y marcá la mejor respuesta como **✔️ Solución** (suma XP al autor). Como moderador podés **Borrar** cualquier mensaje de tu cátedra; cada autor puede editar o borrar los suyos.

## 4. Asistencia

En cada clase del cronograma, **📋 Control de Asistencia** abre la planilla de esa clase.

### 4.1. Carga manual

Filtrá por comisión, marcá a cada estudiante como **Presente**, **Tarde** o **Ausente** y presioná **Guardar**.

### 4.2. QR dinámico

1. Presioná **🛡️ Generar QR Dinámico**. Si el navegador lo pide, permití la ubicación.
2. Proyectá el código. Cambia solo cada **15 segundos** («El código rota en: N s») y cada código vale como máximo 30 segundos, así que una foto del QR no sirve para firmar después. **🔄 Renovar** inicia una sesión nueva e invalida los códigos anteriores.
3. Los estudiantes lo escanean o escriben el código de 6 caracteres.
4. **Cerrar** termina la toma: desde ese momento ningún código es válido.

```{tip}
Si compartiste tu ubicación al generar el QR, los estudiantes también tienen que compartir la suya y el servidor rechaza a quienes estén a más de 150 m. Si generaste el QR sin ubicación, la pantalla lo avisa y no se controla la distancia.
```

## 5. Tareas y corrección — *Tareas*

### 5.1. Crear una tarea

Presioná **➕ Crear Nueva Tarea** y completá:

- **Título de la Tarea** (ej. «Trabajo Práctico 1»).
- **Repositorio Plantilla (org/repo)**: repositorio base que se copia para cada estudiante (ej. `unrn-prog2-2026/tp1-plantilla`).
- **Crear Pull Request de Feedback**: abre un PR en cada repositorio para dejar comentarios de corrección.
- **Tarea Grupal**: pide un nombre de equipo al aceptar.

Presioná **Crear Tarea**. Para cambiarla, **Editar** → **Guardar Cambios**.

```{warning}
El formulario todavía no tiene campos de **consigna** ni de **fecha límite**. Sin fecha límite, la tarea no aparece en el calendario y no dispara la alerta de «Tareas Atrasadas». Publicá la consigna y la fecha en un aviso o en la descripción de la clase hasta que se agreguen (ver [ROADMAP H1](../docs/ROADMAP.md)).
```

### 5.2. Herramientas de cada tarea

| Botón | Qué hace |
|---|---|
| **📂 Ver Entregas y Actividad** | Abre la lista de entregas |
| **🕵️ Detectar Plagio** | Compara todas las entregas con repositorio y marca los pares sospechosos con **⚠ Copia probable** (necesita al menos dos entregas) |
| **📥 Descargar Plantilla Notas** / **📤 Cargar Notas CSV** | Corregir en planilla y subir las notas en bloque |
| **🤖 Plantilla Autograding** | Workflow de GitHub Actions que envía las notas automáticas a la plataforma |
| **📤 Moodle** | Exporta las notas de la tarea al libro de calificaciones de Moodle |
| **Archivar (Solo Lectura)** | Cierra la tarea |

### 5.3. Corregir una entrega

1. En **Entregas de los Estudiantes**, filtrá por **Comisión** si hace falta.
2. Revisá **Ver Actividad GitHub (Commits, PRs, Comentarios)**. La pestaña **📈 Métricas** muestra la frecuencia semanal de commits (últimas 6 semanas), los horarios de trabajo y el estado de los PRs.
3. Cargá la **Nota** y el **Feedback / Comentario** y presioná **Guardar Calificación**.

La nota puede ser numérica de **0 a 10** (con coma o punto: `7,5`) o conceptual, solo con letras (`Aprobado`, `Ausente`). Otros formatos se rechazan. Las notas conceptuales no se sincronizan con Moodle.

Cada cambio queda en el **Historial de Calificaciones (Inmutable)**, visible con **Ver Bitácora de Auditoría**.

### 5.4. Revisión entre pares

En **👥 Revisión entre Pares**, **Activar** habilita que cada estudiante revise 2 entregas de compañeros con una rúbrica, de forma anónima.

```{warning}
Hoy la activación desde la pantalla falla con «La rúbrica debe tener entre 1 y 8 criterios», porque la pantalla todavía no permite definir la rúbrica (ver [ROADMAP H9](../docs/ROADMAP.md)).
```

## 6. Avisos — *Avisos*

1. En **Publicar Aviso a Alumnos**, escribí el mensaje (admite Markdown).
2. Presioná **Enviar Aviso**.
3. Debajo de cada aviso, **Leído por** lista quién confirmó la recepción y cuándo.

## 7. Seguimiento del curso

### 7.1. Resumen

**📊 Resumen** concentra lo urgente: trabajos entregados sin nota, alumnos en riesgo y entregas totales; la **Cola de Corrección de Trabajos**, las **Consultas Recientes en Clases** y los **Alumnos que requieren Atención**.

### 7.2. Alumnos y Alertas

La tabla muestra, por estudiante, matrícula, asistencia, tareas entregadas, alertas y condición (**REGULAR** / **EN RIESGO**). Las alertas son:

- **Asistencia Crítica (<75%)**, a partir de 3 clases registradas.
- **Tareas Atrasadas**: tareas vencidas sin entrega.

Acciones:

- **📢 Alertas Automáticas**: notifica a los estudiantes en riesgo.
- **📄 Descargar Reporte PDF**: reporte académico de la cátedra.
- **✉️ Email**: correo directo a un estudiante.
- **▼ Mostrar URL** → **Copiar URL CSV**: URL para Google Sheets con `=IMPORTDATA("…")`, que mantiene el roster y las alertas sincronizados.

### 7.3. Predicción de abandono

**🔮 Calcular Riesgo de Abandono** asigna a cada estudiante un puntaje de 0 a 100 y un nivel (ALTO, MEDIO o BAJO) con el detalle de cada factor: asistencia (45 %), tareas pendientes (35 %), entregas tardías (10 %) y participación en el foro (10 %). **🔄 Recalcular Riesgo** lo actualiza.

## 8. Correos — *Gestión Correos*

1. Autorizá tu cuenta: **🔑 Autorizar Cuenta Gmail** (o desde **Mi Perfil**). Podés probarla con **✉️ Enviar Correo de Prueba**.
2. **+ Programar Nuevo Correo**: título interno, destinatarios (**👥 Todos los Estudiantes de la Cátedra** o **⚠️ Estudiantes con Alertas o Inasistencias Críticas**), asunto, contenido HTML y en cuántas horas se envía.
3. Usá las variables `{{student_name}}` y `{{course_name}}` para personalizar el mensaje, o elegí una plantilla con **Seleccionar Plantilla**.
4. En **Cola de Correos Programados** podés cancelar o enviar un correo en el momento. **Historial de Correos Enviados** muestra cada envío y su estado.

## 9. Equipo docente — *Docentes*

Lista a los docentes asignados a la cátedra. Asignar o quitar docentes lo hace un administrador.

## 10. Integración con Moodle

En **Ajustes Cátedra → 🎓 Integración Extendida Moodle 4.2+**:

1. Completá **URL del Servidor Moodle**, **Web Service Token (wstoken)** e **ID del Curso en Moodle**.
2. Usá:
   - **👥 Sincronizar Alumnos**: importa el roster del curso de Moodle.
   - **📚 Importar Contenidos**: trae temas y clases.
   - **📥 Descargar Respaldo XML**: exporta la cátedra en formato de respaldo de Moodle.
   - **🔗 LTI Deep Linking**: genera enlaces LTI 1.3 a los módulos de la cátedra para insertarlos en Moodle.
3. **📖 Guía de Registro LTI** explica, paso a paso, cómo registrar la herramienta externa en Moodle. El detalle técnico está en [MOODLE_INTEGRATION.md](../docs/MOODLE_INTEGRATION.md).

Las notas numéricas se envían a Moodle al calificar, si la cátedra tiene Moodle habilitado y la entrega llegó desde un launch LTI.

## 11. Calendario

**Calendario Global** muestra las clases, exámenes, feriados y entregas de todas tus cátedras, con las mismas opciones que ven los estudiantes (ver [Estudiantes §6](estudiantes.md)).
