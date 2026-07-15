# Roadmap y Estado de Funcionalidades - Jutsu Classroom

Este documento detalla el estado actual de las funcionalidades de la plataforma, marcando aquellas implementadas y listando las ideas a futuro para mejorar la experiencia de estudiantes y docentes.

---

## 📊 Estado del Sistema (roadmap de mejoras completado)

### 1. Experiencia del Estudiante
*   [x] **Gamificación (Rango Ninja)**: Cálculo dinámico de XP (asistencia, tareas entregadas, promedio de calificaciones, participación en foros y mejores respuestas), niveles y medallas de honor de cursada (Maestro de Chakra, Asistencia Perfecta, Ninja Activo, Solucionador).
*   [x] **Foros y Preguntas y Respuestas por Clase (Q&A)**: Hilos de consulta en tiempo real por clase, reacciones emoji (👍, 🎉, ❤️) y Modo "Stack Overflow" (solución/respuesta correcta destacada por el docente).
*   [x] **Grupos de Cursada Auto-organizados**: Subpestaña "Grupos de Estudio" para la creación de grupos y emparejamiento inteligente de compañeros afines según su turno/disponibilidad horaria.
*   [x] **Módulo de Tutorías Académicas (Mentoría entre Pares)**: Subpestaña "Tutorías" para postularse como tutor, listar tutores de la cursada, reservar mentorías con sala de videoconferencia generada automáticamente en Google Meet.
*   [ ] **Sincronización de Calendario (Exportación iCal/ICS)**: Permitir a los estudiantes exportar el cronograma dinámico de clases y fechas límite de entregas de tareas a Google Calendar, Apple Calendar o Microsoft Outlook.
*   [ ] **Buscador Rápido Inteligente (Command + K)**: Implementar una barra de búsqueda omni-buscadora (Spotlight Search) accesible en cualquier parte del sitio para buscar temas de clases, avisos, entregas o nombres de profesores de forma instantánea.
*   [ ] **Portafolio de Proyectos Públicos**: Dar la opción a los estudiantes de configurar ciertas entregas de GitHub como "públicas" en su perfil de la plataforma, creando un portafolio de proyectos académicos visible para reclutadores.
*   [ ] **Marcadores Temporales en Grabaciones (Bookmarks)**: Permitir a los estudiantes guardar comentarios o notas privadas en marcas de tiempo específicas de los videos de YouTube enlazados, facilitando el repaso rápido de momentos clave de la clase.

### 2. Experiencia Docente
*   [x] **Registro de Asistencia mediante QR Dinámico**: Generación de token alfanumérico temporal (expiración de 5 minutos) con geolocalización de docente y validación de proximidad GPS (< 150m) en el backend (Cloud Function).
*   [x] **Integración Bidireccional con Hojas de Cálculo (Sheets/Excel)**: Exportación en 1 clic de la matriz completa de notas, asistencia, alertas y regularidad académica a CSV nativo compatible con Google Sheets o Excel.
*   [x] **Alertas Tempranas de Desempeño**: Panel "Alumnos y Alertas" con cálculo en tiempo real de regularidad y estado de riesgo académico.
*   [x] **Espacio de Co-Docencia Coordinada**: Gestión de comisiones de estudiantes y vinculación de docentes responsables por comisión con filtros multi-vista.
*   [x] **Tablero Kanban para Planificación Curricular**: Vista interactiva drag & drop para reorganizar cronogramas y clases entre Teóricas, Prácticas, Feriados y Exámenes.
*   [x] **Módulo de Encuestas Estudiantiles Anónimas (Class Feedback)**: Valoración anónima (1-5 estrellas), nivel de comprensión y comentarios para estudiantes con panel estadístico agregado para docentes.
*   [x] **Dashboard Docente Centralizado (Panel Resumen)**: Cola de corrección de tareas con enlaces directos, últimas consultas de foros y lista de alumnos en riesgo académico.
*   [ ] **Editor de Texto Enriquecido (Rich Text)**: Reemplazar los campos de texto plano en la creación de Avisos y Tareas por un editor visual (WYSIWYG), permitiendo negritas, colores e inserción directa de imágenes.
*   [ ] **Corrección Automática de Código**: Aprovechar la vinculación existente con repositorios GitHub para integrar acciones automatizadas (GitHub Actions) que proveen retroalimentación o tests automáticos y calculen notas parciales.
*   [ ] **Módulo de Exámenes (Quizzes)**: Añadir un sistema de creación de cuestionarios rápidos (Múltiple Choice, Verdadero/Falso) con calificación automatizada.
*   [ ] **Banco de Consignas Reutilizables**: Biblioteca compartida en la que los docentes puedan guardar descripciones de entregas de tareas comunes para reusarlas o clonarlas rápidamente en nuevos cuatrimestres.

### 3. Infraestructura y Plataforma
*   [x] **Soporte Offline Completo (PWA / IndexedDB)**: Habilitación de caché local persistente con IndexedDB en el SDK de Firebase para consultas sin conexión.
*   [x] **Paginación y Optimización en Firestore**: Paginación offline estructurada y consultas optimizadas para lecturas reducidas.
*   [x] **Modo Oscuro Integrado**: Temas dinámicos (Claro/Oscuro) controlados por localStorage y variables semánticas en CSS.
*   [x] **Bitácora de Auditoría de Notas (Audit Logs)**: Registro histórico inmutable de modificaciones sobre calificaciones con diferencia (diff) de datos legible en una línea de tiempo para profesores.
*   [x] **Control de Versiones de Cronograma (VCS)**: Panel e historial visual de versiones, guardado manual y autoguardado de versiones, visor interactivo de diff de clases y restauración en caliente.
*   [x] **Alertas Automatizadas a Alumnos**: Módulo que analiza de forma autónoma el riesgo del roster y envía notificaciones de alerta semanales a los alumnos con asistencia crítica o tareas ausentes.
*   [x] **Backups Incrementales y Recuperación Granular**: Panel de administración para respaldar el estado del sistema y restaurar elementos individuales (cátedras, tareas, perfiles) en 1 clic.
*   [x] **Compresión y Optimización Multimedia**: Optimizador de links en background que analiza y comprime lecturas, material didáctico y grabaciones para minimizar el consumo de datos móviles (hasta 45%).
*   [x] **Reportes PDF Automatizados**: Botón de exportación dinámico que genera un reporte resumido de la cursada optimizado para guardarse como PDF o imprimirse.
*   [ ] **Detección de Plagio y Copias**: Analizador automático de código estático (usando similitud estructural de AST o APIs de comparación de código) que escanee los repositorios de GitHub entregados y alerte al docente de posibles plagios entre alumnos.
*   [ ] **Autenticación Unificada (Single Sign-On / SSO)**: Soporte para login a través de servidores institucionales universitarios (OAuth2, SAML, Microsoft Azure AD o Google Workspace corporativo).

---

## 🚀 Mejoras Futuras y Específicas por Cátedra (Programación / DevOps)
*   **Pruebas Automatizadas Integradas (Autograding)**: Vinculación directa con GitHub Actions para ejecutar tests unitarios automáticos (ej. JUnit, Jest, PyTest) en cada entrega y actualizar el estado en el panel docente con el porcentaje de cobertura.
*   **Playground de Código Interactivo (Web Sandbox)**: Un sandbox web incrustado en el cronograma de clases que permita a los estudiantes realizar pequeños experimentos de código HTML/JS/Python directamente en el navegador sin instalar herramientas locales.
*   **Inspección Automatizada de Calidad de Código (Linting)**: Analizador estático automático (ej. ESLint, Pylint) que evalúe y califique la legibilidad, formato y estándares de desarrollo del código entregado, reportando advertencias directo al alumno para corregir malas prácticas antes de la entrega definitiva.
*   **Entorno de Programación en la Nube de un Clic**: Integración con servicios de contenedores web (ej. GitHub Codespaces / Gitpod) mediante un botón que abra el repositorio de la entrega en un VS Code Cloud preconfigurado con las librerías, JDKs y dependencias requeridas por la cátedra.
*   **Visualizador del Flujo de Trabajo Git (Git Commits Visualizer)**: Gráfico de commits y ramas integrado en la interfaz de la entrega para que el docente evalúe el proceso incremental y la distribución del trabajo de los estudiantes en tareas grupales.
*   **Generador de Entornos de Desafíos Algorítmicos (Test Runner)**: Herramienta que permite a los docentes definir casos de prueba (inputs/outputs estándar) para que los estudiantes validen sus algoritmos y estructuras de datos básicas de forma guiada en la plataforma.
*   **Revisión de Código en Línea e Inline (Inline Code Review)**: Permitir a los docentes agregar comentarios y notas directamente sobre líneas de código del archivo fuente del alumno en la interfaz web de entregas (similar a los reviews en Pull Requests de GitHub), evitando la descarga del código localmente.
*   **Control de Cobertura y Escaneo de Seguridad de Dependencias (SAST)**: Análisis automáticos para evaluar el porcentaje de líneas de código cubiertas por pruebas unitarias del estudiante e identificar vulnerabilidades críticas en dependencias declaradas (estilo `npm audit` o `Dependabot`).
*   **Simulador de Gestión de Proyectos Ágiles (Scrum Board)**: Un tablero Kanban de equipo integrado, backlog de sprints y gráfico de burndown para cátedras avanzadas de Ingeniería de Software donde se evalúan metodologías ágiles de trabajo en equipo.
*   **Programación Colaborativa en Parejas (Live Pair Programming)**: Espacio virtual donde dos estudiantes puedan editar simultáneamente un mismo archivo de código en tiempo real dentro del sandbox de la plataforma, registrando la participación individual.
*   **Explicador de Errores de Consola asistido por IA**: Asistente virtual de depuración que interprete la traza de errores del compilador o la consola de testeo en entregas fallidas, guiando pedagógicamente al estudiante para resolver el bug.
