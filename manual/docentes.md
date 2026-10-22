# 👨‍🏫 Manual Detallado del Docente

Este manual describe minuciosamente cada flujo de trabajo y herramienta disponible para **Docentes** y **Jefes de Trabajos Prácticos (JTP)** en Jutsu Classroom.

```{note}
Para acceder a estas funcionalidades, tu usuario debe tener asignado el rol `teacher` o `admin` y poseer el estado de cuenta `approved`.
```

---

## 1. Configuración de Cátedras e Integración con GitHub

### 1.1 Creación y Gestión de Cátedras
1. En la barra lateral izquierda, selecciona la pestaña **Mis Cátedras (Docente)**.
2. Para crear una nueva materia, haz clic en **+ Nueva Cátedra**.
3. Completa el nombre de la materia (ejemplo: *Programación II - 2026*).
4. El sistema generará automáticamente un **Código de Invitación** alfanumérico.

```{tip}
Comparte el Código de Invitación con tus estudiantes para que puedan enrolarse en la materia sin necesidad de cargarlos uno por uno.
```

### 1.2 Configuración del Token de GitHub
Para habilitar la creación automática de repositorios y la inspección de entregas:
1. Dentro de la cátedra, dirígete a **Configuración de Cátedra**.
2. Completa los siguientes campos:
   - **Organización de GitHub (`github_org`)**: El nombre exacto de la organización de GitHub de la materia.
   - **Token de Acceso Personal (`github_token`)**: Un token de GitHub con permisos `repo`, `admin:org` y `read:user`.
3. Haz clic en **Guardar Configuración**.

---

## 2. Planificación del Cronograma y Clases

### 2.1 Carga de Instancias de Clase
El cronograma de clases permite definir las sesiones del cuatrimestre:
- **Número de Clase**: Índice correlativo de la sesión.
- **Fecha**: Día programado (formato `YYYY-MM-DD`).
- **Tema / Título**: Descripción de los temas a abordar.
- **Estado Especial**:
  - `Normal`: Clase presencial habitual.
  - `Clase Remota`: Sesión por videoconferencia.
  - `Examen`: Parcial o final (destacado en color violeta).
  - `Feriado`: Sin actividad (marcado con línea punteada roja).
- **Enlace de Grabación (`video_url`)**: Enlace directo al video grabado (YouTube, Drive, Vimeo).

### 2.2 Marcadores Temporales en Grabaciones (Bookmarks)
Para guiar a los estudiantes en la revisión de los videos grabados:
1. Haz clic en una clase que contenga un `video_url` cargado.
2. En el panel modal, desplázate a la sección **🔖 Marcadores Temporales**.
3. Ingresa el minuto/segundo (ej: `14:30`) y la etiqueta (ej: *Demostración del algoritmo de ordenamiento*).
4. Haz clic en **+ Agregar**. El marcador quedará guardado para todos los estudiantes de la cátedra.

---

## 3. Control de Asistencia mediante Código QR Dinámico y Geo-Fence

### 3.1 Generación de Código QR
1. Desde el cronograma de clases, haz clic en el botón **📷 Asistencia QR** de la clase del día.
2. La pantalla proyectará un código QR gigante acompañado por un código alfanumérico de 6 caracteres.

```{warning}
El código cambia cada **15 segundos** y se acepta hasta 30 segundos después de mostrarse. La sesión dura **5 minutos**: con **🔄 Renovar** se abre otra; al **Cerrar** el proyector nadie más puede firmar.
```

### 3.2 Proximidad Geográfica (Geo-Fence / Haversine)
Si al generar el QR el navegador comparte la ubicación del aula:
- El servidor calcula la distancia física mediante la fórmula de Haversine entre las coordenadas GPS del docente y las del estudiante.
- El estudiante **tiene que** compartir su ubicación para firmar, y si está a más de **150 metros** del aula el registro se rechaza.
- Solo pueden firmar los estudiantes inscriptos en la cátedra, y el presente suma XP una sola vez por clase.

---

## 4. Gestión de Tareas y Calificaciones

### 4.1 Creación de Asignaciones (Trabajos Prácticos)
1. Ve a la pestaña **Tareas / Entregas** dentro de la cátedra.
2. Haz clic en **+ Crear Nueva Tarea**.
3. Define los siguientes parámetros:
   - **Título**: Nombre del trabajo práctico.
   - **Descripción / Consigna**: Explicación detallada.
   - **Fecha Límite (`due_date`)**: Fecha y hora tope para entregar a tiempo.
   - **Repositorio Template (`template_repo`)**: Opcional. Repositorio base de GitHub que se clonará automáticamente en la cuenta de cada alumno.

### 4.2 Inspección de Commits, Pull Requests y Comentarios
Al ingresar al detalle de la entrega de un estudiante:
- **Vista de Commits**: Gráfico interactivo con la lista de commits, autor, mensaje, fecha y rama (`main`, `dev`).
- **Pull Requests**: Estado de los PRs creados por el estudiante.
- **Comentarios en Código**: Lectura de los comentarios dejados en el repositorio de GitHub.

### 4.3 Calificación y Retroalimentación
1. Ingresa la calificación numérica o cualitativa en el campo **Nota**.
2. Escribe una devolución detallada en el campo **Feedback**.
3. Haz clic en **Guardar Calificación**. El estudiante recibirá una notificación en su panel.

---

## 5. Avisos a la Cátedra con Acuse de Recepción

1. En la pestaña **Avisos**, escribe el mensaje a transmitir a los estudiantes.
2. Haz clic en **Publicar Aviso**.
3. Podrás inspeccionar la lista de **Acuses de Recepción** en tiempo real para verificar exactamente qué alumnos leyeron la publicación y en qué fecha/hora.

---

## 6. Sincronización de Calendarios iCal (.ics)

1. Dirígete a la pestaña **Calendario**.
2. Selecciona la materia o el *🌐 Calendario Global*.
3. Haz clic en el botón **`📥 Exportar .ics`**.
4. El archivo descargado puede ser importado en Google Calendar, Apple Calendar o Microsoft Outlook para mantener sincronizadas las fechas de parciales y entregas.

---

## 7. Moodle con LTI 1.3 {#moodle-lti-13}

Con LTI 1.3 los estudiantes y docentes entran al Dojo desde Moodle sin volver a iniciar sesión, el padrón se importa solo (NRPS) y las notas se publican en el libro de calificaciones de Moodle (AGS).

### 7.1 Registrar el Dojo en Moodle (una vez por campus)
1. En **Ajustes Cátedra**, activá **🔌 Integración con Moodle** y abrí el panel **🔗 Moodle LTI 1.3 Advantage**.
2. Hacé clic en **Generar URL de registro dinámico** y copiala. La URL vence en una hora y sirve una sola vez.
3. En Moodle: *Administración del sitio → Plugins → Actividades → Herramienta externa → Gestionar herramientas*, pegá la URL en **URL de la herramienta** y elegí **Agregar LTI Advantage**. Moodle abre una ventana, se registra y la cierra.
4. Activá la herramienta en la lista de Moodle.

```{note}
Agregar herramientas externas en Moodle suele requerir permisos de **administrador del sitio**. Si tu rol no los tiene, pasale al administrador del campus la URL generada en el paso 2; si el campus no ofrece registro dinámico, usá **Registro manual** en el mismo panel con los datos que muestra el Dojo (login, redirección, JWKS y el parámetro `courseId`).
```

### 7.2 Aprobación
La plataforma queda **Pendiente de aprobación** hasta que un administrador del Dojo la aprueba. Mientras tanto:
- los estudiantes pueden entrar, pero con una cuenta nueva y la inscripción pendiente;
- los docentes no pueden entrar desde Moodle;
- no se vinculan cuentas existentes por email o matrícula.

Esto evita que alguien registre un Moodle propio y entre con la cuenta de otra persona.

### 7.3 Uso diario
- **Agregar una actividad**: en el curso de Moodle, *Agregar actividad → Ninja Dojo → Seleccionar contenido* abre el selector del Dojo (cronograma, TPs, Mi cursada, etc.).
- **Padrón**: en el panel LTI, **👥 Sincronizar padrón (NRPS)** da de alta a los inscriptos de Moodle y marca como *baja* a quienes ya no están (solo si habían entrado por Moodle).
- **Notas**: cada nota que cargás en el Dojo se publica sola en Moodle; también podés usar **📤 LTI** en una tarea o **📤 Publicar en Moodle** en un parcial. La escala 0–10 se convierte al máximo del ítem en Moodle.
- El curso de Moodle queda vinculado la primera vez que alguien abre la actividad; hasta entonces el padrón y las notas no tienen a dónde sincronizar.


## 8. Ayudantes por comisión {#ayudantes}

Al asignar un docente, el administrador elige si es **titular** o **ayudante**. En la pestaña **Docentes**, el titular marca las comisiones de cada ayudante:

- Con comisiones marcadas, el ayudante solo califica, toma asistencia, carga notas de parciales y otorga excepciones a estudiantes de esas comisiones, y en **Cursada** solo ve esos estudiantes.
- Sin ninguna marcada, ve toda la cursada (como hasta ahora).
- Cambiar a un estudiante de comisión (pestaña **Alumnos**) es tarea del titular.

En **Control de Asistencia** el ayudante guarda solo lo que se ve con el filtro de su comisión. Además de Presente, Tarde y Ausente existe **Justificada**: no cuenta para el porcentaje de asistencia.

## 9. Cierre de cursada y actas {#cierre}

En **Cursada → Cierre**:

1. **Casos borde**: estudiantes a un paso de promocionar o regularizar, para revisarlos antes de cerrar.
2. **Simulador**: probá otra asistencia mínima, notas de aprobación o promoción, o la regla de recuperatorios, y mirá cuántos estudiantes cambian de condición. No guarda nada; para cambiar las reglas de verdad usá **Reglas**.
3. **Cerrar cursada y congelar acta** (solo el titular): guarda la condición final de cada estudiante con las reglas vigentes y un código de verificación (hash). Desde ese momento no se pueden cargar notas, asistencia, QR ni excepciones. Los estudiantes ven su condición final en lugar de la provisional; quien no regularizó figura como **Libre**.
4. **CSV para SIU Guaraní**: descargá el acta y cargala en SIU. El archivo trae legajo, nombre, comisión, condición, nota (promedio de parciales, solo para promocionados) y fecha. Revisá que las columnas coincidan con la plantilla de importación de tu unidad académica; las filas sin matrícula vienen marcadas.
5. **Reabrir**: si hay que corregir algo, el titular reabre con un motivo. El acta anterior queda guardada, y al volver a cerrar se genera la versión siguiente. Cada cierre y reapertura queda en el registro de auditoría.

Si una versión del acta aparece como **"no coincide con su hash"**, alguien la modificó fuera del Dojo: no se exporta y hay que avisar a un administrador.
