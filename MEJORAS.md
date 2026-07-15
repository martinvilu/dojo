


## 1. Experiencia del Estudiante

* **Gamificación**: Incorporar un sistema de puntos, niveles o medallas (badges) al completar tareas, entregar a tiempo o asistir a clases. Esto aumentaría la motivación y participación.
* **Módulo de Tutorías Académicas**: Espacio para conectar a alumnos avanzados (tutores) con estudiantes que requieren ayuda, facilitando la reserva de horarios de mentoría y videollamadas de consulta.
* **Grupos de Cursada Auto-organizados**: Herramienta de emparejamiento inteligente que permita a los estudiantes formar grupos de estudio para tareas grupales o resolver dudas de forma autónoma con compañeros de horarios afines.
* **Foros y Preguntas y Respuestas**: Implementar un sistema de comentarios o hilos de discusión dentro de cada clase y tarea, permitiendo a los estudiantes interactuar entre sí y consultar dudas directamente asociadas al contenido. Que incluya un modo "Stack Overflow" en donde se elige la respuesta correcta. (Como Github discussions) Asimismo, que permita agregar reacciones y comentarios.


## 2. Experiencia Docente

* **Registro de Asistencia mediante QR Dinámico**: Permitir al profesor proyectar en el aula física un código QR que cambia cada 10 segundos, de manera que los estudiantes puedan escanearlo con sus dispositivos para firmar su asistencia en la clase en tiempo real con geolocalización.
* **Integración Bidireccional con Hojas de Cálculo (Google Sheets)**: Crear una exportación de notas y listado de alumnos directa a hojas de Google Drive y permitir que el docente actualice notas en el Sheets y se sincronicen de regreso a la plataforma de forma automática.
* **Alertas Tempranas de Desempeño**: System automático que notifique al docente sobre estudiantes que presenten inasistencias reiteradas o encadenen múltiples entregas de tareas ausentes, identificando casos de riesgo académico de manera proactiva.
* **Espacio de Co-Docencia Coordinada**: Funcionalidades específicas para cursos compartidos con múltiples ayudantes de cátedra, permitiendo asignar entregas para corregir según comisiones o distribuir tareas de soporte en foros.
* **Tablero Kanban para Planificación Curricular**: Vista ágil tipo Kanban para que el docente organice las clases del cronograma base arrastrando temas y recursos de manera interactiva.
* **Módulo de Encuestas Estudiantiles Anónimas**: Permitir a los docentes crear sondeos rápidos y anónimos sobre la marcha de las clases o la dificultad de los contenidos para ajustar la metodología pedagógica en tiempo real.
* **Dashboard docente**: Una página que reuna todos los pendientes de las cátedras asignadas, incluyendo correcciones, preguntas y otras interacciones con los estudiantes.


## 3. Infraestructura y Plataforma
* **Paginación en Firestore**: Implementar estrategias de caché y limitación/paginación (cursors) en las tablas de entregas si el proyecto escala a muchas cátedras, para optimizar costos de operaciones y lecturas.
* **Modo Oscuro Integrado y Temas de Accesibilidad**: Alternador nativo de interfaz oscura y soporte para paletas de alto contraste o tipografías aptas para personas con dislexia.
* **Bitácora de Auditoría de Notas (Audit Logs)**: Registro histórico inmutable de modificaciones sobre calificaciones y entregas, con detalle del usuario responsable y fecha, garantizando transparencia académica y control de cambios.
* **Control de Versiones y Comparación de Cronogramas**: Historial de versiones del cronograma de cada cátedra con herramientas visuales para restaurar cambios o comparar variaciones curriculares interanuales.
* **Backups Incrementales y Recuperación Granular**: Respaldos continuos en la nube para las colecciones críticas con posibilidad de restaurar documentos individuales de Firestore en caso de errores de usuario.
* **Compresión y Optimización Multimedia**: Compresor de archivos en background para optimizar automáticamente materiales didácticos, grabaciones y lecturas de cátedra, reduciendo ancho de banda en accesos de estudiantes con conexiones lentas.
