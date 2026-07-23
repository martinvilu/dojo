# Roadmap y Estado de Funcionalidades - Ninja Dojo

Este documento detalla el estado actual de las funcionalidades de la plataforma, marcando aquellas implementadas y listando las ideas a futuro para mejorar la experiencia de estudiantes y docentes.

---

## 📊 Estado del Sistema (roadmap de mejoras completado)

### 1. Experiencia del Estudiante
*   [x] **Gamificación (Rango Ninja)**: Cálculo dinámico de XP (asistencia, tareas entregadas, promedio de calificaciones, participación en foros y mejores respuestas), niveles y medallas de honor de cursada (Maestro de Chakra, Asistencia Perfecta, Ninja Activo, Solucionador).
*   [x] **Foros y Preguntas y Respuestas por Clase (Q&A)**: Hilos de consulta en tiempo real por clase, reacciones emoji (👍, 🎉, ❤️) y Modo "Stack Overflow" (solución/respuesta correcta destacada por el docente).
*   [x] **Grupos de Cursada Auto-organizados**: Subpestaña "Grupos de Estudio" para la creación de grupos y emparejamiento inteligente de compañeros afines según su turno/disponibilidad horaria.
*   [x] **Módulo de Tutorías Académicas (Mentoría entre Pares)**: Subpestaña "Tutorías" para postularse como tutor, listar tutores de la cursada, reservar mentorías con sala de videoconferencia generada automáticamente en Google Meet.
*   [x] **Sincronización de Calendario (Exportación iCal/ICS)**: Exportación instantánea del cronograma dinámico de clases y entregas a Google Calendar, Apple Calendar y Outlook mediante archivos `.ics` e iCal feeds.
*   [x] **Marcadores Temporales en Grabaciones (Bookmarks)**: Sistema de etiquetado por timestamps en grabaciones de video para acceder instantáneamente a explicaciones clave.
*   [ ] **Buscador Rápido Inteligente (Command + K)**: Implementar una barra de búsqueda omni-buscadora (Spotlight Search) accesible en cualquier parte del sitio para buscar temas de clases, avisos, entregas o nombres de profesores de forma instantánea.
*   [ ] **Portafolio de Proyectos Públicos**: Dar la opción a los estudiantes de configurar ciertas entregas de GitHub como "públicas" en su perfil de la plataforma, creando un portafolio de proyectos académicos visible para reclutadores.

### 2. Experiencia Docente
*   [x] **Registro de Asistencia mediante QR Dinámico**: Generación de token alfanumérico temporal (expiración de 45 segundos) con geolocalización de docente y validación de proximidad GPS (< 150m) en el backend (Cloud Function).
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
*   [x] **Integración LTI con Moodle (4.2+)**: Soporte para enlaces directos LTI 1.3, redireccionamiento dinámico de URIs REST y hoja de ruta para la sincronización automática de notas e inscripciones ([MOODLE_INTEGRATION.md](file:///home/mrtin/dev/gaula/docs/MOODLE_INTEGRATION.md)).
*   [ ] **Detección de Plagio y Copias**: Analizador automático de código estático (usando similitud estructural de AST o APIs de comparación de código) que escanee los repositorios de GitHub entregados y alerte al docente de posibles plagios entre alumnos.
*   [ ] **Autenticación Unificada (Single Sign-On / SSO)**: Soporte para login a través de servidores institucionales universitarios (OAuth2, SAML, Microsoft Azure AD o Google Workspace corporativo).

---

## 💡 Nuevas 10+ Funcionalidades Potenciales (Propuestas por Categoría)

### 🤖 Inteligencia Artificial & Asistencia Pedagógica
1. **Asistente Pedagógico de Corrección por IA**: Sugerencia automática de notas y comentarios analizando las diferencias de código (diffs) de los estudiantes con las soluciones esperadas.
2. **Generador Automático de Exámenes y Cuestionarios**: Creación instantánea de preguntas y evaluaciones adaptadas al temario de cada clase mediante modelos de IA (Gemini API).
3. **Resúmenes Automáticos de Clases Grabadas**: Transcripción y síntesis inteligente de las grabaciones de clases guardando marcadores temporales automáticos.

### 📈 Analítica Avanzada & Gestión Institucional
4. **Matriz de Competencias y Progreso Académico**: Tablero visual del mapa de habilidades teóricas y prácticas adquiridas por cada estudiante a lo largo del cuatrimestre.
5. **Predicción de Abandono Escolar con Machine Learning**: Algoritmo de clasificación que identifique patrones tempranos de deserción combinando entregas omitidas, asistencias caídas y baja interacción en foros.
6. **Sistema de Certificados Digitales Verificables en Blockchain / QR**: Generación automática de certificados de aprobación de cátedras con código QR de autenticidad para egresados.

### 🤝 Colaboración & Aprendizaje Experiencial
7. **Simulador de Code Reviews en Equipo**: Flujo de trabajo donde los estudiantes deben revisar y comentar los Pull Requests de sus compañeros antes de la entrega final.
8. **Salas de Estudio Virtuales con Pizarra Interactiva (Whiteboard)**: Espacio síncrono integrado con dibujo vectorial, notas adhesivas y chat web para grupos de estudio.
9. **Desafíos Semanales de Código (Coding League)**: Desafíos cortos semanales estilo LeetCode / Hackerrank que otorgan XP adicional en la tabla de clasificación.

### 🔐 Seguridad & Infraestructura Institucional
10. **Proctoring y Control de Integridad en Exámenes**: Modo seguro de evaluación remota con detección de cambio de pestañas, bloqueo de navegador y supervisión periódica.
11. **Sincronización Automática Bidireccional con SIU Guaraní / Banner**: API de integración con sistemas universitarios para importar actas oficiales y subir notas finales.
