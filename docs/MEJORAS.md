# Plan y Estado de Mejoras Integradas - Jutsu Classroom

Este documento integra y consolida los listados de [MEJORAS.md](file:///home/mrtin/dev/gaula/MEJORAS.md) y [POTENCIALES_MEJORAS.md](file:///home/mrtin/dev/gaula/POTENCIALES_MEJORAS.md), clasificando cada funcionalidad por área de experiencia e indicando claramente cuáles han sido implementadas exitosamente.

---

## 📊 Estado de Funcionalidades e Ideas de Mejora

### 1. Experiencia del Estudiante

*   [x] **Gamificación (Rango Ninja)**:
    *   *Detalle de implementación*: Incorpora un cálculo dinámico de XP (basado en asistencia, entregas, promedio y foros) con niveles y medallas de honor de cursada (Maestro de Chakra, Asistencia Perfecta, Ninja Activo, Solucionador).
*   [x] **Foros y Preguntas y Respuestas (Q&A)**:
    *   *Detalle de implementación*: Comentarios en cada clase/tarea con reacciones emoji, respuestas correctas destacadas por el docente (Modo Stack Overflow).
*   [x] **Módulo de Tutorías Académicas (Mentoría entre Pares)**:
    *   *Detalle de implementación*: Subpestaña "Tutorías" para postularse como tutor, listar tutores de la cursada, reservar mentorías con sala de videoconferencia generada automáticamente en Google Meet.
*   [x] **Grupos de Cursada Auto-organizados (Buddy Matcher)**:
    *   *Detalle de implementación*: Subpestaña "Grupos de Estudio" para la creación de grupos y emparejamiento inteligente de compañeros afines según su turno/disponibilidad horaria.
*   [x] **Sincronización de Calendario**:
    *   *Detalle de implementación*: Configuración en los ajustes de la cátedra para registrar e importar URLs de calendarios externos y sincronizar cronogramas.
*   [x] **Escáner de Asistencia QR Integrado**:
    *   *Detalle de implementación*: Acceso directo y cámara web integrados en la interfaz del alumno para escanear y validar presentismo en 1 segundo con geolocalización.
*   [ ] **Integración de Evaluaciones por Pares (Peer Review)**:
    *   *Propuesta*: Permitir a los estudiantes evaluar de forma anónima los trabajos de sus compañeros mediante rúbricas predefinidas, promoviendo el pensamiento crítico.
*   [ ] **Notificaciones Externas**:
    *   *Propuesta*: Extender el sistema actual de notificaciones in-app para incluir correos electrónicos (SendGrid) o notificaciones Web Push.
*   [ ] **Buscador Rápido Inteligente (Command + K)**:
    *   *Propuesta*: Implementar una barra de búsqueda omni-buscadora (Spotlight Search) accesible en cualquier parte del sitio para buscar temas de clases, avisos, entregas o nombres de profesores de forma instantánea.
*   [ ] **Portafolio de Proyectos Públicos**:
    *   *Propuesta*: Dar la opción a los estudiantes de configurar ciertas entregas de GitHub como "públicas" en su perfil de la plataforma, creando un portafolio de proyectos académicos visible para reclutadores.
*   [ ] **Marcadores Temporales en Grabaciones (Bookmarks)**:
    *   *Propuesta*: Permitir a los estudiantes guardar comentarios o notas privadas en marcas de tiempo específicas de los videos de YouTube enlazados, facilitando el repaso rápido de momentos clave de la clase.
*   [ ] **Visualizador de Avance y Correlatividades (Mapa Curricular)**:
    *   *Propuesta*: Gráfico interactivo que muestra las materias del plan de estudios, cuáles están aprobadas, cuáles están en curso, y qué materias futuras se habilitarán en función de los prerrequisitos.
*   [ ] **Showcase de Proyectos de Cátedra**:
    *   *Propuesta*: Espacio público o semipúblico para exponer los mejores proyectos de los equipos estudiantiles, fomentando una comunidad de desarrollo activa e interactiva.
*   [ ] **Portal de Bienestar y Salud Mental**:
    *   *Propuesta*: Acceso rápido a recursos estudiantiles, recordatorios automáticos de pausas activas durante largas sesiones de estudio y un botón de contacto con el área de orientación universitaria.
*   [ ] **Portafolio Unificado de Fin de Carrera**:
    *   *Propuesta*: Permitir agrupar proyectos y entregas de diferentes materias para armar un proyecto integrador multidisciplinar que sirva como tesis o trabajo de graduación.
*   [ ] **Conexión con Bolsas de Trabajo y Pasantías**:
    *   *Propuesta*: Vincular los perfiles estudiantiles y las materias aprobadas con las ofertas laborales activas y pasantías recomendadas por la universidad.

---

### 2. Experiencia Docente

*   [x] **Registro de Asistencia mediante QR Dinámico**:
    *   *Detalle de implementación*: Generación de token alfanumérico temporal (expiración de 5 minutos) con geolocalización de docente y validación de proximidad GPS (< 150m) en el backend (Cloud Function).
*   [x] **Integración Bidireccional con Hojas de Cálculo (Sheets/Excel)**:
    *   *Detalle de implementación*: Exportación en 1 clic de la matriz completa de notas, asistencia, alertas y regularidad académica a CSV nativo compatible con Google Sheets o Excel, además de importación directa vía CSV de calificaciones.
*   [x] **Alertas Tempranas de Desempeño**:
    *   *Detalle de implementación*: Panel "Alumnos y Alertas" con cálculo en tiempo real de regularidad y estado de riesgo académico.
*   [x] **Espacio de Co-Docencia Coordinada**:
    *   *Detalle de implementación*: Gestión de comisiones de estudiantes y vinculación de docentes responsables por comisión con filtros multi-vista. La cantidad de comisiones y docentes responsables es completamente ajustable/configurable en caliente.
*   [x] **Tablero Kanban para Planificación Curricular**:
    *   *Detalle de implementación*: Vista interactiva drag & drop para reorganizar cronogramas y clases entre Teóricas, Prácticas, Feriados y Exámenes.
*   [x] **Módulo de Encuestas Estudiantiles Anónimas (Class Feedback)**:
    *   *Detalle de implementación*: Valoración anónima (1-5 estrellas), nivel de comprensión y comentarios para estudiantes con panel estadístico agregado para docentes.
*   [x] **Dashboard Docente Centralizado (Panel Resumen)**:
    *   *Detalle de implementación*: Cola de corrección de tareas con enlaces directos, últimas consultas de foros y lista de alumnos en riesgo académico.
*   [ ] **Analíticas Avanzadas**:
    *   *Propuesta*: Integrar gráficos e indicadores de participación (ej: visualización de asistencia inferida, qué alumnos vieron los videos de clases grabadas, curva de progreso de calificaciones).
*   [ ] **Editor de Texto Enriquecido (Rich Text)**:
    *   *Propuesta*: Reemplazar los campos de texto plano en la creación de Avisos y Tareas por un editor visual (WYSIWYG), permitiendo negritas, colores e inserción directa de imágenes.
*   [ ] **Corrección Automática de Código**:
    *   *Propuesta*: Aprovechar la vinculación existente con repositorios GitHub para integrar acciones automatizadas (GitHub Actions) que proveen retroalimentación o tests automáticos y calculen notas parciales.
*   [ ] **Módulo de Exámenes (Quizzes)**:
    *   *Propuesta*: Añadir un sistema de creación de cuestionarios rápidos (Múltiple Choice, Verdadero/Falso) con calificación automatizada.
*   [ ] **Banco de Consignas Reutilizables**:
    *   *Propuesta*: Biblioteca compartida en la que los docentes puedan guardar descripciones de entregas de tareas comunes (con sus rúbricas de evaluación) para reusarlas o clonarlas rápidamente en nuevos cuatrimestres.
*   [ ] **Asistente de IA Docente**:
    *   *Propuesta*: Integración de un modelo de lenguaje que proponga consignas alternativas de examen, redacte explicaciones teóricas complementarias para las clases o formule preguntas conceptuales adaptadas al temario actual.
*   [ ] **Editor Visual de Rúbricas Ponderadas**:
    *   *Propuesta*: Herramienta interactiva para estructurar la calificación de tareas según múltiples criterios y ponderaciones, permitiendo calificar con clicks y calcular promedios de forma automática.
*   [ ] **Grabación de Feedback en Audio**:
    *   *Propuesta*: Permitir a los docentes adjuntar una devolución de voz corta directamente en la corrección de tareas para agilizar el proceso y personalizar la retroalimentación.
*   [ ] **Analizador de Legibilidad de Enunciados**:
    *   *Propuesta*: Evaluador de textos asistido por IA para diagnosticar la claridad y dificultad de lectura de las consignas de tareas creadas antes de publicarlas.

---

### 3. Infraestructura y Plataforma

*   [x] **Soporte Offline Completo (PWA / IndexedDB)**:
    *   *Detalle de implementación*: Habilitación de caché local persistente con IndexedDB en el SDK de Firebase para consultas sin conexión.
*   [x] **Paginación y Optimización en Firestore**:
    *   *Detalle de implementación*: Paginación offline estructurada y consultas optimizadas para lecturas reducidas.
*   [x] **Modo Oscuro Integrado**:
    *   *Detalle de implementación*: Temas dinámicos (Claro/Oscuro) controlados por localStorage y variables semánticas en CSS.
*   [x] **Bitácora de Auditoría de Notas (Audit Logs)**:
    *   *Detalle de implementación*: Registro histórico inmutable de modificaciones sobre calificaciones con diferencia (diff) de datos legible en una línea de tiempo para profesores.
*   [x] **Control de Versiones de Cronograma (VCS)**:
    *   *Detalle de implementación*: Panel e historial visual de versiones, visor interactivo de diff de clases y restauración en caliente.
*   [x] **Alertas Automatizadas a Alumnos**:
    *   *Detalle de implementación*: Módulo que analiza de forma autónoma el riesgo del roster y envía notificaciones de alerta semanales a los alumnos con asistencia crítica o tareas ausentes.
*   [x] **Backups Incrementales y Recuperación Granular**:
    *   *Detalle de implementación*: Panel de administración para respaldar el estado del sistema y restaurar elementos individuales (cátedras, tareas, perfiles) en 1 clic.
*   [x] **Compresión y Optimización Multimedia**:
    *   *Detalle de implementación*: Optimizador de links en background que analiza y comprime lecturas, material didáctico y grabaciones para minimizar el consumo de datos móviles (hasta 45%).
*   [x] **Reportes PDF Automatizados**:
    *   *Detalle de implementación*: Botón de exportación dinámico que genera un reporte resumido de la cursada optimizado para guardarse como PDF o imprimirse.
*   [x] **Integración LTI con Moodle (4.2+)**:
    *   *Detalle de implementación*: Soporte para enlaces directos LTI 1.3, redireccionamiento dinámico de URIs REST y hoja de ruta para la sincronización automática de notas e inscripciones ([MOODLE_INTEGRATION.md](file:///home/mrtin/dev/gaula/docs/MOODLE_INTEGRATION.md)).
*   [ ] **Detección de Plagio y Copias**:
    *   *Propuesta*: Analizador automático de código estático (usando similitud estructural de AST o APIs de comparación de código) que escanee los repositorios de GitHub entregados y alerte al docente de posibles plagios entre alumnos.
*   [ ] **Autenticación Unificada (Single Sign-On / SSO)**:
    *   *Propuesta*: Soporte para login a través de servidores institucionales universitarios (OAuth2, SAML, Microsoft Azure AD o Google Workspace corporativo).
*   [ ] **Integración Nativa de Videollamadas (Zoom/Teams API)**:
    *   *Propuesta*: Generación automática de salas de reunión virtuales y recuperación automática de las grabaciones de video en la nube al finalizar la sesión, enlazándolas directamente a la clase correspondiente.
*   [ ] **Exportador Estándar de Contenidos (SCORM / Common Cartridge)**:
    *   *Propuesta*: Permitir la exportación completa de cronogramas, materiales y tareas en formatos universales para facilitar la migración de datos hacia otros sistemas LMS (como Moodle o Canvas).
*   [ ] **Monitoreo de Consumos de Base de Datos y APM**:
    *   *Propuesta*: Integración de tableros de traza del consumo de lectura/escritura en Firestore por endpoint de Cloud Function para auditar y controlar costos operativos de la plataforma de manera proactiva.
*   [ ] **Restricción de Acceso por Rango de IPs (IP Whitelisting)**:
    *   *Propuesta*: Habilitar a los administradores para forzar que ciertas entregas de tareas o exámenes solo puedan completarse desde conexiones físicas dentro del campus o laboratorios de la universidad.

---

### 4. Mejoras Enfocadas por Tipo de Cátedra

#### Cátedras de Programación e Ingeniería de Software

*   [x] **Visualizador del Flujo de Trabajo Git (Git Commits Visualizer)**:
    *   *Detalle de implementación*: Gráfico de commits y ramas integrado en la interfaz de la entrega para que el docente evalúe el proceso incremental y la distribución del trabajo de los estudiantes en tareas grupales.
*   [ ] **Pruebas Automatizadas Integradas (Autograding)**:
    *   *Propuesta*: Vinculación directa con GitHub Actions para ejecutar tests unitarios automáticos (ej. JUnit, Jest, PyTest) en cada entrega y actualizar el estado en el panel docente con el porcentaje de cobertura.
*   [ ] **Playground de Código Interactivo (Web Sandbox)**:
    *   *Propuesta*: Un sandbox web incrustado en el cronograma de clases que permita a los estudiantes realizar pequeños experimentos de código HTML/JS/Python directamente en el navegador sin instalar herramientas locales.
*   [ ] **Inspección Automatizada de Calidad de Código (Linting)**:
    *   *Propuesta*: Analizador estático automático (ej. ESLint, Pylint) que evalúe y califique la legibilidad, formato y estándares de desarrollo del código entregado, reportando advertencias directo al alumno para corregir malas prácticas antes de la entrega definitiva.
*   [ ] **Entorno de Programación en la Nube de un Clic**:
    *   *Propuesta*: Integración con servicios de contenedores web (ej. GitHub Codespaces / Gitpod) mediante un botón que abra el repositorio de la entrega en un VS Code Cloud preconfigurado con las librerías, JDKs y dependencias requeridas por la cátedra.
*   [ ] **Generador de Entornos de Desafíos Algorítmicos (Test Runner)**:
    *   *Propuesta*: Herramienta que permite a los docentes definir casos de prueba (inputs/outputs estándar) para que los estudiantes validen sus algoritmos y estructuras de datos básicas de forma guiada en la plataforma.
*   [ ] **Revisión de Código en Línea e Inline (Inline Code Review)**:
    *   *Propuesta*: Permitir a los docentes agregar comentarios y notas directamente sobre líneas de código del archivo fuente del alumno en la interfaz web de entregas (similar a los reviews en Pull Requests de GitHub), evitando la descarga del código localmente.
*   [ ] **Control de Cobertura y Escaneo de Seguridad de Dependencias (SAST)**:
    *   *Propuesta*: Análisis automáticos para evaluar el porcentaje de líneas de código cubiertas por pruebas unitarias del estudiante e identificar vulnerabilidades críticas en dependencias declaradas.
*   [ ] **Simulador de Gestión de Proyectos Ágiles (Scrum Board)**:
    *   *Propuesta*: Un tablero Kanban de equipo integrado, backlog de sprints y de sprints para cátedras avanzadas de Ingeniería de Software donde se evalúan metodologías ágiles de trabajo en equipo.
*   [ ] **Entorno de Despliegue Aislado (Docker Sandbox)**:
    *   *Propuesta*: Integrador que permita a los estudiantes desplegar y probar arquitecturas complejas (ej. Servidor + Base de Datos) en entornos de contenedores Docker autogestionados y preconfigurados por la cátedra.
*   [ ] **Programación Colaborativa en Parejas (Live Pair Programming)**:
    *   *Propuesta*: Espacio virtual donde dos estudiantes puedan editar simultáneamente un mismo archivo de código en tiempo real dentro del sandbox de la plataforma, registrando la participación individual.
*   [ ] **Explicador de Errores de Consola asistido por IA**:
    *   *Propuesta*: Asistente virtual de depuración que interprete la traza de errores del compilador o la consola de testeo en entregas fallidas, guiando pedagógicamente al estudiante para resolver el bug.
*   [ ] **Perfilador de Rendimiento y Análisis de Complejidad**:
    *   *Propuesta*: Módulo de análisis del uso de memoria y CPU de los scripts de los alumnos, permitiendo evaluar la eficiencia algorítmica e introducir conceptos avanzados de optimización de manera práctica.
*   [ ] **Visualizador Gráfico de Memoria y Estructuras de Datos**:
    *   *Propuesta*: Visor que represente visualmente la pila (stack) y el montón (heap) de la memoria del código del alumno en ejecución paso a paso, ilustrando la creación de punteros, listas enlazadas, árboles y grafos de manera intuitiva.
*   [ ] **Servicio de Generación Automatizada de APIs Mock**:
    *   *Propuesta*: Permite a los docentes publicar esquemas OpenAPI (Swagger) y configurar la plataforma para responder automáticamente con datos mock simulados, facilitando el desarrollo frontend interactivo de los estudiantes antes de crear un backend.
*   [ ] **Mapeo de Deuda Técnica y Sugerencias de Refactorización**:
    *   *Propuesta*: Analizador que estime la deuda técnica (en minutos) y la complejidad cognitiva del código de los alumnos, recomendando patrones de refactorización.
*   [ ] **Constructor Visual de Pipelines de CI/CD**:
    *   *Propuesta*: Un editor interactivo para diseñar flujos de integración y entrega continuas dentro de la cátedra, introduciendo conceptos DevOps mediante la configuración visual de tareas de compilación, empaquetado y testeo.
*   [ ] **Detector de Patrones de Diseño (Design Patterns Scanner)**:
    *   *Propuesta*: Herramienta basada en análisis estático que intente verificar e informar si la solución del estudiante hace uso correcto de patrones arquitectónicos clave (ej: Model-View-Controller, Singleton, Factory o Strategy).
*   [ ] **Entorno de Desafíos de Seguridad (CTF Sandbox)**:
    *   *Propuesta*: Consola de juegos de hacking ético donde los alumnos deban encontrar y solucionar brechas de seguridad (como inyección SQL o cross-site scripting) en pequeños códigos aislados de la cátedra.
*   [ ] **Terminal SQL Interactiva y Visor de Planes de Ejecución**:
    *   *Propuesta*: Un playground para asignaturas de Bases de Datos donde los estudiantes escriben consultas en una consola web interactiva y visualizan el plan de ejecución y el diagrama de tablas.

#### Cátedras de Diseño Gráfico, Multimedial y UX/UI

*   [ ] **Muro de Trabajo Visual (Pinboard)**:
    *   *Propuesta*: Panel estilo tablón donde los alumnos puedan subir capturas, mockups de Figma o esquemas, facilitando la crítica constructiva visual con comentarios marcados sobre zonas de la imagen.

#### Cátedras de Matemáticas, Física y Ciencias Exactas

*   [ ] **Soporte LaTeX y Modelos Geométricos Interactivos**:
    *   *Propuesta*: Integración de KaTeX para redactar fórmulas y Geogebra en las clases para permitir visualizaciones tridimensionales y de fórmulas físicas interactivas en tiempo real.

#### Cátedras de Idiomas o Expresión Oral

*   [ ] **Grabador y Visor de Ondas de Audio**:
    *   *Propuesta*: Soporte nativo para grabaciones directas desde el micrófono del navegador para entregas de pronunciación o exposiciones, con soporte de reproducción y marcado de feedback de audio en puntos concretos de la onda de sonido.
