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
* **Marcadores Temporales en Grabaciones (Bookmarks)**: Permitir a los estudiantes guardar comentarios o notas privadas en marcas de tiempo específicas de los videos de YouTube enlazados, facilitando el repaso rápido de momentos clave de la clase.
* **Grupos de Cursada Auto-organizados**: Herramienta de emparejamiento inteligente que permita a los estudiantes formar grupos de estudio para tareas grupales o resolver dudas de forma autónoma con compañeros de horarios afines.
* **Módulo de Tutorías Académicas**: Espacio para conectar a alumnos avanzados (tutores) con estudiantes que requieren ayuda, facilitando la reserva de horarios de mentoría y videollamadas de consulta.
* **Visualizador de Avance y Correlatividades (Mapa Curricular)**: Gráfico interactivo que muestra las materias del plan de estudios, cuáles están aprobadas, cuáles están en curso, y qué materias futuras se habilitarán en función de los prerrequisitos.
* **Showcase de Proyectos de Cátedra**: Espacio público o semipúblico para exponer los mejores proyectos de los equipos estudiantiles, fomentando una comunidad de desarrollo activa e interactiva.
* **Portal de Bienestar y Salud Mental**: Acceso rápido a recursos estudiantiles, recordatorios automáticos de pausas activas durante largas sesiones de estudio y un botón de contacto con el área de orientación universitaria.
* **Portafolio Unificado de Fin de Carrera**: Permitir agrupar proyectos y entregas de diferentes materias para armar un proyecto integrador multidisciplinar que sirva como tesis o trabajo de graduación.
* **Conexión con Bolsas de Trabajo y Pasantías**: Vincular los perfiles estudiantiles y las materias aprobadas con las ofertas laborales activas y pasantías recomendadas por la universidad.

## 2. Experiencia Docente
* **Analíticas Avanzadas**: Integrar gráficos e indicadores de participación (ej: visualización de asistencia inferida, qué alumnos vieron los videos de clases grabadas, curva de progreso de calificaciones).
* **Editor de Texto Enriquecido (Rich Text)**: Reemplazar los campos de texto plano en la creación de Avisos y Tareas por un editor visual (WYSIWYG), permitiendo negritas, colores e inserción directa de imágenes.
* **Corrección Automática de Código**: Aprovechar la vinculación existente con repositorios GitHub para integrar acciones automatizadas (GitHub Actions) que provean retroalimentación o tests automáticos y calculen notas parciales.
* **Módulo de Exámenes (Quizzes)**: Añadir un sistema de creación de cuestionarios rápidos (Múltiple Choice, Verdadero/Falso) con calificación automatizada.
* **Registro de Asistencia mediante QR Dinámico**: Permitir al profesor proyectar en el aula física un código QR que cambia cada 10 segundos, de manera que los estudiantes puedan escanearlo con sus dispositivos para firmar su asistencia en la clase en tiempo real con geolocalización.
* **Integración Bidireccional con Hojas de Cálculo (Google Sheets)**: Crear una exportación de notas y listado de alumnos directa a hojas de Google Drive y permitir que el docente actualice notas en el Sheets y se sincronicen de regreso a la plataforma de forma automática.
* **Banco de Consignas Reutilizables**: Biblioteca compartida en la que los docentes puedan guardar descripciones de entregas de tareas comunes (con sus rúbricas de evaluación) para reusarlas o clonarlas rápidamente en nuevos cuatrimestres.
* **Asistente de IA Docente**: Integración de un modelo de lenguaje que proponga consignas alternativas de examen, redacte explicaciones teóricas complementarias para las clases o formule preguntas conceptuales adaptadas al temario actual.
* **Alertas Tempranas de Desempeño**: Sistema automático que notifique al docente sobre estudiantes que presenten inasistencias reiteradas o encadenen múltiples entregas de tareas ausentes, identificando casos de riesgo académico de manera proactiva.
* **Editor Visual de Rúbricas Ponderadas**: Herramienta interactiva para estructurar la calificación de tareas según múltiples criterios y ponderaciones (ej. "Código Limpio: 20%", "Pruebas Unitarias: 40%"), permitiendo calificar con clicks y calcular promedios de forma automática.
* **Espacio de Co-Docencia Coordinada**: Funcionalidades específicas para cursos compartidos con múltiples ayudantes de cátedra, permitiendo asignar entregas para corregir según comisiones o distribuir tareas de soporte en foros.
* **Grabación de Feedback en Audio**: Permitir a los docentes adjuntar una devolución de voz corta directamente en la corrección de tareas para agilizar el proceso y personalizar la retroalimentación.
* **Tablero Kanban para Planificación Curricular**: Vista ágil tipo Kanban para que el docente organice las clases del cronograma base arrastrando temas y recursos de manera interactiva.
* **Módulo de Encuestas Estudiantiles Anónimas**: Permitir a los docentes crear sondeos rápidos y anónimos sobre la marcha de las clases o la dificultad de los contenidos para ajustar la metodología pedagógica en tiempo real.
* **Analizador de Legibilidad de Enunciados**: Evaluador de textos asistido por IA para diagnosticar la claridad y dificultad de lectura de las consignas de tareas creadas antes de publicarlas.

## 3. Infraestructura y Plataforma
* **Soporte Offline Completo (IndexedDB)**: Ampliar el alcance actual del PWA y Service Worker para almacenar localmente el contenido de las clases y avisos en caché estructurada. De esta manera, el estudiante puede visualizar el material sin conexión a internet.
* **Paginación en Firestore**: Implementar estrategias de caché y limitación/paginación (cursors) en las tablas de entregas si el proyecto escala a muchas cátedras, para optimizar costos de operaciones y lecturas.
* **Detección de Plagio y Copias**: Analizador automático de código estático (usando similitud estructural de AST o APIs de comparación de código) que escanee los repositorios de GitHub entregados y alerte al docente de posibles plagios entre alumnos.
* **Autenticación Unificada (Single Sign-On / SSO)**: Soporte para login a través de servidores institucionales universitarios (OAuth2, SAML, Microsoft Azure AD o Google Workspace corporativo).
* **Modo Oscuro Integrado y Temas de Accesibilidad**: Alternador nativo de interfaz oscura y soporte para paletas de alto contraste o tipografías aptas para personas con dislexia.
* **Integración Nativa de Videollamadas (Zoom/Teams API)**: Generación automática de salas de reunión virtuales y recuperación automática de las grabaciones de video en la nube al finalizar la sesión, enlazándolas directamente a la clase correspondiente.
* **Bitácora de Auditoría de Notas (Audit Logs)**: Registro histórico inmutable de modificaciones sobre calificaciones y entregas, con detalle del usuario responsable y fecha, garantizando transparencia académica y control de cambios.
* **Exportador Estándar de Contenidos (SCORM / Common Cartridge)**: Permitir la exportación completa de cronogramas, materiales y tareas en formatos universales para facilitar la migración de datos hacia otros sistemas LMS (como Moodle o Canvas).
* **Monitoreo de Consumos de Base de Datos y APM**: Integración de tableros de traza del consumo de lectura/escritura en Firestore por endpoint de Cloud Function para auditar y controlar costos operativos de la plataforma de manera proactiva.
* **Control de Versiones y Comparación de Cronogramas**: Historial de versiones del cronograma de cada cátedra con herramientas visuales para restaurar cambios o comparar variaciones curriculares interanuales.
* **Backups Incrementales y Recuperación Granular**: Respaldos continuos en la nube para las colecciones críticas con posibilidad de restaurar documentos individuales de Firestore en caso de errores de usuario.
* **Restricción de Acceso por Rango de IPs (IP Whitelisting)**: Habilitar a los administradores para forzar que ciertas entregas de tareas o exámenes solo puedan completarse desde conexiones físicas dentro del campus o laboratorios de la universidad.
* **Compresión y Optimización Multimedia**: Compresor de archivos en background para optimizar automáticamente materiales didácticos, grabaciones y lecturas de cátedra, reduciendo ancho de banda en accesos de estudiantes con conexiones lentas.

## 4. Mejoras Enfocadas por Tipo de Cátedra
* **Cátedras de Programación e Ingeniería de Software**:
  - **Pruebas Automatizadas Integradas (Autograding)**: Vinculación directa con GitHub Actions para ejecutar tests unitarios automáticos (ej. JUnit, Jest, PyTest) en cada entrega y actualizar el estado en el panel docente con el porcentaje de cobertura.
  - **Playground de Código Interactivo (Web Sandbox)**: Un sandbox web incrustado en el cronograma de clases que permita a los estudiantes realizar pequeños experimentos de código HTML/JS/Python directamente en el navegador sin instalar herramientas locales.
  - **Inspección Automatizada de Calidad de Código (Linting)**: Analizador estático automático (ej. ESLint, Pylint) que evalúe y califique la legibilidad, formato y estándares de desarrollo del código entregado, reportando advertencias directo al alumno para corregir malas prácticas antes de la entrega definitiva.
  - **Entorno de Programación en la Nube de un Clic**: Integración con servicios de contenedores web (ej. GitHub Codespaces / Gitpod) mediante un botón que abra el repositorio de la entrega en un VS Code Cloud preconfigurado con las librerías, JDKs y dependencias requeridas por la cátedra.
  - **Visualizador del Flujo de Trabajo Git (Git Commits Visualizer)**: Gráfico de commits y ramas integrado en la interfaz de la entrega para que el docente evalúe el proceso incremental y la distribución del trabajo de los estudiantes en tareas grupales.
  - **Generador de Entornos de Desafíos Algorítmicos (Test Runner)**: Herramienta que permite a los docentes definir casos de prueba (inputs/outputs estándar) para que los estudiantes validen sus algoritmos y estructuras de datos básicas de forma guiada en la plataforma.
  - **Revisión de Código en Línea e Inline (Inline Code Review)**: Permitir a los docentes agregar comentarios y notas directamente sobre líneas de código del archivo fuente del alumno en la interfaz web de entregas (similar a los reviews en Pull Requests de GitHub), evitando la descarga del código localmente.
  - **Control de Cobertura y Escaneo de Seguridad de Dependencias (SAST)**: Análisis automáticos para evaluar el porcentaje de líneas de código cubiertas por pruebas unitarias del estudiante e identificar vulnerabilidades críticas en dependencias declaradas (estilo `npm audit` o `Dependabot`).
  - **Simulador de Gestión de Proyectos Ágiles (Scrum Board)**: Un tablero Kanban de equipo integrado, backlog de sprints y gráfico de burndown para cátedras avanzadas de Ingeniería de Software donde se evalúan metodologías ágiles de trabajo en equipo.
  - **Entorno de Despliegue Aislado (Docker Sandbox)**: Integrador que permita a los estudiantes desplegar y probar arquitecturas complejas (ej. Servidor + Base de Datos) en entornos de contenedores Docker autogestionados y preconfigurados por la cátedra.
  - **Programación Colaborativa en Parejas (Live Pair Programming)**: Espacio virtual donde dos estudiantes puedan editar simultáneamente un mismo archivo de código en tiempo real dentro del sandbox de la plataforma, registrando la participación individual.
  - **Explicador de Errores de Consola asistido por IA**: Asistente virtual de depuración que interprete la traza de errores del compilador o la consola de testeo en entregas fallidas, guiando pedagógicamente al estudiante para resolver el bug.
  - **Perfilador de Rendimiento y Análisis de Complejidad**: Módulo de análisis del uso de memoria y CPU de los scripts de los alumnos, permitiendo evaluar la eficiencia algorítmica e introducir conceptos avanzados de optimización de manera práctica.
* **Cátedras de Diseño Gráfico, Multimedial y UX/UI**:
  - **Muro de Trabajo Visual (Pinboard)**: Panel estilo tablón donde los alumnos puedan subir capturas, mockups de Figma o esquemas, facilitando la crítica constructiva visual con comentarios marcados sobre zonas de la imagen.
* **Cátedras de Matemáticas, Física y Ciencias Exactas**:
  - **Soporte LaTeX y Modelos Geométricos Interactivos**: Integración de KaTeX para redactar fórmulas y Geogebra en las clases para permitir visualizaciones tridimensionales y de fórmulas físicas interactivas en tiempo real.
* **Cátedras de Idiomas o Expresión Oral**:
  - **Grabador y Visor de Ondas de Audio**: Soporte nativo para grabaciones directas desde el micrófono del navegador para entregas de pronunciación o exposiciones, con soporte de reproducción y marcado de feedback de audio en puntos concretos de la onda de sonido.
