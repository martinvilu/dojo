# Potenciales Mejoras para Jutsu Classroom

Este documento detalla una lista de ideas y posibles funcionalidades a incorporar en la plataforma a futuro para mejorar la experiencia tanto de estudiantes como de docentes.

## 1. Experiencia del Estudiante
* **Gamificación:** Incorporar un sistema de puntos, niveles o medallas (badges) al completar tareas, entregar a tiempo o asistir a clases. Esto aumentaría la motivación y participación.
* **Foros y Preguntas y Respuestas:** Implementar un sistema de comentarios o hilos de discusión dentro de cada clase y tarea, permitiendo a los estudiantes interactuar entre sí y consultar dudas directamente asociadas al contenido.
* **Integración de Evaluaciones por Pares (Peer Review):** Permitir que los estudiantes puedan evaluar de forma anónima los trabajos de sus compañeros mediante rúbricas predefinidas, promoviendo el pensamiento crítico.
* **Notificaciones Externas:** Extender el sistema actual de notificaciones in-app para incluir correos electrónicos (integración con SendGrid) o notificaciones Web Push, para que las notificaciones o resúmenes diarios lleguen incluso sin tener la web abierta.
* **Modo Oscuro (Dark Mode):** Permitir a los usuarios adaptar la interfaz gráfica de la plataforma a un modo oscuro nativo para reducir la fatiga visual en horarios nocturnos.

## 2. Experiencia Docente
* **Analíticas Avanzadas:** Integrar gráficos e indicadores de participación (ej: visualización de asistencia inferida, qué alumnos vieron los videos de clases grabadas, curva de progreso de calificaciones).
* **Editor de Texto Enriquecido (Rich Text):** Reemplazar los campos de texto plano en la creación de Avisos y Tareas por un editor visual (WYSIWYG), permitiendo negritas, colores e inserción directa de imágenes.
* **Corrección Automática de Código:** Aprovechar la vinculación existente con repositorios GitHub para integrar acciones automatizadas (GitHub Actions) que provean retroalimentación o tests automáticos y calculen notas parciales.
* **Gestión de Roles Avanzada:** Crear permisos granulares que permitan incorporar a "Ayudantes de Cátedra", donde tengan permisos para corregir entregas o contestar foros, pero no para alterar la planificación base del titular.
* **Módulo de Exámenes (Quizzes):** Añadir un sistema de creación de cuestionarios rápidos (Múltiple Choice, Verdadero/Falso) con calificación automatizada.

## 3. Infraestructura y Plataforma
* **Soporte Offline Completo (IndexedDB):** Ampliar el alcance actual del PWA y Service Worker para almacenar localmente el contenido de las clases y avisos en caché estructurada. De esta manera, el estudiante puede visualizar el material sin conexión a internet.
* **Autenticación Institucional (SSO):** Conectar el sistema de login de Firebase con proveedores OAuth institucionales (ej: correos universitarios, SAML) para omitir la creación de cuentas mediante usuario/contraseña.
* **Paginación en Firestore:** Implementar estrategias de caché y limitación/paginación (cursors) en las tablas de entregas si el proyecto escala a muchas cátedras, para optimizar costos de operaciones y lecturas.
