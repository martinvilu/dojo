# Potenciales Mejoras para Jutsu Classroom

Este documento detalla una lista de ideas y posibles funcionalidades a incorporar en la plataforma a futuro para mejorar la experiencia tanto de estudiantes como de docentes.

## 1. Experiencia del Estudiante
* **Gamificación**: Incorporar un sistema de puntos, niveles o medallas (badges) al completar tareas, entregar a tiempo o asistir a clases. Esto aumentaría la motivación y participación.
* **Foros y Preguntas y Respuestas**: Implementar un sistema de comentarios o hilos de discusión dentro de cada clase y tarea, permitiendo a los estudiantes interactuar entre sí y consultar dudas directamente asociadas al contenido.
* **Integración de Evaluaciones por Pares (Peer Review)**: Permitir que los estudiantes puedan evaluar de forma anónima los trabajos de sus compañeros mediante rúbricas predefinidas, promoviendo el pensamiento crítico.
* **Notificaciones Externas**: Extender el sistema actual de notificaciones in-app para incluir correos electrónicos (integración con SendGrid) o notificaciones Web Push, para que las notificaciones o resúmenes diarios lleguen incluso sin tener la web abierta.
* **Sincronización de Calendario (Exportación iCal/ICS)**: Permitir a los estudiantes exportar el cronograma dinámico de clases y fechas límite de entregas de tareas a Google Calendar, Apple Calendar o Microsoft Outlook.
* **Buscador Rápido Inteligente (Command + K)**: Implementar una barra de búsqueda omni-buscadora (Spotlight Search) accesible en cualquier parte del sitio para buscar temas de clases, avisos, entregas o nombres de profesores de forma instantánea.
* **Portafolio de Proyectos Públicos**: Dar la opción a los estudiantes de configurar ciertas entregas de GitHub como "públicas" en su perfil de la plataforma, creando un portafolio de proyectos académicos visible para reclutadores.

## 2. Experiencia Docente
* **Analíticas Avanzadas**: Integrar gráficos e indicadores de participación (ej: visualización de asistencia inferida, qué alumnos vieron los videos de clases grabadas, curva de progreso de calificaciones).
* **Editor de Texto Enriquecido (Rich Text)**: Reemplazar los campos de texto plano en la creación de Avisos y Tareas por un editor visual (WYSIWYG), permitiendo negritas, colores e inserción directa de imágenes.
* **Corrección Automática de Código**: Aprovechar la vinculación existente con repositorios GitHub para integrar acciones automatizadas (GitHub Actions) que provean retroalimentación o tests automáticos y calculen notas parciales.
* **Módulo de Exámenes (Quizzes)**: Añadir un sistema de creación de cuestionarios rápidos (Múltiple Choice, Verdadero/Falso) con calificación automatizada.
* **Registro de Asistencia mediante QR Dinámico**: Permitir al profesor proyectar en el aula física un código QR que cambia cada 10 segundos, de manera que los estudiantes puedan escanearlo con sus dispositivos para firmar su asistencia en la clase en tiempo real con geolocalización.
* **Integración Bidireccional con Hojas de Cálculo (Google Sheets)**: Crear una exportación de notas y listado de alumnos directa a hojas de Google Drive y permitir que el docente actualice notas en el Sheets y se sincronicen de regreso a la plataforma de forma automática.
* **Banco de Consignas Reutilizables**: Biblioteca compartida en la que los docentes puedan guardar descripciones de entregas de tareas comunes (con sus rúbricas de evaluación) para reusarlas o clonarlas rápidamente en nuevos cuatrimestres.

## 3. Infraestructura y Plataforma
* **Soporte Offline Completo (IndexedDB)**: Ampliar el alcance actual del PWA y Service Worker para almacenar localmente el contenido de las clases y avisos en caché estructurada. De esta manera, el estudiante puede visualizar el material sin conexión a internet.
* **Paginación en Firestore**: Implementar estrategias de caché y limitación/paginación (cursors) en las tablas de entregas si el proyecto escala a muchas cátedras, para optimizar costos de operaciones y lecturas.
* **Detección de Plagio y Copias**: Analizador automático de código estático (usando similitud estructural de AST o APIs de comparación de código) que escanee los repositorios de GitHub entregados y alerte al docente de posibles plagios entre alumnos.
* **Autenticación Unificada (Single Sign-On / SSO)**: Soporte para login a través de servidores institucionales universitarios (OAuth2, SAML, Microsoft Azure AD o Google Workspace corporativo).
* **Modo Oscuro Integrado y Temas de Accesibilidad**: Alternador nativo de interfaz oscura y soporte para paletas de alto contraste o tipografías aptas para personas con dislexia.

