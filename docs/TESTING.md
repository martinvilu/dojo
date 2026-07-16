# Guía de Pruebas y Seed Data

Este documento describe cómo levantar el entorno y validar las características de Ninja Dojo (roles, planificación, acuses de recibo).

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

### 7. Alertas Tempranas de Desempeño y Planilla Sheets (Profesor)
1. Inicia sesión como el **Profesor** (`teacher@jutsu.com`).
2. Ingresa a la cátedra y haz clic en la subpestaña **👥 Alumnos y Alertas**.
3. Visualiza la tabla con todos los alumnos inscritos (del seed).
4. Verifica que para aquellos alumnos que tengan asistencia crítica (menor a 75% habiéndose dictado al menos 3 clases) se activa el badge de `⚠️ Asistencia Crítica`.
5. Verifica que si el alumno tiene alguna tarea con fecha límite de entrega ya vencida y no la ha entregado, se activa el badge de `⚠️ Tareas Atrasadas`.
6. En caso de tener alguna de estas alertas, comprueba que la condición del alumno cambie a `EN RIESGO`.
7. Haz clic en **📊 Exportar Planilla (Sheets)**. Verifica que se genera y descarga un archivo `.csv` con la matriz completa del curso estructurada en columnas.

### 8. Rango Ninja y Gamificación (Estudiante)
1. Inicia sesión como el **Estudiante** (`student@jutsu.com`).
2. Ingresa a la cátedra "Introducción al Ninjutsu".
3. En la parte superior verás el panel de **Rango Ninja de Cursada**.
4. Valida tu nivel y barra de XP. Para sumar puntos:
   * Asiste a clases (presentes).
   * Envía tareas y espera que sean calificadas.
   * Comenta en los foros de consulta de cada clase.
   * Haz que tus respuestas en el foro sean marcadas como "Mejor Respuesta" por el profesor.
5. Comprueba que al ganar puntos se actualiza tu nivel en tiempo real y que se desbloquean las medallas respectivas (ej: `🥇 Maestro de Chakra` si tu promedio es >= 9).

### 9. Encuestas Estudiantiles Anónimas (Estudiante ↔ Profesor)
1. Inicia sesión como el **Estudiante** (`student@jutsu.com`), ve a **Cronograma** y busca una clase pasada.
2. Presiona el botón **✍️ Feedback Anónimo**.
3. Califica con estrellas, selecciona tu nivel de comprensión, escribe un comentario sugerido y presiona **Enviar Feedback**.
4. Cierra la sesión e inicia como **Profesor** (`teacher@jutsu.com`).
5. Ve a **Cronograma** y en la misma clase haz clic en **📊 Feedback Anónimo**.
6. Valida que se muestra la valoración promedio, cantidad total de encuestas completadas, gráfico de distribución de comprensión y el listado de sugerencias de forma 100% anónima (sin revelar el nombre ni ID del alumno).

### 10. Gestión Global de Roles en Ruta Directa (Admin)
1. Inicia sesión como **Admin** (`admin@jutsu.com`).
2. Ingresa directamente a la URL del navegador `/dashboard/users`.
3. Valida que el panel carga de forma premium la lista completa de perfiles.
4. Escribe un nombre en la barra de búsqueda y verifica que el filtrado funciona instantáneamente.
5. Cambia el rol de un usuario con el select y presiona aceptar en la confirmación. Verifica que el rol se modifique en Firestore de forma automática.
6. Intenta entrar a `/dashboard/users` con un usuario **Estudiante** o **Profesor** y verifica que el sistema bloquea el acceso de forma segura y lo redirige de vuelta al dashboard general.

### 11. Pruebas de Co-Docencia, Comisiones y Filtrado Rápido (Docente)
1. Inicia sesión como **Profesor** (`teacher@jutsu.com`).
2. Ingresa a la cursada y ve a la pestaña **👥 Alumnos y Alertas**.
3. Cambia la comisión de varios alumnos utilizando el selector desplegable individual en cada fila (asigna algunos a "Comisión A" y otros a "Comisión B").
4. Cambia el filtro general de comisión de "Todas" a "Comisión A" y verifica que la tabla filtra instantáneamente mostrando solo los estudiantes correspondientes.
5. Ve a la pestaña **Ajustes Cátedra** (Settings). En la sección "Co-Docencia & Responsables de Comisión", selecciona un docente responsable para la "Comisión A" (e.g. asociando a tu colega o a ti mismo). Haz clic en **Guardar Configuración**.
6. Ve a la pestaña **Cronograma**, abre el panel **Control de Asistencia** de una clase y filtra la lista de presentismo seleccionando "Comisión A".
7. Ve a la pestaña **Tareas**, abre "Ver Entregas y Actividad" de cualquier tarea y filtra la cola de entregas por la comisión deseada para verificar el filtrado coordinado de correcciones.

### 12. Pruebas de Flujo Rápido en Resumen Docente (Docente / Admin)
1. Inicia sesión como **Profesor** (`teacher@jutsu.com`).
2. Al ingresar a una cátedra, valida que la aplicación aterriza directamente en la pestaña **Resumen**.
3. Verifica que se muestran las tarjetas métricas (Correcciones Pendientes, Alumnos en Riesgo y Entregas Totales).
4. En la tarjeta "Cola de Corrección de Trabajos", busca un entregable pendiente y haz clic en **Evaluar**. Valida que te redirige a la pestaña de Tareas con el entregable abierto.
5. Regresa al **Resumen**, ubica la tarjeta "Consultas Recientes en Clases" y haz clic en **Responder en Foro** de alguna consulta. Valida que te redirige al Cronograma y se despliega automáticamente la sección de comentarios de la clase respectiva.
6. Valida que la tabla "Alumnos que requieren Atención" muestra correctamente solo los alumnos en riesgo y coincide con los mostrados en el panel "Alumnos y Alertas".

### 13. Pruebas de Reorganización en Tablero Kanban (Docente)
1. Inicia sesión como **Profesor** (`teacher@jutsu.com`).
2. Ir a **Cronograma** y activar la vista **Tablero Kanban**.
3. Toma una clase teórica y arrástrala hacia la columna **Prácticas**. Verifica que se mueve visualmente de columna.
4. Toma otra clase y arrástrala hacia la columna **🌴 Feriados**.
5. Presiona **Guardar Cronograma** en la parte superior derecha.
6. Regresa a la vista **Lista** y valida que los cambios aplicados en el Kanban (cambio de tipo "Práctica" y estado "Feriado") se renderizan de forma coherente en el listado.

### 14. Pruebas de Tutorías Académicas entre Pares
1. Inicia sesión con una cuenta de estudiante y navegá a la pestaña **🎓 Tutorías**.
2. Presioná el botón **🤝 Postularme como Tutor**. Escribí los temas fuertes (e.g. "React, Node") y disponibilidad (e.g. "Miércoles 19:00"), y confirmá.
3. Iniciá sesión con otra cuenta de estudiante, ve a la pestaña **🎓 Tutorías** y verificá que el tutor registrado aparece listado en "Tutores Disponibles".
4. Presioná **Reservar Mentoría** en la tarjeta de ese tutor, ingresá una consulta y una fecha/hora y presioná Reservar.
5. Regresá a la cuenta del tutor, verificá que la mentoría aparece en "Mis Tutorías y Mentorías" con estado "Pendiente". Presioná **Aceptar**.
6. Verificá que la sesión pasa a "Confirmada" y se habilita un botón con el enlace a Google Meet para realizar la mentoría.

### 15. Pruebas de Emparejamiento y Grupos de Estudio Auto-organizados
1. Inicia sesión como estudiante y ve a la pestaña **👥 Grupos de Estudio**.
2. Presioná **✨ Crear Nuevo Grupo**, completá los datos del grupo (asigná la preferencia horaria a "Tarde") y crealo.
3. Verificá que el grupo se lista en la columna derecha y figurás en la lista de integrantes.
4. En el panel "Emparejamiento Inteligente", seleccioná "Tarde" y presioná **Buscar Compañeros Afines**.
5. Verificá que el buscador encuentra alumnos que estudian por la tarde, listando su email para contactarlos.

### 16. Pruebas de Snapshot y Control de Versiones de Cronograma
1. Inicia sesión como **Profesor** (`teacher@jutsu.com`) e ingresá a **Cronograma**.
2. Presioná **💾 Guardar Versión**, ingresá "Plan original" como nombre del snapshot y aceptá.
3. Modificá el cronograma (cambiando temas de clases o convirtiendo clases en Feriados/Exámenes).
4. Presioná el botón **📜 Historial/Comparar**.
5. Seleccioná la versión "Plan original" del listado izquierdo.
6. Validá que en el panel derecho se genera un diff interactivo detallando las diferencias (las clases modificadas aparecen en color naranja y muestran la diferencia de tema/tipo).
7. Presioná **Restaurar** en la versión del listado. Validá que el cronograma en pantalla regresa a los temas originales de forma automática.

### 17. Pruebas de Integración con Moodle (LTI Launch & Auto-Enrollment)
1. Simulá un lanzamiento LTI enviando una petición POST con un `id_token` mockeado al endpoint `/api/lti/launch`, o navegá directamente a la ruta de redirección del Dashboard simulando los parámetros de consulta:
   `/dashboard?lti_launch=true&courseId=course123&assignmentId=assign123&lis_outcome_service_url=https://moodle.example.com/mod/lti/service.php&lis_result_sourcedid=sourcedid123`
2. Validá que se ejecuta automáticamente la matrícula del alumno en el curso correspondiente (`course123`) de forma transparente en segundo plano.
3. Si es la primera vez que el alumno ingresa y no tiene su usuario de GitHub configurado en su perfil, validá que la aplicación interrumpe la navegación solicitándole que conecte su cuenta de GitHub mediante un popup no invasivo.
4. Al completar la vinculación del perfil de GitHub, verificá que el alumno es enfocado automáticamente en la tarea (`assign123`) dentro del curso recién matriculado.

### 18. Pruebas del Visualizador de Flujo Git (Commits Visualizer)
1. Iniciá sesión como **Profesor** (`teacher@jutsu.com`) o **Estudiante** (`student@jutsu.com`).
2. Dirigite a la sección de **Tareas** de un curso.
3. Hacé clic en "Ver Entregas y Actividad" (Profesor) o "Actividad en GitHub" (Estudiante) de una tarea.
4. Seleccioná la pestaña **🌳 Gráfico Git & Aporte**.
5. Validá que en el panel "Distribución del Trabajo" se renderizan las barras estadísticas con los porcentajes de commits por alumno.
6. En el panel "Flujo de Ramas y Commits", validá la visualización del gráfico de ramas (`main`, `dev`, `feature/alerts`) representadas verticalmente con círculos de colores interconectados, nombres y avatares de los autores de cada commit.
