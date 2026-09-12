# Plan Estratégico de Mejoras Técnicas y de Producto - Ninja Dojo (Jutsu Classroom)

Este documento presenta un diagnóstico integral del estado actual del repositorio y propone **250 mejoras concretas**, organizadas estrictamente en **5 categorías clave** con **50 propuestas detalladas por categoría**.

---

## Resumen Ejecutivo y Diagnóstico del Estado Actual

Tras el análisis exhaustivo del código fuente, dependencias, pipelines de CI/CD y módulos funcionales (`auth`, `course`, `github`, `attendance`, `calendar`, `mail`, `moodle`, `study_groups`, `tutoring`), se destacan los siguientes hallazgos:

1. **Frontend & UI/UX**: La aplicación cuenta con una estética dark/cyberpunk ("Ninja Dojo") bien lograda con Tailwind CSS, pero sufre de componentes monolíticos (p. ej. `CourseSchedulesPanel.tsx` con más de 1.000 líneas), falta de trampas de foco en modales nativos, uso repetido de `<img>` sin optimización, y accesibilidad parcial que requiere estandarización.
2. **Arquitectura y Calidad de Código**: Persiste una alta presencia de tipos `any` en props y estados, llamadas directas a Firestore dentro de componentes de presentación en lugar de custom hooks o capas de servicios dedicadas, y ausencia de validadores de esquema (como Zod) en formularios complejos.
3. **Backend y Seguridad**: Las reglas de Firestore (`firestore.rules`) implementan RBAC pero delegan validaciones estructurales de campos; las Cloud Functions en `functions/index.js` están en un único archivo JavaScript CommonJS sin TypeScript ni separación modular por dominio.
4. **Rendimiento**: Se procesan arrays grandes en memoria en componentes de visualización sin virtualización (roster de alumnos, listas de entregas y comentarios), lo que impacta el tiempo de renderizado y el Total Blocking Time (TBT).
5. **Testing y DevOps**: Se cuenta con suites funcionales de Jest y Selenium legado; no obstante, carece de tests de integración para componentes de React, los tests E2E con Selenium son lentos y propensos a fragilidad (migración aconsejada a Playwright), y la observabilidad en producción es básica.

---

## Categoría 1: Frontend, UX/UI y Accesibilidad (a11y)

_Mejoras orientadas a la experiencia de usuario, diseño visual, usabilidad móvil, navegación intuitiva y cumplimiento estricto de accesibilidad WCAG 2.1 AA._

**Total de propuestas en esta categoría:** 50

### 1.01. Implementación de trampa de foco (Focus Trap) en todos los modales
- **Diagnóstico actual:** Actualmente los modales permiten que al presionar Tab el foco del teclado escape hacia el fondo de la página, desorientando a usuarios de tecnologías asistivas.
- **Archivos involucrados:** `src/modules/course/components/AdminPanel.tsx, src/modules/course/components/FeedbackModals.tsx`
- **Propuesta técnica:** Incorporar un hook `useFocusTrap` o la biblioteca nativa headless UI / Radix Dialog para atrapar el tabulado dentro del modal y restaurar el foco al cerrarlo.
- **Impacto y beneficio:** Cumplimiento estricto de WCAG 2.1 AA en navegación por teclado.

### 1.02. Soporte de cierre con tecla Escape en todas las ventanas modales
- **Diagnóstico actual:** Algunos modales solo se pueden cerrar haciendo clic en la 'X' o fuera de ellos, sin escuchar el evento de teclado `Escape`.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx, src/modules/mail/components/EmailManagementPanel.tsx`
- **Propuesta técnica:** Agregar un listener global `keydown` para `Escape` en el contenedor de modal que invoque el callback de cierre.
- **Impacto y beneficio:** Mejora inmediata de ergonomía y accesibilidad para teclado.

### 1.03. Migración de elementos <img> nativos a Next.js <Image />
- **Diagnóstico actual:** Se utilizan etiquetas `<img>` estándar de HTML, lo que provoca advertencias de ESLint y no aprovecha WebP/AVIF ni lazy loading automático.
- **Archivos involucrados:** `src/app/dashboard/components/Sidebar.tsx, src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Reemplazar por `next/image` configurando loaders adecuados para avatares de GitHub y Google Auth.
- **Impacto y beneficio:** Reducción de Largest Contentful Paint (LCP) y menor consumo de ancho de banda.

### 1.04. Adición de atributos aria-expanded y aria-controls en menús colapsables
- **Diagnóstico actual:** Los elementos desplegables como semanas de cursada y acordeones de materias no comunican su estado expandido/colapsado a lectores de pantalla.
- **Archivos involucrados:** `src/app/dashboard/components/Sidebar.tsx, src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Añadir `aria-expanded={isOpen}` y `aria-controls={id}` con IDs únicos vinculados a las secciones colapsables.
- **Impacto y beneficio:** Experiencia transparente y comprensible para usuarios de lectores de pantalla.

### 1.05. Estandarización de estados de foco visible (focus-visible) en todos los elementos interactivos
- **Diagnóstico actual:** Muchos botones tienen `focus:outline-none` sin proveer un reemplazo de `focus-visible` distintivo con buen contraste.
- **Archivos involucrados:** `src/app/globals.css`
- **Propuesta técnica:** Definir una clase global de utilidad `@apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500` en `globals.css`.
- **Impacto y beneficio:** Navegación por teclado predecible y accesible en toda la plataforma.

### 1.06. Implementación de anuncios dinámicos para cambios de pestañas (aria-live polite)
- **Diagnóstico actual:** Al alternar entre pestañas ('Overview', 'Clases', 'Tareas', 'Asistencias'), el lector de pantalla no notifica el cambio de contenido.
- **Archivos involucrados:** `src/app/dashboard/components/CourseDetailSection.tsx`
- **Propuesta técnica:** Añadir una región de estado con `role='status'` y `aria-live='polite'` que anuncie 'Sección X cargada'.
- **Impacto y beneficio:** Orientación espacial para usuarios no videntes.

### 1.07. Mejora de contraste de color en textos grises tenues
- **Diagnóstico actual:** Existen clases como `text-gray-550`, `text-gray-450` y `text-neutral-500` sobre fondos `#0a0a0a` con ratios de contraste inferiores a 4.5:1.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx, src/modules/calendar/components/CalendarPanel.tsx`
- **Propuesta técnica:** Ajustar la paleta de Tailwind a colores con ratio mínimo de 4.5:1 para texto normal y 3:1 para texto grande.
- **Impacto y beneficio:** Cumplimiento de ratio de contraste WCAG nivel AA.

### 1.08. Adición de texto alternativo dinámico y descriptivo en avatares de usuario
- **Diagnóstico actual:** Los avatares muestran imágenes con `alt='User'` o `alt='Avatar'` genéricos sin aportar contexto.
- **Archivos involucrados:** `src/app/dashboard/components/Sidebar.tsx, src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Usar `alt={profile.full_name || profile.email || 'Avatar de usuario'}` para que el lector identifique al emisor.
- **Impacto y beneficio:** Identificación clara de quién participa en comentarios y foros.

### 1.09. Estandarización de mensajes Toast con Sonner y soporte de región aria-live
- **Diagnóstico actual:** Se mezclan múltiples sistemas de notificación (`nextjs-toast-notify` y `sonner`), duplicando estilos y lógica.
- **Archivos involucrados:** `src/lib/clipboard.ts, src/app/dashboard/page.tsx`
- **Propuesta técnica:** Unificar toda la mensajería efímera bajo `sonner`, asegurando que el toaster tenga `role='region'` y `aria-label='Notificaciones'`.
- **Impacto y beneficio:** Consistencia visual y accesibilidad garantizada en notificaciones flotantes.

### 1.10. Diseño de estado vacío (Empty State) ilustrado y accionable en tareas
- **Diagnóstico actual:** Cuando un curso no tiene tareas creadas, solo se muestra un texto gris plano sin call to action.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Diseñar un componente de estado vacío con ilustración SVG, mensaje motivador y botón directo 'Crear primera tarea'.
- **Impacto y beneficio:** Mejora sustancial del onboarding del docente y aspecto profesional.

### 1.11. Diseño de estado vacío para entregas de alumnos pendientes
- **Diagnóstico actual:** El estado de 'Sin entregas pendientes' carece de un indicador visual amigable.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Implementar una tarjeta de felicitación con icono ninja y mensaje '¡Todo al día! No tienes trabajos pendientes de revisión'.
- **Impacto y beneficio:** Refuerzo positivo en la experiencia de corrección de docentes.

### 1.12. Indicadores de carga esqueletal (Skeleton Screens) en lugar de spinners genéricos
- **Diagnóstico actual:** Las pantallas de carga muestran un spinner giratorio centrado que provoca saltos de maquetación (Cumulative Layout Shift).
- **Archivos involucrados:** `src/app/dashboard/components/GateScreens.tsx, src/modules/calendar/components/CalendarPanel.tsx`
- **Propuesta técnica:** Crear componentes esqueleto pulsantes que simulen la grilla de clases y tarjetas antes de recibir los datos de Firestore.
- **Impacto y beneficio:** Sensación de mayor velocidad de carga y menor CLS.

### 1.13. Confirmación destructiva con modal accesible en lugar de window.confirm()
- **Diagnóstico actual:** Se utiliza `confirm()` nativo del navegador para eliminar comisiones, bloqueando el hilo de ejecución y desentonando con la estética.
- **Archivos involucrados:** `src/modules/course/components/CourseSettingsPanel.tsx`
- **Propuesta técnica:** Crear un componente `ConfirmationModal` reutilizable con estética Dojo, foco atrapado y descripción clara del impacto.
- **Impacto y beneficio:** UI cohesiva y controlada, sin diálogos intrusivos del navegador.

### 1.14. Añadir tooltip accesible con teclado y retardo en botones con solo icono
- **Diagnóstico actual:** Los botones como editar, borrar o anclar comentario carecen de tooltips informativos para usuarios visuales que navegan con teclado.
- **Archivos involucrados:** `src/modules/course/components/AdminPanel.tsx, src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Integrar una directiva de tooltip accesible activable por `:hover` y `:focus-visible`.
- **Impacto y beneficio:** Claridad de la acción antes de ejecutarla.

### 1.15. Mejora responsiva de la barra lateral (Sidebar) para dispositivos móviles
- **Diagnóstico actual:** En pantallas pequeñas la barra lateral ocupa demasiado espacio o requiere desplazamientos horizontales incómodos.
- **Archivos involucrados:** `src/app/dashboard/components/Sidebar.tsx`
- **Propuesta técnica:** Convertir la barra en un Navigation Drawer off-canvas con botón hamburguesa accesible y backdrop animado.
- **Impacto y beneficio:** Navegabilidad óptima en smartphones y tablets.

### 1.16. Soporte para navegación por teclado en el tablero Kanban de clases
- **Diagnóstico actual:** El tablero Kanban solo permite mover clases mediante Drag and Drop del ratón, excluyendo a usuarios de teclado o lectores de pantalla.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Añadir atajos de teclado o un selector accesible 'Mover a: [Teórica / Práctica / Feriado]' en cada tarjeta.
- **Impacto y beneficio:** Inclusión completa para usuarios con discapacidades motrices.

### 1.17. Scroll horizontal suave y sombras indicadoras en tablas de asistencia
- **Diagnóstico actual:** Las tablas anchas se cortan en pantallas angostas sin indicar visualmente que hay más columnas para scrollear.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Implementar gradientes sutiles de sombra en los bordes de la tabla que indiquen desbordamiento desplazable.
- **Impacto y beneficio:** Usabilidad intuitiva de tablas en cualquier resolución.

### 1.18. Botón de 'Volver arriba' flotante en paneles extensos
- **Diagnóstico actual:** Al desplazarse por más de 30 clases, volver a los selectores superiores requiere un desplazamiento manual prolongado.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Añadir un botón flotante visible tras 400px de scroll con transición suave (`window.scrollTo({ top: 0, behavior: 'smooth' })`).
- **Impacto y beneficio:** Ergonomía de navegación en cursadas con cronogramas extensos.

### 1.19. Feedback táctil (Haptic Feedback) en escaneo de códigos QR en móviles
- **Diagnóstico actual:** Al registrar asistencia mediante la cámara del móvil, el alumno no recibe confirmación táctil del éxito del escaneo.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx`
- **Propuesta técnica:** Invocar `navigator.vibrate?.([50, 50, 50])` cuando la cámara detecta un token válido de clase.
- **Impacto y beneficio:** Sensación física gratificante y confirmación instantánea.

### 1.20. Personalización visual del tema según el nivel Ninja del alumno
- **Diagnóstico actual:** El rango ninja (Genin, Chunin, Jonin) se muestra solo en texto y una tarjeta pequeña.
- **Archivos involucrados:** `src/app/dashboard/components/StudentNinjaRankCard.tsx`
- **Propuesta técnica:** Desbloquear skins de borde luminosos o sutiles partículas en el avatar según el rango alcanzado.
- **Impacto y beneficio:** Mayor compromiso y motivación mediante gamificación visual.

### 1.21. Añadir atajo de teclado global para abrir el buscador / Command Palette
- **Diagnóstico actual:** Los usuarios deben hacer clic manualmente en el botón de búsqueda para encontrar clases o tareas.
- **Archivos involucrados:** `src/components/dashboard/ui/CommandPalette.tsx`
- **Propuesta técnica:** Habilitar atajo global `Ctrl+K` o `Cmd+K` con indicador visual de atajo en la cabecera.
- **Impacto y beneficio:** Flujo de trabajo ultra veloz para docentes y alumnos avanzados.

### 1.22. Animación fluida de transición de vistas con CSS View Transitions API
- **Diagnóstico actual:** Los cambios entre pestañas se sienten instantáneos pero secos, sin continuidad espacial.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Aprovechar `document.startViewTransition` si está soportado para animar suavemente el cambio de panel.
- **Impacto y beneficio:** Sensación de aplicación nativa moderna.

### 1.23. Etiquetado claro de campos obligatorios mediante asteriscos y aria-required
- **Diagnóstico actual:** Los formularios indican obligatoriedad mediante el atributo `required` pero sin aclaración textual ni `aria-required='true'`.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx, src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Incorporar `<span aria-hidden='true'>*</span>` visible y una leyenda superior 'Los campos marcados con * son obligatorios'.
- **Impacto y beneficio:** Claridad previa al envío de formularios.

### 1.24. Validación visual inmediata (en línea) al perder el foco (onBlur)
- **Diagnóstico actual:** Los errores de URL o tokens se muestran únicamente tras presionar 'Guardar' o 'Sincronizar'.
- **Archivos involucrados:** `src/modules/moodle/components/MoodleIntegrationPanel.tsx`
- **Propuesta técnica:** Validar formato de URL y token en el evento `onBlur` y mostrar borde verde/rojo con mensaje explicativo.
- **Impacto y beneficio:** Prevención temprana de errores de configuración.

### 1.25. Opción de alternar visibilidad de contraseña con icono accesible
- **Diagnóstico actual:** Al escribir la contraseña no se puede verificar si hubo un error de tipeo.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Añadir un botón tipo 'ojo' dentro del input con `aria-label='Mostrar contraseña'` / `aria-label='Ocultar contraseña'`.
- **Impacto y beneficio:** Reducción de intentos de inicio de sesión fallidos por errores tipográficos.

### 1.26. Soporte de temas de alto contraste para usuarios con baja visión
- **Diagnóstico actual:** La paleta oscura cyberpunk puede ser difícil de leer para usuarios con astigmatismo o baja visión.
- **Archivos involucrados:** `src/app/globals.css`
- **Propuesta técnica:** Añadir un modo 'Alto Contraste' que utilice fondos negros puros (`#000000`) y bordes blancos netos (`#ffffff`).
- **Impacto y beneficio:** Accesibilidad universal certificable.

### 1.27. Mensaje de confirmación copiado al portapapeles con animación en el botón
- **Diagnóstico actual:** Al copiar enlaces de asistencia o invitaciones solo se dispara un toast genérico.
- **Archivos involucrados:** `src/lib/clipboard.ts, src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Cambiar temporalmente el icono del botón copiado de '📋' a '✅ Copiado' durante 2 segundos.
- **Impacto y beneficio:** Feedback microinteractivo directo en el punto de interacción.

### 1.28. Previsualización de Markdown en tiempo real al redactar descripciones de tareas
- **Diagnóstico actual:** Los docentes escriben descripciones en Markdown pero no pueden verificar si las listas o código quedaron bien formateados.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Agregar una pestaña 'Vista previa' que renderice con `marked` el contenido redactado.
- **Impacto y beneficio:** Mejora en la calidad pedagógica de las consignas.

### 1.29. Diseño de tarjeta de 'Alumnos en Riesgo' con acciones rápidas de contacto
- **Diagnóstico actual:** La lista de alumnos en riesgo solo muestra el nombre y porcentaje de inasistencia.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Incluir botones de acción directa: 'Enviar Correo de Alerta' y 'Agendar Tutoría' con un solo clic.
- **Impacto y beneficio:** Intervención docente oportuna antes de que el estudiante abandone.

### 1.30. Filtro visual por estado de corrección en la vista de tareas
- **Diagnóstico actual:** Las entregas se listan sin posibilidad de filtrar rápidamente por 'Corregidas', 'Pendientes' o 'Desaprobadas'.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Implementar chips de filtrado rápido en la cabecera del panel de entregas.
- **Impacto y beneficio:** Ahorro de tiempo sustancial en periodos de corrección intensiva.

### 1.31. Badge visual de 'Nuevo' para clases programadas recientemente
- **Diagnóstico actual:** Si un docente añade una clase extraordinaria o recuperatorio, los alumnos no la distinguen fácilmente.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Mostrar un badge 'Nueva' animado durante los primeros 3 días desde su creación.
- **Impacto y beneficio:** Disminución de inasistencias por cambios imprevistos de cronograma.

### 1.32. Soporte de zoom de texto hasta 200% sin ruptura de diseño
- **Diagnóstico actual:** Al ampliar el tamaño de fuente del navegador al 200%, algunos contenedores fijos con `h-[Xpx]` desbordan contenido.
- **Archivos involucrados:** `src/app/globals.css`
- **Propuesta técnica:** Reemplazar alturas fijas por `min-h` y unidades relativas `rem` en lugar de `px` estáticos.
- **Impacto y beneficio:** Cumplimiento de la pauta WCAG 1.4.4 (Resize text).

### 1.33. Indicador de conexión a Internet (Offline Banner)
- **Diagnóstico actual:** Si el usuario pierde conectividad mientras está en el aula, las consultas a Firestore fallan silenciosamente.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Escuchar `window.addEventListener('online')` y `offline` para desplegar un banner superior amigable.
- **Impacto y beneficio:** Transparencia sobre el estado de la red para evitar pérdida de datos.

### 1.34. Selector de materias con buscador integrado para usuarios con múltiples comisiones
- **Diagnóstico actual:** Docentes con más de 6 comisiones deben desplazarse por un select largo e incómodo.
- **Archivos involucrados:** `src/app/dashboard/components/CourseDetailSection.tsx`
- **Propuesta técnica:** Reemplazar el select nativo por un combobox accesible con búsqueda incremental de cursos.
- **Impacto y beneficio:** Navegación ágil en entornos universitarios con alta carga horaria.

### 1.35. Optimización del selector de fecha y hora en el cronograma
- **Diagnóstico actual:** Los inputs `type='date'` nativos varían drásticamente entre navegadores y a veces no admiten teclado adecuadamente.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Diseñar un DatePicker accesible que permita selección rápida de 'Próximo lunes', 'Día siguiente' y atajos rápidos.
- **Impacto y beneficio:** Carga mucho más rápida del cronograma semestral.

### 1.36. Indicador de progreso de lectura en hilos de comentarios extensos
- **Diagnóstico actual:** En clases con decenas de preguntas no se sabe cuántas consultas quedan por revisar.
- **Archivos involucrados:** `src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Incorporar una barra de progreso sutil y contador '5 de 23 consultas leídas'.
- **Impacto y beneficio:** Mejor seguimiento de dudas académicas.

### 1.37. Diseño de insignias de rol docente / ayudante / alumno con colores normados
- **Diagnóstico actual:** Las respuestas de docentes y ayudantes a veces se confunden visualmente con las de los compañeros.
- **Archivos involucrados:** `src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Destacar las respuestas oficiales con borde dorado, insignia 'Docente' y fondo ligeramente diferenciado.
- **Impacto y beneficio:** Autoridad pedagógica y rápida localización de soluciones válidas.

### 1.38. Añadir confirmación visual de guardado automático (Autosave indicator)
- **Diagnóstico actual:** El docente no tiene certeza de cuándo sus cambios en ponderaciones o comisiones quedan persistidos en la nube.
- **Archivos involucrados:** `src/modules/course/components/CourseSettingsPanel.tsx`
- **Propuesta técnica:** Mostrar un texto dinámico 'Guardando...' -> 'Todos los cambios guardados ✓' junto al título.
- **Impacto y beneficio:** Paz mental y confianza en la integridad de la configuración.

### 1.39. Agrupación visual de feriados consecutivos (Semana Santa / Receso invernal)
- **Diagnóstico actual:** Los feriados se muestran como tarjetas individuales separadas, ocupando demasiado espacio vertical.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Agrupar días no laborables consecutivos en un bloque único de receso.
- **Impacto y beneficio:** Cronograma más compacto y fácil de interpretar.

### 1.40. Facilidad para duplicar tareas y actividades entre comisiones
- **Diagnóstico actual:** Los docentes deben recrear manualmente la misma tarea para cada comisión de una materia.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Añadir botón 'Clonar tarea a otra comisión' que copie plantilla, títulos y fechas base.
- **Impacto y beneficio:** Ahorro masivo de tiempo administrativo.

### 1.41. Exportación de cronograma de cursada a formato iCalendar (.ics)
- **Diagnóstico actual:** Los alumnos deben cargar a mano las fechas de exámenes y entregas en sus calendarios personales.
- **Archivos involucrados:** `src/modules/calendar/components/CalendarPanel.tsx`
- **Propuesta técnica:** Implementar descarga de archivo `.ics` y enlace 'Añadir a Google Calendar' para el cronograma completo.
- **Impacto y beneficio:** Puntualidad y mejor organización estudiantil.

### 1.42. Botón accesible para copiar comandos de git de los repositorios de alumnos
- **Diagnóstico actual:** Para clonar y probar el trabajo de un alumno, el docente debe seleccionar el texto de la URL con cuidado.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Añadir botón 'Copiar `git clone <url>`' con un solo clic.
- **Impacto y beneficio:** Flujo de corrección técnica ágil para docentes de programación.

### 1.43. Alerta previa de cierre de sesión por inactividad
- **Diagnóstico actual:** Si la sesión expira mientras el docente está redactando feedback, el trabajo se pierde al enviar.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Modal de aviso 5 minutos antes de expirar el token con opción de 'Extender sesión'.
- **Impacto y beneficio:** Prevención de pérdida de calificaciones y comentarios detallados.

### 1.44. Mejora de accesibilidad en los gráficos de métricas de asistencia y entregas
- **Diagnóstico actual:** Las barras de porcentaje dependen exclusivamente del color (verde/rojo) para transmitir estado de riesgo.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Agregar iconos distintivos (✓, ⚠️, ❌) y textos explicativos junto a las barras de color.
- **Impacto y beneficio:** Comprensión sin barreras para usuarios con daltonismo.

### 1.45. Modo presentación para proyectar clases en el aula sin mostrar notas privadas
- **Diagnóstico actual:** Al proyectar el cronograma en el aula, el docente corre el riesgo de mostrar comentarios confidenciales o alumnos en riesgo.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Añadir un interruptor 'Modo Proyector' que oculte temporalmente datos de riesgo y notas de alumnos.
- **Impacto y beneficio:** Privacidad y tranquilidad durante las clases presenciales.

### 1.46. Paginación accesible o scroll infinito controlado en el visor de commits de GitHub
- **Diagnóstico actual:** Repositorios con cientos de commits cargan la lista entera de golpe saturando el DOM.
- **Archivos involucrados:** `src/modules/github/components/CommitVisualizer.tsx`
- **Propuesta técnica:** Implementar paginación accesible con botones 'Anterior / Siguiente' y anunciador de página.
- **Impacto y beneficio:** Navegación eficiente y sin sobrecarga del navegador.

### 1.47. Soporte para cambiar el tamaño de texto de los comentarios (A- / A+)
- **Diagnóstico actual:** Muchos docentes revisan dudas desde pantallas de portátiles pequeños donde la fuente `text-xs` resulta fatigante.
- **Archivos involucrados:** `src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Incorporar selector de escala de lectura en el panel de comentarios.
- **Impacto y beneficio:** Menor fatiga visual durante jornadas de corrección prolongadas.

### 1.48. Personalización de sonidos ninja sutiles opcionales para feedback de acciones
- **Diagnóstico actual:** Falta de feedback sonoro lúdico característico de la temática Ninja.
- **Archivos involucrados:** `src/app/dashboard/components/StudentNinjaRankCard.tsx`
- **Propuesta técnica:** Añadir efectos de sonido sutiles con interruptor de mute para: entrega enviada, subida de nivel y tarea aprobada.
- **Impacto y beneficio:** Mayor inmersión y deleite en la experiencia del estudiante.

### 1.49. Mensaje de advertencia al intentar cerrar ventana con formulario sucio (Unsaved changes)
- **Diagnóstico actual:** Si se editan fechas o plantillas y se cierra la pestaña por error, no hay advertencia del navegador.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx, src/modules/mail/components/EmailManagementPanel.tsx`
- **Propuesta técnica:** Implementar hook `useBeforeUnload` que avise si hay cambios sin guardar pendientes.
- **Impacto y beneficio:** Seguridad contra descuidos accidentales.

### 1.50. Checklist interactivo de bienvenida y primeros pasos para nuevos alumnos
- **Diagnóstico actual:** Alumnos recién ingresados no saben qué hacer primero (vincular GitHub, escanear asistencia, ver foros).
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Diseñar un checklist flotante de 'Misiones Ninja iniciales' que se complete a medida que usan las funciones.
- **Impacto y beneficio:** Aceleración del onboarding estudiantil y reducción de consultas de soporte.


## Categoría 2: Arquitectura de Software, TypeScript y Calidad de Código

_Refactorización estructural, eliminación de componentes monolíticos, tipado estricto libre de 'any', creación de custom hooks de dominio y patrones de diseño limpios._

**Total de propuestas en esta categoría:** 50

### 2.01. Eliminación sistemática de tipos 'any' en CourseOverviewPanel
- **Diagnóstico actual:** Las props y estructuras internas usan `any`, perdiendo autocompletado y protección ante cambios de modelo.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Definir interfaces estrictas `CourseOverviewPanelProps`, `StudentRiskData` y `SubmissionSummary`.
- **Impacto y beneficio:** Seguridad en tiempo de compilación y refactorización sin miedo.

### 2.02. Modularización del monolito CourseSchedulesPanel (1.100 líneas)
- **Diagnóstico actual:** El archivo contiene listas, vistas semanales, tablero Kanban, modales de diff y lógica de negocio en un solo componente gigante.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Dividir en `ScheduleListView.tsx`, `ScheduleKanbanView.tsx`, `ScheduleWeeklyView.tsx` y `ScheduleDiffModal.tsx`.
- **Impacto y beneficio:** Mantenibilidad radical, facilidad de lectura y testeabilidad individual.

### 2.03. Modularización de AssignmentsPanel (600 líneas)
- **Diagnóstico actual:** Combina formularios de creación, listado de entregas, panel de feedback y revisión de pares.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Separar en subcomponentes `AssignmentCreationForm.tsx`, `AssignmentCard.tsx` y `SubmissionReviewModal.tsx`.
- **Impacto y beneficio:** Separación clara de responsabilidades (Single Responsibility Principle).

### 2.04. Creación de Custom Hook useCourseAttendance
- **Diagnóstico actual:** La lógica para filtrar y calcular asistencias de alumnos se repite manualmente en múltiples componentes.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx, src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Extraer un hook `useCourseAttendance(courseId)` que centralice la suscripción y cálculos de porcentajes.
- **Impacto y beneficio:** Código DRY y lógica de asistencias reutilizable.

### 2.05. Creación de Custom Hook useStudentRisk
- **Diagnóstico actual:** El cálculo de riesgo de estudiantes involucra iteraciones sobre asistencias y tareas vencidas dentro del render.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Encapsular el algoritmo en `useStudentRisk(roster, attendance, submissions, pastDueAssignments)`.
- **Impacto y beneficio:** Lógica testeable de forma aislada sin montar componentes React.

### 2.06. Creación de Custom Hook useAssignments
- **Diagnóstico actual:** Las operaciones de crear, editar, listar y calificar tareas están acopladas al JSX del componente.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Extraer `useAssignments(courseId)` con métodos `createAssignment`, `updateAssignment` y `deleteAssignment`.
- **Impacto y beneficio:** Componentes de vista puramente declarativos.

### 2.07. Adopción de Zod para validación de formularios en el cliente y servidor
- **Diagnóstico actual:** Las validaciones se realizan con `if` anidados manuales que pueden omitir casos límite.
- **Archivos involucrados:** `src/modules/moodle/components/MoodleIntegrationPanel.tsx, src/app/api/lti/route.ts`
- **Propuesta técnica:** Definir esquemas Zod (`MoodleConfigSchema`, `LtiPayloadSchema`) y validar antes de enviar o procesar.
- **Impacto y beneficio:** Tipado inferido automáticamente y validación exhaustiva de payloads.

### 2.08. Implementación de React Error Boundaries por módulo
- **Diagnóstico actual:** Si un componente falla al procesar datos malformados de GitHub o Firestore, toda la pantalla del dashboard cae en blanco.
- **Archivos involucrados:** `src/app/dashboard/layout.tsx, src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Envolver cada pestaña principal en un `ModuleErrorBoundary` que muestre un estado de error elegante con botón 'Reintentar módulo'.
- **Impacto y beneficio:** Resiliencia de la plataforma ante errores imprevistos sin tumbar toda la sesión.

### 2.09. Estandarización de la capa de API Client con Axios o Fetch Tipado
- **Diagnóstico actual:** Actualmente `src/lib/api.ts` es minimalista y muchas llamadas usan `fetch` directo con URLs construidas a mano.
- **Archivos involucrados:** `src/lib/api.ts`
- **Propuesta técnica:** Construir un cliente HTTP unificado con interceptores para inyectar automáticamente el Bearer Token de Firebase Auth y manejar errores 401/403.
- **Impacto y beneficio:** Gestión transparente de autenticación y manejo centralizado de respuestas.

### 2.10. Eliminación de tipos 'any' en el sistema de comentarios
- **Diagnóstico actual:** Los objetos `comment` no tienen interfaces definidas, lo que oculta qué propiedades opcionales existen (`is_best_answer`, `user_role`).
- **Archivos involucrados:** `src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Crear la interfaz `ClassComment` con tipos estrictos para autor, marcas temporales y roles permitidos.
- **Impacto y beneficio:** Código auto-documentado y prevención de accesos a propiedades inexistentes.

### 2.11. Unificación de utilidades de fechas en src/lib/dates.ts
- **Diagnóstico actual:** Existen instanciaciones repetidas de `Intl.DateTimeFormat` dispersas en múltiples archivos.
- **Archivos involucrados:** `src/lib/dates.ts, src/modules/calendar/components/CalendarPanel.tsx, src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Exportar formateadores estáticos centralizados (`formatDateFull`, `formatDateTime`, `formatShortDate`) desde `src/lib/dates.ts`.
- **Impacto y beneficio:** Cero duplicación de formateadores de fecha en la base de código.

### 2.12. Centralización de constantes de roles y estados
- **Diagnóstico actual:** Cadenas como `'student'`, `'teacher'`, `'admin'`, `'submitted'`, `'present'` están harcodeadas como strings en decenas de archivos.
- **Archivos involucrados:** `src/modules/auth/types.ts`
- **Propuesta técnica:** Crear enums o constantes tipadas `UserRole`, `SubmissionStatus`, `AttendanceStatus`.
- **Impacto y beneficio:** Refactorizaciones seguras y eliminación de errores por typos en strings.

### 2.13. Implementación de Repository Pattern para entidades de Firestore
- **Diagnóstico actual:** Los componentes ejecutan consultas directas `collection(db, ...)` y `getDocs()` mezcladas con lógica de renderizado.
- **Archivos involucrados:** `src/lib/firebase/repositories/`
- **Propuesta técnica:** Crear repositorios (`CourseRepository`, `SubmissionRepository`, `AttendanceRepository`) que aíslen la persistencia.
- **Impacto y beneficio:** Desacoplamiento total entre la capa de UI y la base de datos subyacente.

### 2.14. Migración de scripts CommonJS a TypeScript en funciones auxiliares
- **Diagnóstico actual:** Existen scripts auxiliares sin tipado que se ejecutan directamente con Node sin validación estática.
- **Archivos involucrados:** `scripts/test-local.sh, tests/selenium/run-all-tests.js`
- **Propuesta técnica:** Migrar utilidades a TypeScript ejecutables con `tsx` o `ts-node`.
- **Impacto y beneficio:** Consistencia técnica total en todo el repositorio.

### 2.15. Configuración estricta de TypeScript (strict: true)
- **Diagnóstico actual:** Verificar y activar flags estrictas como `noImplicitAny`, `strictNullChecks` y `exactOptionalPropertyTypes`.
- **Archivos involucrados:** `tsconfig.json`
- **Propuesta técnica:** El compilador protege contra accesos a `null` o `undefined` en tiempo de desarrollo.
- **Impacto y beneficio:** Eliminación de los errores 'Cannot read properties of undefined' en producción.

### 2.16. Estandarización de nombres de archivos y estructura de carpetas (Kebab-case vs PascalCase)
- **Diagnóstico actual:** Se mezclan nombres como `study_groups` (snake_case) con `FeedbackModals.tsx` (PascalCase).
- **Archivos involucrados:** `src/modules/`
- **Propuesta técnica:** Adoptar convención estándar: carpetas en `kebab-case` y componentes React en `PascalCase`.
- **Impacto y beneficio:** Coherencia y fácil localización de archivos.

### 2.17. Creación de un contexto global de materia seleccionada (CourseContext)
- **Diagnóstico actual:** La materia activa (`selectedCourse`) se pasa como prop drilling a través de 4 o 5 niveles de componentes.
- **Archivos involucrados:** `src/app/dashboard/page.tsx, src/app/dashboard/components/CourseDetailSection.tsx`
- **Propuesta técnica:** Implementar `CourseContext` y un hook `useCurrentCourse()` para acceder al curso sin prop drilling.
- **Impacto y beneficio:** Componentes intermedios más limpios y desacoplados.

### 2.18. Desacoplamiento de la lógica de exportación a CSV/PDF
- **Diagnóstico actual:** La generación de reportes combina formateo de cadenas y manipulación del DOM en el componente.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx, src/app/api/export/`
- **Propuesta técnica:** Crear servicios dedicados `CsvExportService` y `PdfReportService` en `src/lib/export/`.
- **Impacto y beneficio:** Módulo de reportes reutilizable tanto en cliente como en Cloud Functions.

### 2.19. Eliminación de console.log y uso estricto de src/lib/logger.ts
- **Diagnóstico actual:** Aún quedan llamadas a `console.log` y `console.error` crudas en lugar del registrador estructurado.
- **Archivos involucrados:** `src/modules/moodle/components/MoodleIntegrationPanel.tsx, src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Reemplazar por `logger.info()`, `logger.warn()` y `logger.error()` con metadata del usuario.
- **Impacto y beneficio:** Logs limpios en desarrollo y listos para monitoreo en producción.

### 2.20. Creación de tipos específicos para integración de GitHub API
- **Diagnóstico actual:** Los datos devueltos por GitHub (commits, pull requests, issues) se manejan como `any[]`.
- **Archivos involucrados:** `src/modules/github/types.ts`
- **Propuesta técnica:** Definir interfaces `GitHubCommit`, `GitHubPullRequest` y `GitHubStudentActivity`.
- **Impacto y beneficio:** Autocompletado completo para todas las funciones de analítica de código.

### 2.21. Separación de lógica de QR Scanner del componente visual modal
- **Diagnóstico actual:** La inicialización de `Html5Qrcode`, selección de cámaras y control de permisos está pegada al JSX del modal.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx`
- **Propuesta técnica:** Extraer un custom hook `useQrScanner` con métodos `startScanner`, `stopScanner` y estado `cameraError`.
- **Impacto y beneficio:** Modal liviano y lógica de escaneo reutilizable en otras vistas.

### 2.22. Definición de contrato estricto de eventos para Webhooks de Moodle y GitHub
- **Diagnóstico actual:** Las rutas de recepción de eventos asumen estructura sin validación de tipo en tiempo de compilación.
- **Archivos involucrados:** `src/app/api/lti/route.ts`
- **Propuesta técnica:** Crear tipos de unión discriminada para cada tipo de evento recibido (`LtiLaunchEvent`, `GitHubPushEvent`).
- **Impacto y beneficio:** Manejo exhaustivo de casos (switch exhaustive check) garantizado por TypeScript.

### 2.23. Implementación de un State Manager liviano para modales (useModalState)
- **Diagnóstico actual:** El componente principal acumula más de 10 estados booleanos (`isQrScannerOpen`, `isEditUserOpen`, etc.).
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Crear un gestor de modales unificado con reducer o hook `useModal()` que controle qué modal está abierto.
- **Impacto y beneficio:** Código del Dashboard despejado de estados booleanos repetitivos.

### 2.24. Tipado riguroso de perfiles de usuario y comisiones universitarias
- **Diagnóstico actual:** El mapeo de comisiones (`commissions?: Record<string, string>`) no tiene validación de clave de curso.
- **Archivos involucrados:** `src/modules/auth/types.ts`
- **Propuesta técnica:** Definir tipo `CommissionMapping = Record<CourseId, CommissionCode>` con validación de identificador.
- **Impacto y beneficio:** Cero discrepancias entre IDs de Firestore y nombres de comisión.

### 2.25. Encapsulación de reglas de gamificación en un Domain Service puro
- **Diagnóstico actual:** El cálculo de puntos de asistencia, comentarios y soluciones está dentro de `StudentNinjaRankCard.tsx`.
- **Archivos involucrados:** `src/modules/course/services/gamification.ts`
- **Propuesta técnica:** Crear `GamificationService.calculateXp(profile, comments, attendance, submissions)` en una función pura sin dependencias de React.
- **Impacto y beneficio:** Lógica 100% testeable con pruebas unitarias rápidas sin entorno DOM.

### 2.26. Migración de hooks antiguos useEffect a useSyncExternalStore donde aplique
- **Diagnóstico actual:** Se utilizan efectos para escuchar cambios de red o dimensiones de ventana con riesgo de memory leaks.
- **Archivos involucrados:** `src/lib/clipboard.ts, src/app/dashboard/page.tsx`
- **Propuesta técnica:** Utilizar `useSyncExternalStore` para suscripciones nativas del navegador (`window.ononline`, `matchMedia`).
- **Impacto y beneficio:** Suscripciones reactivas libres de race conditions en React 19.

### 2.27. Estandarización de retornos de funciones asíncronas con Result Pattern
- **Diagnóstico actual:** Se mezclan promesas que arrojan excepciones no tipadas con promesas que retornan `null` ante fallos.
- **Archivos involucrados:** `src/lib/api.ts`
- **Propuesta técnica:** Adoptar el patrón `Result<T, E> = { ok: true, data: T } | { ok: false, error: E }`.
- **Impacto y beneficio:** Flujo de control explícito que obliga al desarrollador a gestionar los errores.

### 2.28. Extracción de lógica de ordenamiento de clases a un comparador puro
- **Diagnóstico actual:** La función de comparación lexicográfica está declarada inline dentro del callback del método sort.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Exportar `compareClassesByDate(a: ClassInstance, b: ClassInstance): number` como utilidad reutilizable.
- **Impacto y beneficio:** Facilidad de reutilización en vistas semanales, reportes y tests.

### 2.29. Documentación con TSDoc de todas las interfaces del dominio
- **Diagnóstico actual:** Muchas propiedades complejas como `special_status` o `sync_secret` carecen de comentarios descriptivos.
- **Archivos involucrados:** `src/modules/`
- **Propuesta técnica:** Añadir bloques `/** ... */` con explicaciones del propósito pedagógico de cada campo.
- **Impacto y beneficio:** Onboarding inmediato para cualquier desarrollador que se sume al proyecto.

### 2.30. Creación de middleware de autenticación compartido para Server Components y API Routes
- **Diagnóstico actual:** Cada endpoint de Next.js verifica el token de Firebase de manera dispar con código repetido.
- **Archivos involucrados:** `src/app/api/middleware/auth.ts`
- **Propuesta técnica:** Crear un middleware estándar `withAuth((req, user) => ...)` que inyecte el usuario validado o retorne 401.
- **Impacto y beneficio:** Cero duplicación de código de verificación de tokens en rutas de servidor.

### 2.31. Aislamiento de la biblioteca marked y sanitización HTML
- **Diagnóstico actual:** Se importa `marked` directamente en vistas sin un sanitizador estricto (DOMPurify).
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx, src/modules/mail/components/EmailManagementPanel.tsx`
- **Propuesta técnica:** Crear un componente `<MarkdownRenderer content={text} />` que use `DOMPurify` de forma estandarizada.
- **Impacto y beneficio:** Protección absoluta contra inyecciones XSS al renderizar Markdown de alumnos o docentes.

### 2.32. Definición de contratos de datos para retroalimentación y peer review
- **Diagnóstico actual:** La revisión entre pares contiene estructuras libres sin validación de rúbrica.
- **Archivos involucrados:** `src/modules/github/components/PeerReviewSection.tsx`
- **Propuesta técnica:** Tipar la rúbrica de calificación con niveles (Excelente, Regular, Insuficiente) y comentarios mandatorios.
- **Impacto y beneficio:** Evaluaciones entre compañeros estructuradas y consistentes.

### 2.33. Implementación de un hook useDebounce genérico para búsquedas
- **Diagnóstico actual:** El input de búsqueda filtra en cada pulsación de tecla provocando recomputaciones innecesarias.
- **Archivos involucrados:** `src/app/dashboard/users/page.tsx, src/components/dashboard/ui/CommandPalette.tsx`
- **Propuesta técnica:** Crear `useDebounce<T>(value: T, delay: number): T` y aplicarlo a los campos de filtrado.
- **Impacto y beneficio:** Reducción dramática del overhead de CPU al escribir rápido.

### 2.34. Limpieza de dependencias no utilizadas en package.json
- **Diagnóstico actual:** Coexisten bibliotecas redundantes como `nextjs-toast-notify` y `sonner`.
- **Archivos involucrados:** `package.json`
- **Propuesta técnica:** Desinstalar dependencias duplicadas y limpiar imports residuales.
- **Impacto y beneficio:** Menor peso del `node_modules` y menor superficie de vulnerabilidades.

### 2.35. Creación de un Adapter para Moodle Web Services
- **Diagnóstico actual:** Las llamadas REST a Moodle se hacen con URLs concatenadas y parámetros dispersos en el componente.
- **Archivos involucrados:** `src/modules/moodle/services/moodleAdapter.ts`
- **Propuesta técnica:** Crear una clase `MoodleClient` con métodos tipados: `getCourses()`, `getGrades()`, `syncAttendance()`.
- **Impacto y beneficio:** Modularidad y facilidad para simular Moodle en entornos de prueba locales.

### 2.36. Estandarización de respuestas HTTP en Next.js API Routes
- **Diagnóstico actual:** Algunos endpoints devuelven `{ success: true, ... }` y otros `{ data: ..., error: null }`.
- **Archivos involucrados:** `src/app/api/`
- **Propuesta técnica:** Estandarizar un helper `ApiResponse.success(data)` y `ApiResponse.error(message, status)`.
- **Impacto y beneficio:** Formato de respuesta predecible para el cliente y consumidores externos.

### 2.37. Implementación de un hook useClipboard seguro con fallback
- **Diagnóstico actual:** La función actual falla en navegadores sin permisos de portapapeles o contextos no seguros (HTTP local).
- **Archivos involucrados:** `src/lib/clipboard.ts`
- **Propuesta técnica:** Diseñar `useClipboard` con detección de capacidades y fallback a `document.execCommand('copy')` con feedback.
- **Impacto y beneficio:** Copiado infalible en cualquier dispositivo y contexto de red.

### 2.38. Creación de fábrica de datos (Factory Pattern) para perfiles y cursos de prueba
- **Diagnóstico actual:** Los tests y scripts de prueba construyen objetos gigantes a mano con campos hardcodeados.
- **Archivos involucrados:** `tests/factories/`
- **Propuesta técnica:** Implementar `createTestProfile(overrides)` y `createTestCourse(overrides)` con defaults realistas.
- **Impacto y beneficio:** Escritura de pruebas unitarias 5 veces más rápida y legible.

### 2.39. Refactorización del manejo de versiones y comparativa de cronogramas
- **Diagnóstico actual:** La lógica para comparar versiones históricas (`selectedVersionForDiff`) está acoplada al render del cronograma.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Separar el cálculo de diferencias en una utilidad pura `diffScheduleVersions(v1, v2)`.
- **Impacto y beneficio:** Pruebas unitarias de diff precisas sin renderizar la UI.

### 2.40. Tipado estricto de auditoría de calificaciones y cambios docentes
- **Diagnóstico actual:** El objeto `expandedAuditLogs` es `Record<string, any[]>`, perdiendo registro de quién y cuándo modificó una nota.
- **Archivos involucrados:** `src/modules/github/components/AssignmentsPanel.tsx`
- **Propuesta técnica:** Definir interface `GradeAuditLogEntry { editorId: string; oldGrade: string; newGrade: string; timestamp: string; }`.
- **Impacto y beneficio:** Trazabilidad académica irrefutable y tipada.

### 2.41. Encapsulación de lógica de autenticación OAuth en hook useAuthService
- **Diagnóstico actual:** Los flujos de Google, GitHub y credenciales residen dentro del componente visual de login.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Extraer `useAuthService()` con métodos `loginWithGoogle()`, `loginWithGithub()`, `registerWithEmail()`.
- **Impacto y beneficio:** Vista de login ultra limpia y testeable.

### 2.42. Desacoplamiento de Toast Notifications en custom hook useNotification
- **Diagnóstico actual:** Se pasa `showToast` manualmente por props a más de 8 componentes hijos.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Consumir notificaciones mediante un hook `useNotification()` o dispatch global de eventos.
- **Impacto y beneficio:** Eliminación de prop drilling de notificaciones en todo el árbol de componentes.

### 2.43. Implementación de un esquema centralizado de Feature Flags
- **Diagnóstico actual:** Funcionalidades experimentales como peer review o escaneo QR avanzado se activan con condicionales ad-hoc.
- **Archivos involucrados:** `src/lib/featureFlags.ts`
- **Propuesta técnica:** Centralizar un tipado de flags (`enablePeerReview`, `enableMoodleSync`) configurable por entorno.
- **Impacto y beneficio:** Despliegues graduales y pruebas A/B controladas.

### 2.44. Reemplazo de mutaciones directas de arrays por inmutabilidad estricta
- **Diagnóstico actual:** Se encuentran líneas con `updated[idx] = { ...updated[idx] }` que pueden mutar referencias anidadas.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Utilizar utilidades de inmutabilidad o helpers estructurados para actualizar arrays y mapas.
- **Impacto y beneficio:** Eliminación de bugs sutiles donde React no detecta cambios de estado.

### 2.45. Creación de componente AvatarGroup accesible para comisiones y grupos
- **Diagnóstico actual:** Al mostrar miembros de grupos de estudio se renderizan avatares encimados sin contador de desbordamiento ni accesibilidad.
- **Archivos involucrados:** `src/modules/study_groups/components/`
- **Propuesta técnica:** Crear `<AvatarGroup max={4} users={members} />` con tooltip y badge de '+N más'.
- **Impacto y beneficio:** Componente visual elegante y reutilizable en tareas grupales y comisiones.

### 2.46. Normalización de almacenamiento de fechas (ISO 8601 UTC en toda la base de datos)
- **Diagnóstico actual:** Algunos campos guardan `YYYY-MM-DD`, otros `ISO string` con zona horaria local y otros timestamps de Firestore.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx, src/modules/calendar/components/CalendarPanel.tsx`
- **Propuesta técnica:** Estandarizar que toda fecha en Firestore sea UTC ISO 8601 (`toISOString()`) o `Timestamp` nativo.
- **Impacto y beneficio:** Cero desfases de horario en alumnos que cursan desde diferentes husos horarios.

### 2.47. Modularización del panel de administración (AdminPanel)
- **Diagnóstico actual:** Contiene gestión de usuarios, roles, migraciones de materias y logs en un archivo monolítico.
- **Archivos involucrados:** `src/modules/course/components/AdminPanel.tsx`
- **Propuesta técnica:** Separar en subpaneles: `UserManagementTab.tsx`, `CourseMigrationTab.tsx` y `SystemLogsTab.tsx`.
- **Impacto y beneficio:** Mantenimiento sencillo y menor probabilidad de conflictos en git.

### 2.48. Eliminación de selectores de DOM directos (document.getElementById / querySelector)
- **Diagnóstico actual:** Se encuentran accesos directos al DOM del navegador para interactuar con librerías externas.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx`
- **Propuesta técnica:** Reemplazar por referencias seguras de React `useRef<HTMLDivElement>()`.
- **Impacto y beneficio:** Compatibilidad total con el ciclo de vida de React y Server-Side Rendering.

### 2.49. Creación de suite de validadores puros para lógica de negocio de comisiones
- **Diagnóstico actual:** Las validaciones de cupos y cruces de horarios entre comisiones están dispersas.
- **Archivos involucrados:** `src/modules/course/validators/commissions.ts`
- **Propuesta técnica:** Crear funciones puras `validateScheduleOverlap(classA, classB)` y `validateCommissionCapacity(course, comm)`.
- **Impacto y beneficio:** Prevención matemática de superposición de clases en la asignación de horarios.

### 2.50. Revisión de memory leaks en suscripciones de eventos en tiempo real de Firestore
- **Diagnóstico actual:** Asegurar que cada llamada a `onSnapshot()` devuelva su función de desuscripción y sea invocada en el cleanup de `useEffect`.
- **Archivos involucrados:** `src/app/dashboard/page.tsx, src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Garantizar que todo listener de Firestore almacene su callback `unsubscribe` y se ejecute rigurosamente al desmontar el componente.
- **Impacto y beneficio:** Eliminación de fugas de memoria y saturación de conexiones WebSocket en sesiones prolongadas.


## Categoría 3: Backend, Firebase, Cloud Functions y Seguridad (RBAC / Auth / Firestore)

_Seguridad de base de datos, validación estricta en Firestore Rules, modernización de Cloud Functions a TypeScript modular v2, protección de endpoints y auditoría inmutable._

**Total de propuestas en esta categoría:** 50

### 3.01. Migración completa de Cloud Functions a TypeScript
- **Diagnóstico actual:** El backend en Cloud Functions está escrito en JavaScript CommonJS (`require`), sin verificación estática de tipos.
- **Archivos involucrados:** `functions/index.js`
- **Propuesta técnica:** Configurar TypeScript con `tsconfig.json` en `functions/` y migrar a módulos ESM (`import/export`).
- **Impacto y beneficio:** Prevención de errores de ejecución en producción y tipado compartido con el frontend.

### 3.02. Modularización de Cloud Functions por dominio de negocio
- **Diagnóstico actual:** Todas las funciones (auth, moodle, notas, reportes) residen en un solo archivo masivo de más de 500 líneas.
- **Archivos involucrados:** `functions/index.js`
- **Propuesta técnica:** Dividir en carpetas `functions/src/auth/`, `functions/src/moodle/`, `functions/src/github/`, `functions/src/notifications/`.
- **Impacto y beneficio:** Despliegues selectivos de funciones y código infinitamente más claro.

### 3.03. Validación estricta de esquemas en Firestore Security Rules
- **Diagnóstico actual:** Las reglas validan autenticación y pertenencia al curso pero no verifican que los campos requeridos existan ni sus tipos de datos.
- **Archivos involucrados:** `firestore.rules`
- **Propuesta técnica:** Agregar funciones de validación como `request.resource.data.text is string && request.resource.data.text.size() < 2000`.
- **Impacto y beneficio:** Imposibilidad de que clientes maliciosos inyecten documentos corruptos o sobrecargados.

### 3.04. Prevención de escalamiento de privilegios en perfiles de usuario
- **Diagnóstico actual:** Un usuario autenticado podría intentar enviar un `update` cambiando su propio campo `role` a `'admin'` si las reglas no lo impiden expresamente.
- **Archivos involucrados:** `firestore.rules`
- **Propuesta técnica:** Asegurar en `profiles/{userId}` que `request.resource.data.role == resource.data.role` en toda actualización permitida.
- **Impacto y beneficio:** Integridad absoluta de los roles de usuario y permisos.

### 3.05. Implementación de Rate Limiting en Cloud Functions invocables
- **Diagnóstico actual:** No existe protección contra ataques de fuerza bruta o saturación sobre funciones como validación de matrículas o creación de tareas.
- **Archivos involucrados:** `functions/src/middleware/rateLimit.js`
- **Propuesta técnica:** Integrar un middleware con Redis o Firestore / Token Bucket que limite a un máximo de N peticiones por minuto por IP/UID.
- **Impacto y beneficio:** Protección contra abusos y control estricto de costos en la facturación de Firebase.

### 3.06. Rotación y protección segura de secretos con Google Secret Manager
- **Diagnóstico actual:** Secretos como el token de bot de GitHub y tokens de Moodle se cargan desde variables de entorno planas en Functions.
- **Archivos involucrados:** `functions/index.js, .env`
- **Propuesta técnica:** Utilizar `defineSecret` de Firebase Functions v2 y Google Cloud Secret Manager.
- **Impacto y beneficio:** Almacenamiento seguro, encriptado y con auditoría de acceso de claves maestras.

### 3.07. Migración de Cloud Functions v1 a Firebase Functions v2
- **Diagnóstico actual:** El proyecto utiliza `firebase-functions` con APIs de primera generación (Gen 1).
- **Archivos involucrados:** `functions/package.json, functions/index.js`
- **Propuesta técnica:** Actualizar a Firebase Functions v2 (`onRequest`, `onCall`, `onDocumentWritten`) con soporte de concurrencia y menor latencia.
- **Impacto y beneficio:** Cold starts reducidos drásticamente y mejor escalabilidad ante picos de uso.

### 3.08. Idempotencia estricta en Webhooks de GitHub
- **Diagnóstico actual:** Si GitHub reintenta un webhook de 'push' o 'pull_request' por timeout de red, se podrían duplicar registros de entregas.
- **Archivos involucrados:** `src/app/api/cli/, functions/src/github/`
- **Propuesta técnica:** Almacenar el `X-GitHub-Delivery` ID en una colección `processed_webhooks` y descartar entregas ya procesadas.
- **Impacto y beneficio:** Garantía de que cada commit o PR se procesa exactamente una vez.

### 3.09. Sanitización rigurosa de entradas en Cloud Functions para evitar NoSQL Injection
- **Diagnóstico actual:** Los parámetros de búsqueda se pasan a consultas de Firestore sin sanitizar caracteres especiales.
- **Archivos involucrados:** `functions/src/moodle/sync.js`
- **Propuesta técnica:** Validar y limpiar strings antes de armar queries compuestas.
- **Impacto y beneficio:** Seguridad defensiva profunda contra inyecciones NoSQL.

### 3.10. Implementación de auditoría inmutable (Audit Log) de cambios de calificaciones
- **Diagnóstico actual:** Cuando un docente modifica una nota, solo se sobreescribe el documento sin dejar historial inmutable.
- **Archivos involucrados:** `functions/src/grades/audit.js`
- **Propuesta técnica:** Crear un trigger `onDocumentUpdated` sobre entregas que guarde un log de auditoría en una subcolección protegida de solo lectura.
- **Impacto y beneficio:** Respaldo legal y transparencia absoluta en reclamos de exámenes.

### 3.11. Restricción de CORS estricta en endpoints de Next.js API y Cloud Functions
- **Diagnóstico actual:** Las rutas admiten CORS permisivo o encabezados genéricos `*`.
- **Archivos involucrados:** `src/app/api/lti/route.ts, functions/index.js`
- **Propuesta técnica:** Configurar una lista blanca estricta que solo permita orígenes de la universidad (`https://moodle.unrn.edu.ar`) y el dominio de Dojo.
- **Impacto y beneficio:** Protección contra ataques CSRF y Cross-Origin Data Leaks.

### 3.12. Implementación de LTI 1.3 Advantage con OAuth 2.0 y firma asimétrica JWT (RS256)
- **Diagnóstico actual:** La integración actual de Moodle utiliza llamadas REST directas con wstoken o LTI legado.
- **Archivos involucrados:** `src/app/api/lti/route.ts`
- **Propuesta técnica:** Adoptar el estándar oficial IMS LTI 1.3 con intercambio de claves JWKS y Deep Linking.
- **Impacto y beneficio:** Compatibilidad estándar con cualquier plataforma de campus virtual moderno.

### 3.13. Cifrado de tokens de Moodle y GitHub en reposo en Firestore
- **Diagnóstico actual:** Los tokens de acceso personales se guardan en texto plano en la colección de configuraciones.
- **Archivos involucrados:** `firestore.rules, functions/src/crypto.js`
- **Propuesta técnica:** Cifrar los tokens usando AES-256-GCM con una llave maestra en Secret Manager antes de persistirlos.
- **Impacto y beneficio:** Inmunidad ante filtraciones accidentales de la base de datos.

### 3.14. Reglas de Firestore para foros: alumnos solo pueden editar/borrar sus propios mensajes
- **Diagnóstico actual:** Verificar que en la colección de comentarios solo el autor original pueda actualizar el texto de su duda.
- **Archivos involucrados:** `firestore.rules`
- **Propuesta técnica:** Agregar regla: `allow update, delete: if signedIn() && (resource.data.user_id == request.auth.uid || isAdmin() || isTeacherOf(courseId))`.
- **Impacto y beneficio:** Gobernanza comunitaria y respeto entre estudiantes en foros.

### 3.15. Verificación de firma HMAC en Webhooks de GitHub
- **Diagnóstico actual:** Cualquier cliente que conozca la URL del endpoint de webhook de GitHub podría enviar payloads falsos simulando entregas.
- **Archivos involucrados:** `src/app/api/github/webhook/route.ts`
- **Propuesta técnica:** Validar el encabezado `X-Hub-Signature-256` calculando el hash HMAC con el secret configurado.
- **Impacto y beneficio:** Autenticidad absoluta de las actividades de repositorios recibidas.

### 3.16. Procesamiento en segundo plano de exportaciones masivas con Cloud Tasks
- **Diagnóstico actual:** Generar un reporte en PDF de un curso de 150 alumnos puede sobrepasar el timeout HTTP de Next.js (15s).
- **Archivos involucrados:** `src/app/api/export/route.ts`
- **Propuesta técnica:** Delegar la generación pesada a una Cloud Task en segundo plano que envíe el enlace de descarga por email al docente.
- **Impacto y beneficio:** Cero caídas por timeouts en operaciones de reportería complejas.

### 3.17. Limpieza automática de tokens de asistencia QR vencidos mediante TTL en Firestore
- **Diagnóstico actual:** Los códigos QR de asistencia caducan a los pocos minutos, pero sus documentos quedan en la base de datos para siempre.
- **Archivos involucrados:** `firestore.rules, functions/src/attendance/`
- **Propuesta técnica:** Habilitar la directiva Time-to-Live (TTL) de Cloud Firestore en el campo `expire_at` para borrado automático sin costo.
- **Impacto y beneficio:** Base de datos limpia y menor volumen de almacenamiento cobrable.

### 3.18. Protección contra ataques de repetición (Replay Attacks) en validación de asistencia
- **Diagnóstico actual:** Un alumno podría compartir una captura de pantalla del código QR con un compañero que no está en el aula.
- **Archivos involucrados:** `functions/src/attendance/validate.js`
- **Propuesta técnica:** Generar tokens QR dinámicos rotativos cada 15 segundos basados en TOTP vinculado a la sesión del proyector del docente.
- **Impacto y beneficio:** Garantía de presencialidad real en el aula.

### 3.19. Sincronización bidireccional asíncrona de notas con Moodle Gradebook
- **Diagnóstico actual:** Al calificar en Dojo, el docente debe recordar presionar sincronizar con Moodle.
- **Archivos involucrados:** `functions/src/moodle/syncGrades.js`
- **Propuesta técnica:** Crear un trigger que ante la asignación de una nota válida (`grade >= 0`) encole la sincronización automática con el libro de calificaciones de Moodle.
- **Impacto y beneficio:** Sincronización transparente sin intervención manual.

### 3.20. Validación de dominios de correo institucional en el registro
- **Diagnóstico actual:** Cualquier usuario con una cuenta personal de Gmail puede intentar registrarse en la plataforma.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx, functions/src/auth/validateEmail.js`
- **Propuesta técnica:** Forzar en Firebase Auth Blocking Functions (Before User Created) que el correo termine en `@unrn.edu.ar` o dominio autorizado.
- **Impacto y beneficio:** Acceso restringido exclusivamente a la comunidad universitaria oficial.

### 3.21. Implementación de Soft Deletes (Borrado Lógico) para materias y cursos
- **Diagnóstico actual:** Eliminar un curso borra documentos en cascada de forma destructiva e irreversible.
- **Archivos involucrados:** `firestore.rules, functions/src/courses/`
- **Propuesta técnica:** Marcar cursos con `deleted_at: Timestamp` y filtrar en consultas activas, permitiendo restauración ante accidentes.
- **Impacto y beneficio:** Seguridad contra pérdidas catastróficas de información de cursadas.

### 3.22. Respaldos automáticos programados diarios de Cloud Firestore
- **Diagnóstico actual:** No se observa configuración explícita de exportación periódica automatizada de toda la base de datos a Cloud Storage.
- **Archivos involucrados:** `functions/src/maintenance/backup.js`
- **Propuesta técnica:** Configurar una Cloud Function con Cloud Scheduler (cron diario) que invoque `gcloud firestore export` a un bucket seguro.
- **Impacto y beneficio:** Recuperación ante desastres (Disaster Recovery) con RPO de 24 horas.

### 3.23. Migración de consultas 'In-Memory' a Queries indexadas compuestas en Firestore
- **Diagnóstico actual:** Se descarga el roster completo y luego se filtra en JavaScript en el navegador del cliente.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Diseñar índices compuestos en Firestore para consultar directamente `where('status', '==', 'submitted').where('grade', '==', null)`.
- **Impacto y beneficio:** Ahorro de miles de lecturas de Firestore por sesión y carga instantánea.

### 3.24. Validación estricta de estructura en creación de tareas docentes
- **Diagnóstico actual:** Un docente podría crear accidentalmente tareas con fechas de entrega anteriores a la fecha de inicio.
- **Archivos involucrados:** `functions/src/assignments/create.js`
- **Propuesta técnica:** Validar en backend que `due_date > start_date` y que el repositorio plantilla tenga formato válido `org/repo`.
- **Impacto y beneficio:** Datos consistentes y libres de contradicciones temporales.

### 3.25. Notificaciones Push automáticas para consultas resueltas en foros
- **Diagnóstico actual:** Cuando un docente marca una respuesta como 'Solución definitiva', el alumno no se entera a menos que ingrese a la app.
- **Archivos involucrados:** `functions/src/notifications/forum.js`
- **Propuesta técnica:** Enviar notificación Web Push o email automático notificando al estudiante que su duda fue resuelta.
- **Impacto y beneficio:** Disminución de la ansiedad estudiantil y retroalimentación veloz.

### 3.26. Gestión de transacciones de Firestore para conteos concurrentes de XP
- **Diagnóstico actual:** Si un estudiante recibe múltiples puntos concurrentes, escrituras paralelas pueden sobreescribir el XP acumulado.
- **Archivos involucrados:** `functions/src/gamification/addXp.js`
- **Propuesta técnica:** Utilizar `runTransaction` o `FieldValue.increment(points)` nativo de Firestore para actualizaciones atómicas.
- **Impacto y beneficio:** Conteo de experiencia matemático e incorruptible.

### 3.27. Bloqueo de cuentas tras N intentos fallidos de contraseña
- **Diagnóstico actual:** Firebase Auth estándar no bloquea temporalmente usuarios tras múltiples intentos erróneos.
- **Archivos involucrados:** `functions/src/auth/bruteForceProtection.js`
- **Propuesta técnica:** Implementar contador en Firestore con bloqueo temporal de 15 minutos tras 5 intentos fallidos consecutivos.
- **Impacto y beneficio:** Resguardo contra ataques automatizados de diccionario.

### 3.28. Manejo de estados de suscripción con Firebase Emulators en CI y local
- **Diagnóstico actual:** La configuración del emulador depende de scripts manuales y versiones específicas de Java.
- **Archivos involucrados:** `tests/firestore.rules.test.js`
- **Propuesta técnica:** Crear un contenedor Docker estandarizado para los emuladores de Firebase local.
- **Impacto y beneficio:** Entorno de pruebas idéntico en las computadoras de todos los colaboradores.

### 3.29. Desconexión y revocación automática de sesiones ante cambio de contraseña
- **Diagnóstico actual:** Si un usuario cambia su contraseña, las sesiones abiertas en otros navegadores o dispositivos pueden permanecer activas.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Invocar `admin.auth().revokeRefreshTokens(uid)` en el backend tras el reseteo de clave.
- **Impacto y beneficio:** Cierre de brechas de seguridad ante cuentas comprometidas.

### 3.30. Sanitización de nombres de archivo y tipos MIME en subida de adjuntos
- **Diagnóstico actual:** Alumnos podrían subir scripts maliciosos camuflados como PDFs o imágenes en entregas.
- **Archivos involucrados:** `functions/src/storage/validateUpload.js`
- **Propuesta técnica:** Validar con `file-type` (magic bytes) en Cloud Storage triggers y renombrar con UUIDs no ejecutables.
- **Impacto y beneficio:** Prevención absoluta de ejecución remota de código (RCE).

### 3.31. Configuración de alertas de presupuesto y consumo anómalo en Google Cloud
- **Diagnóstico actual:** Un bucle infinito de lecturas en un useEffect podría generar costos no deseados en Firestore.
- **Archivos involucrados:** `firebase.json`
- **Propuesta técnica:** Configurar alertas de presupuesto en Google Cloud Billing que notifiquen ante desvíos del consumo habitual.
- **Impacto y beneficio:** Protección financiera y detección inmediata de bucles de consulta.

### 3.32. Generación de URLs firmadas (Signed URLs) con tiempo de expiración para entregas
- **Diagnóstico actual:** Los enlaces de descarga de correcciones pueden quedar públicos si no se controlan los accesos.
- **Archivos involucrados:** `functions/src/storage/signedUrls.js`
- **Propuesta técnica:** Servir archivos privados mediante URLs firmadas con expiración máxima de 15 minutos.
- **Impacto y beneficio:** Privacidad rigurosa de los exámenes y retroalimentaciones de los estudiantes.

### 3.33. Estandarización de códigos de error semánticos en el backend
- **Diagnóstico actual:** Las funciones devuelven mensajes de error planos como 'Error processing request' en lugar de códigos estructurados.
- **Archivos involucrados:** `functions/src/errors/codes.js`
- **Propuesta técnica:** Crear diccionario de errores: `AUTH_INVALID_TOKEN`, `COURSE_NOT_FOUND`, `ASSIGNMENT_PAST_DUE`.
- **Impacto y beneficio:** El frontend puede reaccionar y mostrar mensajes localizados amigables.

### 3.34. Gestión de roles con Custom Claims de Firebase Auth en lugar de lecturas de Firestore
- **Diagnóstico actual:** Actualmente cada verificación de rol en `firestore.rules` hace una lectura `get()` al documento `profiles/{uid}`.
- **Archivos involucrados:** `functions/src/auth/setClaims.js, firestore.rules`
- **Propuesta técnica:** Configurar Custom Claims (`role: 'teacher' | 'student' | 'admin'`) en el token JWT del usuario.
- **Impacto y beneficio:** Ahorro masivo de lecturas en Firestore y reglas de seguridad 10 veces más rápidas.

### 3.35. Migración de almacenamiento de sesiones de Selenium a Firestore Mock local
- **Diagnóstico actual:** Los tests E2E usan credenciales reales contra proyectos en la nube que ensucian datos.
- **Archivos involucrados:** `tests/selenium/run-all-tests.js`
- **Propuesta técnica:** Configurar los tests para apuntar exclusivamente al emulador de Firestore con datos de seed.
- **Impacto y beneficio:** Pruebas end-to-end repetibles, deterministas y sin costos de nube.

### 3.36. Separación de entornos de Firestore (dev, staging, prod)
- **Diagnóstico actual:** El proyecto apunta directamente a un entorno único con riesgo de alterar datos productivos durante pruebas.
- **Archivos involucrados:** `.firebaserc`
- **Propuesta técnica:** Configurar targets en `.firebaserc`: `dojo-dev`, `dojo-staging` y `dojo-prod`.
- **Impacto y beneficio:** Aislamiento riguroso de datos de cursadas activas.

### 3.37. Verificación de integridad de checksums en sincronizaciones masivas de alumnos
- **Diagnóstico actual:** Sincronizar el padrón de alumnos de Moodle sobreescribe registros sin detectar si hubo cambios reales.
- **Archivos involucrados:** `functions/src/moodle/syncRoster.js`
- **Propuesta técnica:** Calcular hash SHA-256 del padrón y sincronizar únicamente si el hash difiere del último registro guardado.
- **Impacto y beneficio:** Ahorro de procesamiento y lecturas innecesarias en la base de datos.

### 3.38. Implementación de Webhook Dead Letter Queue (DLQ) para eventos fallidos
- **Diagnóstico actual:** Si una función falla al procesar una entrega de GitHub por caída momentánea de red, el evento se pierde.
- **Archivos involucrados:** `functions/src/queues/dlq.js`
- **Propuesta técnica:** Reenviar eventos fallidos a una cola Pub/Sub Dead Letter para reintento automático con backoff exponencial.
- **Impacto y beneficio:** Cero pérdida de entregas de estudiantes.

### 3.39. Manejo granular de permisos para Ayudantes de Cátedra (Teaching Assistants)
- **Diagnóstico actual:** Los ayudantes de cátedra requieren corregir tareas pero no deberían poder eliminar comisiones ni borrar materias.
- **Archivos involucrados:** `firestore.rules`
- **Propuesta técnica:** Crear rol intermedio `assistant` con permisos de lectura/calificación pero sin privilegios destructivos.
- **Impacto y beneficio:** Gobernanza académica segura y delegación de tareas sin riesgos.

### 3.40. Indexación automática de búsquedas con Algolia o Typesense
- **Diagnóstico actual:** La búsqueda en Firestore no soporta texto completo (Full-Text Search) ni tolerancia a errores tipográficos.
- **Archivos involucrados:** `functions/src/search/index.js`
- **Propuesta técnica:** Sincronizar documentos de tareas y alumnos con un motor de búsqueda indexado mediante triggers.
- **Impacto y beneficio:** Búsqueda instantánea de alumnos por coincidencia fonética o errores ortográficos comunes.

### 3.41. Validación de integridad de calificaciones numéricas en el servidor
- **Diagnóstico actual:** Un cliente alterado podría enviar calificaciones con valores ilógicos como `15` o números negativos.
- **Archivos involucrados:** `functions/src/grades/validate.js`
- **Propuesta técnica:** Asegurar en backend que `0 <= grade <= 10` y normalizar formatos con comas/puntos decimales.
- **Impacto y beneficio:** Imposibilidad de guardar notas inválidas en los registros oficiales.

### 3.42. Detección y alerta de plagio entre repositorios de alumnos en entregas de código
- **Diagnóstico actual:** Los docentes deben clonar y comparar manualmente trabajos prácticos sospechosos de copia.
- **Archivos involucrados:** `functions/src/github/plagiarism.js`
- **Propuesta técnica:** Integrar un analizador de similitud sintáctica (AST similarity) que alerte si dos entregas superan el 85% de coincidencia estructural.
- **Impacto y beneficio:** Defensa activa de la honestidad académica en carreras de informática.

### 3.43. Implementación de un sistema de suscripción Webhook saliente para sistemas universitarios (SIU Guaraní)
- **Diagnóstico actual:** Las actas de cierre de cursada deben transcribirse a mano al sistema universitario central.
- **Archivos involucrados:** `functions/src/integrations/siu.js`
- **Propuesta técnica:** Exponer un endpoint seguro con autenticación mTLS que emita el acta de regularidades en formato JSON para el SIU.
- **Impacto y beneficio:** Eliminación de errores humanos en la transcripción de notas finales.

### 3.44. Registro de User-Agent e IP en inicios de sesión para detección de anomalías
- **Diagnóstico actual:** No hay registro de auditoría de sesiones para detectar inicios de sesión concurrentes desde ubicaciones dispares.
- **Archivos involucrados:** `functions/src/auth/auditLogin.js`
- **Propuesta técnica:** Guardar metadata básica de inicio de sesión en un historial de seguridad accesible por el alumno en 'Mi Perfil'.
- **Impacto y beneficio:** Detección inmediata de cuentas compartidas o comprometidas.

### 3.45. Protección de endpoints contra ataques DDoS mediante Cloudflare o Firebase App Check
- **Diagnóstico actual:** Cualquier script externo puede consumir endpoints de Next.js sin verificar si el cliente es la app oficial.
- **Archivos involucrados:** `src/app/layout.tsx, firebase.json`
- **Propuesta técnica:** Habilitar Firebase App Check con reCAPTCHA Enterprise o Play Integrity.
- **Impacto y beneficio:** Bloqueo automático de tráfico malicioso y bots no autorizados.

### 3.46. Optimización del tamaño de payloads en funciones de listado masivo
- **Diagnóstico actual:** Se devuelven campos innecesarios como configuraciones de perfil internas en listados públicos de clase.
- **Archivos involucrados:** `functions/src/roster/get.js`
- **Propuesta técnica:** Proyectar únicamente campos requeridos (`id`, `full_name`, `email`, `matricula`).
- **Impacto y beneficio:** Respuestas API 70% más livianas y menor latencia en conexiones móviles.

### 3.47. Limpieza de entregas huérfanas al desvincular o eliminar una tarea
- **Diagnóstico actual:** Si una tarea se elimina, los documentos de entrega de los alumnos quedan como datos basura en Firestore.
- **Archivos involucrados:** `functions/src/assignments/cleanup.js`
- **Propuesta técnica:** Trigger `onDocumentDeleted` que limpie automáticamente las entregas y comentarios asociados.
- **Impacto y beneficio:** Higiene total de la base de datos sin acumulación de datos obsoletos.

### 3.48. Validación de estado del estudiante en Moodle antes de permitir entregas
- **Diagnóstico actual:** Un alumno dado de baja en el sistema universitario podría continuar enviando tareas en Dojo.
- **Archivos involucrados:** `functions/src/students/validateEnrollment.js`
- **Propuesta técnica:** Verificar estado de matriculación activa con la API de Moodle antes de registrar recepciones de TP.
- **Impacto y beneficio:** Alineación perfecta con los padrones oficiales de la facultad.

### 3.49. Auditoría de cumplimiento GDPR / Ley de Protección de Datos Personales
- **Diagnóstico actual:** No existe una función que permita al estudiante descargar todos sus datos o solicitar borrado de cuenta.
- **Archivos involucrados:** `functions/src/privacy/exportData.js`
- **Propuesta técnica:** Implementar endpoint `exportUserData` que emita un archivo `.zip` con todos sus aportes y calificaciones.
- **Impacto y beneficio:** Cumplimiento ético y legal de normativas de privacidad de datos.

### 3.50. Healthcheck Endpoint profundo para monitoreo de estado del sistema
- **Diagnóstico actual:** No existe un endpoint que verifique la conectividad en tiempo real entre Next.js, Firestore y GitHub API.
- **Archivos involucrados:** `src/app/api/health/route.ts`
- **Propuesta técnica:** Crear `/api/health` que compruebe lectura de Firestore, latencia de red y responda estado 200/503 con diagnóstico.
- **Impacto y beneficio:** Monitoreo proactivo con Uptime Kuma o Pingdom para alertar antes de que los alumnos noten caídas.


## Categoría 4: Rendimiento, Optimización y Web Vitals (Core Web Vitals)

_Optimización de tiempos de carga, reducción de bundle JS, virtualización de listas extensas, estrategias avanzadas de cache, minimización de CLS/LCP y renderizado eficiente._

**Total de propuestas en esta categoría:** 50

### 4.01. Implementación de Virtualización de listas en el Roster de alumnos
- **Diagnóstico actual:** Cursos con más de 100 alumnos montan cientos de nodos DOM para la tabla, ralentizando el scroll y la renderización inicial.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Integrar `@tanstack/react-virtual` para renderizar únicamente las filas visibles en pantalla.
- **Impacto y beneficio:** Reducción del 80% en nodos DOM y renderizado instantáneo a 60 FPS.

### 4.02. Carga diferida (Dynamic Imports con next/dynamic) de paneles secundarios
- **Diagnóstico actual:** Todos los módulos (`AdminPanel`, `EmailManagementPanel`, `MoodleIntegrationPanel`) se importan en el bundle inicial del Dashboard.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Cargar los paneles mediante `dynamic(() => import(...), { ssr: false })` bajo demanda según la pestaña activa.
- **Impacto y beneficio:** Reducción de más de 150 KB en el JavaScript inicial y mejora drástica del Total Blocking Time (TBT).

### 4.03. Optimización de fuentes con next/font y font-display: swap
- **Diagnóstico actual:** Las fuentes se cargan mediante enlaces externos o declaraciones CSS que pueden provocar Flash of Invisible Text (FOIT).
- **Archivos involucrados:** `src/app/layout.tsx, src/app/globals.css`
- **Propuesta técnica:** Utilizar `next/font/google` para hospedar y precargar automáticamente las fuentes con tamaño optimizado.
- **Impacto y beneficio:** Eliminación de saltos de texto y mejora del Largest Contentful Paint (LCP).

### 4.04. Virtualización de hilos de comentarios con gran volumen de respuestas
- **Diagnóstico actual:** Clases con debates intensos generan más de 80 comentarios con Markdown que degradan la interactividad.
- **Archivos involucrados:** `src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Virtualizar la lista de comentarios renderizando en bloques de 15 elementos con carga infinita suave.
- **Impacto y beneficio:** Desplazamiento fluido y tiempo de respuesta inmediato al tipear nuevas consultas.

### 4.05. Memoización estricta de selectores derivados en el Dashboard principal
- **Diagnóstico actual:** Cualquier cambio de estado local en el Dashboard fuerza re-renders en cascada de todos los subpaneles.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Envolver componentes pesados en `React.memo` con comparadores de props precisos.
- **Impacto y beneficio:** Aislamiento de renders y eliminación de computación redundante de la CPU.

### 4.06. Debounce en entradas de búsqueda para reducir cálculos de filtrado
- **Diagnóstico actual:** Filtrar arreglos en cada `onChange` dispara cálculos por cada letra escrita provocando pequeños congelamientos visuales.
- **Archivos involucrados:** `src/app/dashboard/users/page.tsx, src/components/dashboard/ui/CommandPalette.tsx`
- **Propuesta técnica:** Aplicar un debounce de 250ms a las búsquedas incrementales.
- **Impacto y beneficio:** Experiencia de escritura fluida y libre de lag en equipos de bajos recursos.

### 4.07. Compresión de payloads de Firestore con persistencia offline optimizada
- **Diagnóstico actual:** La persistencia en IndexedDB puede acumular megabytes de snapshots obsoletos a lo largo de las semanas.
- **Archivos involucrados:** `src/lib/firebase/clientApp.ts`
- **Propuesta técnica:** Configurar `persistentMultipleTabManager` con límites de cache de 50 MB en la inicialización de Firestore.
- **Impacto y beneficio:** Arranque ultrarrápido y control del almacenamiento local del navegador.

### 4.08. Eliminación de Polyfills redundantes en el bundle del cliente
- **Diagnóstico actual:** Se incluyen dependencias y polyfills de ES5/ES6 innecesarios para navegadores modernos.
- **Archivos involucrados:** `package.json`
- **Propuesta técnica:** Configurar browserslist enfocado en navegadores perennes (últimas 2 versiones de Chrome, Firefox, Safari, Edge).
- **Impacto y beneficio:** Bundle JS más limpio y eliminación de código muerto.

### 4.09. Optimización del paquete Marked mediante importación selectiva
- **Diagnóstico actual:** Importar la biblioteca `marked` completa sin configuración de extensiones pesadas puede inflar el bundle.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Utilizar una instancia ligera de `marked` configurando únicamente el lexer y parser básico necesario.
- **Impacto y beneficio:** Disminución del tamaño del chunk de visualización de consignas.

### 4.10. Reducción del Cumulative Layout Shift (CLS) en el avatar de usuario
- **Diagnóstico actual:** Las imágenes de perfil no declaran `width` ni `height` fijos, provocando saltos de página al terminar de descargar la foto.
- **Archivos involucrados:** `src/app/dashboard/components/Sidebar.tsx`
- **Propuesta técnica:** Declarar dimensiones explícitas `width={40} height={40}` o contenedores con `aspect-ratio: 1/1`.
- **Impacto y beneficio:** Puntaje de CLS cercano a 0 (criterio verde en Core Web Vitals).

### 4.11. Adopción de formato AVIF y WebP para iconos e ilustraciones del Dojo
- **Diagnóstico actual:** Algunos assets visuales están en formatos PNG o SVG pesados no optimizados.
- **Archivos involucrados:** `public/assets/`
- **Propuesta técnica:** Convertir imágenes estáticas a WebP/AVIF comprimido sin pérdida visual.
- **Impacto y beneficio:** Carga visual instantánea incluso en conexiones 3G en las aulas de la facultad.

### 4.12. Uso de Lucide React o SVGs inline optimizados con SVGO en lugar de emojis pesados o librerías de iconos completas
- **Diagnóstico actual:** Se mezclan emojis nativos (que varían según el sistema operativo) e iconos sin optimizar.
- **Archivos involucrados:** `src/components/`
- **Propuesta técnica:** Adoptar una colección limpia de SVGs optimizados con SVGO con `aria-hidden='true'`.
- **Impacto y beneficio:** Consistencia visual idéntica en Windows, Mac, Linux, iOS y Android.

### 4.13. Estrategia Stale-While-Revalidate (SWR) para consultas no críticas
- **Diagnóstico actual:** El calendario vuelve a solicitar eventos cada vez que el alumno cambia de pestaña.
- **Archivos involucrados:** `src/modules/calendar/components/CalendarPanel.tsx`
- **Propuesta técnica:** Integrar `swr` o `@tanstack/react-query` para servir datos instantáneamente de memoria mientras se actualizan en background.
- **Impacto y beneficio:** Navegación instantánea con cero parpadeos entre pantallas.

### 4.14. Precarga predictiva (Prefetching) de pestañas contiguas al pasar el cursor (hover)
- **Diagnóstico actual:** El módulo de tareas solo se descarga cuando el usuario hace clic en la pestaña.
- **Archivos involucrados:** `src/app/dashboard/components/Sidebar.tsx`
- **Propuesta técnica:** Disparar la precarga del chunk al hacer hover sobre el botón de navegación del Sidebar.
- **Impacto y beneficio:** Apertura inmediata del panel al presionar el botón.

### 4.15. Desactivación de animaciones pesadas para usuarios con prefers-reduced-motion
- **Diagnóstico actual:** Las animaciones de desvanecimiento y pulso pueden provocar mareo o ralentizar equipos modestos.
- **Archivos involucrados:** `src/app/globals.css`
- **Propuesta técnica:** Añadir `@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`.
- **Impacto y beneficio:** Inclusión para personas con trastornos vestibulares y mejora de rendimiento en hardware modesto.

### 4.16. Optimización del tamaño del CSS eliminando selectores arbitrarios redundantes
- **Diagnóstico actual:** Existen clases ad-hoc como `bg-neutral-855`, `text-gray-550`, `bg-amber-955` que Tailwind debe generar como reglas sueltas.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Estandarizar las clases a la escala nativa de Tailwind (`neutral-800`, `neutral-900`, `amber-900`).
- **Impacto y beneficio:** Hoja de estilos CSS final más liviana y cacheable.

### 4.17. Uso de transform y opacity para todas las animaciones CSS en lugar de top/left/height
- **Diagnóstico actual:** Animar alturas o márgenes provoca repintados completos de la página (Reflow/Layout shift).
- **Archivos involucrados:** `src/app/globals.css`
- **Propuesta técnica:** Restringir animaciones a `transform: translate()` y `opacity`, ejecutadas directamente en la GPU.
- **Impacto y beneficio:** Animaciones fluidas y sin caídas de frames.

### 4.18. Optimización de los listeners de scroll en el Dashboard
- **Diagnóstico actual:** Los listeners de scroll para detectar la cabecera fija se ejecutan en cada pixel desplazado.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Envolver el detector con `requestAnimationFrame` o la API `IntersectionObserver`.
- **Impacto y beneficio:** Scroll sedoso sin saturar el bucle de eventos del hilo principal.

### 4.19. Cache de respuestas LTI para lanzamientos repetidos de un mismo usuario
- **Diagnóstico actual:** Moodle envía el payload LTI completo cada vez que el alumno entra a la actividad, forzando revalidaciones de base de datos.
- **Archivos involucrados:** `src/app/api/lti/route.ts`
- **Propuesta técnica:** Guardar en memoria temporal la sesión LTI validada durante 10 minutos.
- **Impacto y beneficio:** Ingreso a Dojo desde Moodle en menos de 200ms.

### 4.20. Compresión Gzip / Brotli automática en rutas de exportación
- **Diagnóstico actual:** Los CSVs de historial de asistencia de cursos grandes se transmiten en texto plano sin comprimir.
- **Archivos involucrados:** `src/app/api/export/route.ts`
- **Propuesta técnica:** Habilitar compresión Brotli en las respuestas de la API de Next.js.
- **Impacto y beneficio:** Descarga de reportes hasta un 85% más rápida.

### 4.21. Virtualización de la cuadrícula de comisiones en CourseSettingsPanel
- **Diagnóstico actual:** Materias con 12 comisiones y decenas de horarios saturan la interfaz con inputs interactivos simultáneos.
- **Archivos involucrados:** `src/modules/course/components/CourseSettingsPanel.tsx`
- **Propuesta técnica:** Renderizar comisiones de forma perezosa a medida que se expanden.
- **Impacto y beneficio:** Panel de configuración ágil y liviano.

### 4.22. Eliminación de Date Object Churn en CommitVisualizer
- **Diagnóstico actual:** Se instanciaban objetos `new Date()` repetidamente en cada render del árbol de commits.
- **Archivos involucrados:** `src/modules/github/components/CommitVisualizer.tsx`
- **Propuesta técnica:** Transformar las fechas una sola vez al recibir los datos de la API de GitHub.
- **Impacto y beneficio:** Menor presión sobre el Garbage Collector del navegador.

### 4.23. Configuración de Cache-Control headers agresivos para assets estáticos en Firebase App Hosting
- **Diagnóstico actual:** Archivos CSS y fuentes pueden no tener directivas de cache inmutable de 1 año (`max-age=31536000, immutable`).
- **Archivos involucrados:** `firebase.json`
- **Propuesta técnica:** Definir headers de cache inmutables para `/_next/static/**` en `firebase.json`.
- **Impacto y beneficio:** Visitas recurrentes cargan casi el 100% de la interfaz desde el cache del navegador.

### 4.24. Desaceleración de polling de fondo en pestañas inactivas (Page Visibility API)
- **Diagnóstico actual:** Si el alumno tiene Dojo abierto de fondo mientras programa en su IDE, los listeners continúan procesando actividad al mismo ritmo.
- **Archivos involucrados:** `src/modules/course/components/comments/ClassCommentsThread.tsx`
- **Propuesta técnica:** Detectar `document.hidden` y pausar o ralentizar comprobaciones periódicas no urgentes.
- **Impacto y beneficio:** Ahorro de batería en laptops de estudiantes en el aula.

### 4.25. Tree Shaking exhaustivo de librerías de fecha y utilidades
- **Diagnóstico actual:** Garantizar que no se importen bibliotecas de fechas completas pesadas (Moment.js, Date-fns sin modular).
- **Archivos involucrados:** `package.json, src/lib/dates.ts`
- **Propuesta técnica:** Mantener el uso exclusivo de `Intl` nativo de JavaScript que pesa 0 KB en el bundle.
- **Impacto y beneficio:** Bundle JS ultraligero y velocidad de parsing inmejorable.

### 4.26. Uso de content-visibility: auto para secciones fuera de pantalla
- **Diagnóstico actual:** El navegador calcula el estilo y maquetación de las 30 semanas de clase aunque estén fuera del viewport.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Aplicar `content-visibility: auto` y `contain-intrinsic-size` a los bloques de semanas no visibles.
- **Impacto y beneficio:** Tiempo de renderizado inicial del cronograma reducido a una fracción de segundo.

### 4.27. Lazy Loading de la biblioteca Html5Qrcode en el módulo de asistencia
- **Diagnóstico actual:** La biblioteca de escaneo de QR pesa más de 50 KB y se incluía en el código principal aunque el alumno no abra la cámara.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx`
- **Propuesta técnica:** Cargar `html5-qrcode` mediante `import('html5-qrcode')` dinámicamente solo cuando se abre el modal.
- **Impacto y beneficio:** Ahorro inmediato de peso en la carga inicial del alumno.

### 4.28. Optimización del Command Palette con almacenamiento en Trie o Map estructurado
- **Diagnóstico actual:** La búsqueda lineal por subcadenas recorre todo el historial de clases y tareas en cada pulsación.
- **Archivos involucrados:** `src/components/dashboard/ui/CommandPalette.tsx`
- **Propuesta técnica:** Pre-computar índices de búsqueda por prefijo (Trie) o Maps de acceso O(1) al cargar los datos.
- **Impacto y beneficio:** Resultados de búsqueda desplegados en menos de 5 milisegundos.

### 4.29. Uso de worker threads en el cliente (Web Workers) para procesamiento pesado de CSV
- **Diagnóstico actual:** Analizar miles de registros de asistencia para generar un balance semestral congela la interfaz momentáneamente.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Delegar el cálculo a un Web Worker en un hilo paralelo.
- **Impacto y beneficio:** Cero congelamiento de la pantalla (TBT = 0ms) durante la exportación de notas.

### 4.30. Batching de actualizaciones de estado en React 19
- **Diagnóstico actual:** Múltiples `setStates` seguidos dentro de llamadas asíncronas de Firebase pueden generar renders intermedios.
- **Archivos involucrados:** `src/app/dashboard/page.tsx`
- **Propuesta técnica:** Unificar estados relacionados en un único objeto de estado o `useReducer`.
- **Impacto y beneficio:** Menos ciclos de render y visualización coherente sin estados intermedios.

### 4.31. Reducción de overhead en la conversión de Markdown con caché de HTML generado
- **Diagnóstico actual:** El mismo Markdown estático de una consigna se vuelve a procesar con `marked.parse()` en cada render.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Almacenar en un `Map<string, string>` los resultados ya procesados para retorno O(1).
- **Impacto y beneficio:** Renderizado instantáneo de consignas largas.

### 4.32. Alineación de componentes de layout al grid de CSS puro en lugar de flex anidados
- **Diagnóstico actual:** Estructuras con múltiples `flex flex-col` y `flex-1` anidados sobrecargan el motor de maquetación del navegador.
- **Archivos involucrados:** `src/app/dashboard/layout.tsx`
- **Propuesta técnica:** Reestructurar el shell del Dashboard con `grid grid-cols-[260px_1fr]` y `grid-rows-[auto_1fr]`.
- **Impacto y beneficio:** Cálculo de layout del navegador mucho más rápido y predecible.

### 4.33. Optimización de los re-renders en el temporizador de asistencia QR
- **Diagnóstico actual:** Un temporizador que descuenta segundos de validez del token re-renderiza todo el modal cada 1.000 ms.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx`
- **Propuesta técnica:** Aislar el reloj en un micro-componente `<QrCountdown />` memoizado que solo se actualice a sí mismo.
- **Impacto y beneficio:** Cero re-renders en el visor de cámara ni en los botones circundantes.

### 4.34. Precarga selectiva de conexiones con dns-prefetch y preconnect
- **Diagnóstico actual:** La conexión con Firebase Auth (`identitytoolkit.googleapis.com`) y Firestore inicia tarde tras cargar el HTML.
- **Archivos involucrados:** `src/app/layout.tsx`
- **Propuesta técnica:** Añadir etiquetas `<link rel='preconnect' href='https://firestore.googleapis.com'>` en el `<head>`.
- **Impacto y beneficio:** Negociación TLS anticipada que ahorra hasta 300ms en la primera consulta de datos.

### 4.35. Optimización del bundle de dependencias mediante bundle-analyzer continuo
- **Diagnóstico actual:** No hay visibilidad de qué paquetes están engrosando el build en cada commit.
- **Archivos involucrados:** `next.config.ts`
- **Propuesta técnica:** Configurar `@next/bundle-analyzer` accesible mediante script `npm run analyze`.
- **Impacto y beneficio:** Identificación temprana de dependencias accidentales pesadas.

### 4.36. Reducción de transferencias de red mediante compresión de respuestas JSON en Next.js
- **Diagnóstico actual:** Las respuestas de API routes y Server Actions pueden transmitirse sin compresión si no se activa en el servidor.
- **Archivos involucrados:** `next.config.ts`
- **Propuesta técnica:** Habilitar `compress: true` en la configuración de Next.js para compresión automática gzip/brotli.
- **Impacto y beneficio:** Respuestas de API Route hasta 4 veces más livianas.

### 4.37. Optimización del selector de temas (Light/Dark) sin flashes de color inicial (FOUC)
- **Diagnóstico actual:** Al cargar la página en modo oscuro, a veces se observa un destello blanco antes de aplicar la clase `dark`.
- **Archivos involucrados:** `src/app/layout.tsx`
- **Propuesta técnica:** Inyectar un script bloqueante inline diminuto en el `<head>` que lea `localStorage` y fije la clase antes del render.
- **Impacto y beneficio:** Cero destellos molestos al recargar la página.

### 4.38. Uso de Event Delegation en listas extensas de clases
- **Diagnóstico actual:** Cada tarjeta de clase adjunta sus propios listeners `onClick`, `onMouseEnter` y `onDrop`.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Manejar los eventos a nivel del contenedor de la lista mediante delegación de eventos (`e.target.closest`).
- **Impacto y beneficio:** Menor consumo de memoria RAM en el navegador.

### 4.39. Eliminación de renderizado condicional de componentes costosos montando y desmontando del DOM
- **Diagnóstico actual:** Montar y desmontar vistas de mes y semana destruye y reconstruye todo el árbol de componentes.
- **Archivos involucrados:** `src/modules/calendar/components/CalendarPanel.tsx`
- **Propuesta técnica:** Alternar visibilidad mediante CSS `hidden` para vistas frecuentemente alternadas.
- **Impacto y beneficio:** Cambio instantáneo de vista sin latencia de montaje.

### 4.40. Optimización de la suscripción de asistencia en tiempo real con límites de consulta
- **Diagnóstico actual:** La suscripción a la colección de asistencias escucha todos los registros del semestre sin paginar.
- **Archivos involucrados:** `src/modules/course/components/CourseOverviewPanel.tsx`
- **Propuesta técnica:** Limitar la consulta a las últimas 4 clases para la vista de resumen.
- **Impacto y beneficio:** Transferencia de datos mínima y actualización instantánea.

### 4.41. Eliminación de closures repetitivos en loops de renderizado
- **Diagnóstico actual:** Funciones de flecha inline `() => handleUpdate(idx)` recrean nuevas instancias de funciones por cada clase en cada render.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Utilizar atributos `data-index` y un handler estable memoizado con `useCallback`.
- **Impacto y beneficio:** Menor presión sobre el Garbage Collector y rendimiento óptimo.

### 4.42. Reducción de tamaño del favicon y assets de branding
- **Diagnóstico actual:** El favicon actual pesa casi 26 KB, excesivo para un icono de navegador.
- **Archivos involucrados:** `src/app/favicon.ico`
- **Propuesta técnica:** Optimizar a formato SVG escalable moderno y generar ICO multicapa de menos de 5 KB.
- **Impacto y beneficio:** Carga más rápida del documento principal.

### 4.43. Optimización de la hidratación en Server Components de Next.js
- **Diagnóstico actual:** Asegurar que la página de bienvenida aproveche SSR puro de Next.js sin directiva 'use client' innecesaria.
- **Archivos involucrados:** `src/app/page.tsx`
- **Propuesta técnica:** Cero JavaScript transmitido al navegador para pantallas estáticas de presentación.
- **Impacto y beneficio:** First Contentful Paint (FCP) ultrarrápido.

### 4.44. Reemplazo de loops anidados en cálculo de promedios de alumnos
- **Diagnóstico actual:** Se iteraba sobre las entregas para sumar notas y luego otra vez para calcular promedios.
- **Archivos involucrados:** `src/app/dashboard/components/StudentNinjaRankCard.tsx`
- **Propuesta técnica:** Consolidar en una sola pasada lineal los cálculos acumulativos de notas y asistencias.
- **Impacto y beneficio:** Ahorro de ciclos de CPU en el cliente.

### 4.45. Control de repintados en animaciones de carga mediante isolation: isolate
- **Diagnóstico actual:** Los spinners animados pueden forzar repintados de los componentes vecinos si comparten el contexto de apilamiento.
- **Archivos involucrados:** `src/app/globals.css`
- **Propuesta técnica:** Añadir `isolation: isolate` y `will-change: transform` en los elementos de carga continua.
- **Impacto y beneficio:** La GPU maneja el spinner de forma aislada sin afectar el resto de la interfaz.

### 4.46. Eliminación de expresiones regulares no pre-compiladas en filtros de texto
- **Diagnóstico actual:** Crear `new RegExp(searchTerm)` dentro de un bucle `.filter()` recompila el patrón N veces.
- **Archivos involucrados:** `src/components/dashboard/ui/CommandPalette.tsx`
- **Propuesta técnica:** Compilar la expresión regular una sola vez antes de iterar sobre los elementos.
- **Impacto y beneficio:** Búsquedas 3 veces más rápidas en catálogos extensos de tareas.

### 4.47. Prefetching de credenciales de sesión en segundo plano al cargar la pantalla de login
- **Diagnóstico actual:** Los SDKs de Google Identity Services y GitHub Auth se inicializan recién cuando el usuario interactúa.
- **Archivos involucrados:** `src/modules/auth/components/AuthScreen.tsx`
- **Propuesta técnica:** Inicializar los proveedores de OAuth en segundo plano con `requestIdleCallback`.
- **Impacto y beneficio:** Apertura instantánea del popup de autenticación sin demoras perceptibles.

### 4.48. Control estricto de memoria en escaneo de QR liberando el canvas de la cámara
- **Diagnóstico actual:** Al cerrar el modal de escaneo de QR, el stream de video de la cámara puede seguir consumiendo memoria si no se detienen los tracks.
- **Archivos involucrados:** `src/modules/attendance/components/QrScannerModal.tsx`
- **Propuesta técnica:** Garantizar que `stream.getTracks().forEach(track => track.stop())` se ejecute rigurosamente al desmontar el componente.
- **Impacto y beneficio:** La cámara se apaga de inmediato y se libera la memoria RAM y batería del dispositivo.

### 4.49. Uso de CSS Subgrid para alinear columnas de cronograma y listas de alumnos
- **Diagnóstico actual:** Alinear tablas complejas mediante márgenes manuales genera desfases visuales y recalculos de layout.
- **Archivos involucrados:** `src/modules/course/components/CourseSchedulesPanel.tsx`
- **Propuesta técnica:** Implementar `display: subgrid` para que las filas hereden la alineación de columnas del contenedor padre.
- **Impacto y beneficio:** Diseño perfectamente estructurado con rendimiento nativo del navegador.

### 4.50. Auditoría continua de Web Vitals en producción con la biblioteca web-vitals
- **Diagnóstico actual:** No hay telemetría de cómo rinde la plataforma en los navegadores reales de los estudiantes.
- **Archivos involucrados:** `src/app/layout.tsx`
- **Propuesta técnica:** Integrar `useReportWebVitals` de Next.js enviando métricas (LCP, FID, CLS, INP) a Google Analytics o Cloud Logging.
- **Impacto y beneficio:** Detección en tiempo real de cuellos de botella en dispositivos reales de los alumnos.


## Categoría 5: Testing, CI/CD, DevOps y Observabilidad

_Automatización de pruebas con Playwright y Jest, telemetría y monitoreo de errores con Sentry, pipelines de integración continua de alta velocidad y gobernanza DevOps._

**Total de propuestas en esta categoría:** 50

### 5.01. Migración de tests E2E de Selenium legado a Playwright
- **Diagnóstico actual:** Los tests de Selenium son lentos, propensos a fragilidad por esperas manuales (`sleep`), y difíciles de depurar.
- **Archivos involucrados:** `tests/selenium/run-all-tests.js`
- **Propuesta técnica:** Migrar a Playwright moderno con auto-wait, trazabilidad visual (traces), grabación de video y ejecución paralela veloz.
- **Impacto y beneficio:** Tests end-to-end 4 veces más rápidos, robustos y con diagnósticos visuales ante fallos.

### 5.02. Cobertura de pruebas unitarias para utilidades críticas en src/lib/
- **Diagnóstico actual:** Las funciones de cálculo de fechas y normalización de URLs no tienen tests unitarios automatizados.
- **Archivos involucrados:** `src/lib/dates.ts, src/lib/clipboard.ts, src/lib/url.ts`
- **Propuesta técnica:** Crear suites con Jest/Vitest que cubran casos límite (cambios de año, husos horarios, URLs malformadas).
- **Impacto y beneficio:** Confianza total en las funciones fundacionales compartidas por toda la app.

### 5.03. Pruebas de integración de componentes React con React Testing Library
- **Diagnóstico actual:** No existen tests de componentes que verifiquen el correcto renderizado de rangos ninja, alertas o modales.
- **Archivos involucrados:** `tests/components/StudentNinjaRankCard.test.tsx`
- **Propuesta técnica:** Crear tests de interacción simulando eventos de usuario (`@testing-library/user-event`).
- **Impacto y beneficio:** Detección de regresiones visuales y lógicas antes de llegar a producción.

### 5.04. Suite de pruebas unitarias para reglas de seguridad de Firestore
- **Diagnóstico actual:** Las pruebas de reglas existentes deben ampliarse para cubrir todos los nuevos roles y validaciones de campo.
- **Archivos involucrados:** `tests/firestore.rules.test.js`
- **Propuesta técnica:** Añadir tests para casos negativos: alumno intentando calificar, docente de otro curso intentando editar notas.
- **Impacto y beneficio:** Blindaje absoluto contra brechas de seguridad en la base de datos.

### 5.05. Pipeline de GitHub Actions con caché inteligente de dependencias pnpm/npm
- **Diagnóstico actual:** El pipeline reinstala paquetes en cada ejecución consumiendo tiempo valioso de CI.
- **Archivos involucrados:** `.github/workflows/tests.yml`
- **Propuesta técnica:** Configurar `actions/setup-node` con `cache: 'npm'` o caché de pnpm.
- **Impacto y beneficio:** Tiempos de ejecución de CI reducidos a la mitad.

### 5.06. Paralelización de Jobs en GitHub Actions (Matrix testing)
- **Diagnóstico actual:** Los tests de backend, frontend y seguridad se ejecutaban en serie o con configuraciones rígidas.
- **Archivos involucrados:** `.github/workflows/tests.yml`
- **Propuesta técnica:** Configurar jobs paralelos independientes: Linting, Typecheck, Unit Tests, Rules Tests y E2E Tests.
- **Impacto y beneficio:** Feedback inmediato al desarrollador en menos de 2 minutos por Pull Request.

### 5.07. Integración de Sentry para reporte de errores en tiempo real en frontend y backend
- **Diagnóstico actual:** Si un alumno sufre un error en el aula, el equipo de desarrollo no tiene visibilidad a menos que el usuario mande un email.
- **Archivos involucrados:** `src/app/layout.tsx, functions/index.js`
- **Propuesta técnica:** Instalar `@sentry/nextjs` con breadcrumbs automáticos y captura de excepciones no controladas.
- **Impacto y beneficio:** Resolución proactiva de bugs antes de que afecten a más estudiantes.

### 5.08. Configuración de Dependabot / Renovate con auto-merge para parches menores
- **Diagnóstico actual:** Los PRs de dependencias se acumulan sin mergearse, desactualizando paquetes de seguridad.
- **Archivos involucrados:** `.github/dependabot.yml`
- **Propuesta técnica:** Configurar reglas automáticas que fusionen parches si pasan el 100% de los tests en verde.
- **Impacto y beneficio:** Dependencias siempre al día sin sobrecarga manual de mantenimiento.

### 5.09. Validación de variables de entorno en tiempo de build con Zod (@t3-oss/env-nextjs)
- **Diagnóstico actual:** Si falta una variable en `.env` (como API keys de Firebase), la app compila pero falla silenciosamente en runtime.
- **Archivos involucrados:** `src/lib/env.mjs`
- **Propuesta técnica:** Crear un validador estricto que aborte el build si falta cualquier variable obligatoria.
- **Impacto y beneficio:** Cero despliegues rotos por configuraciones faltantes.

### 5.10. Métricas de rendimiento en producción con Firebase Performance Monitoring
- **Diagnóstico actual:** Falta visibilidad de la latencia real de las consultas de Firestore desde las conexiones Wi-Fi de las aulas.
- **Archivos involucrados:** `src/lib/firebase/clientApp.ts`
- **Propuesta técnica:** Inicializar `getPerformance(app)` en el cliente para monitorear trazas de red y tiempos de carga de pantalla.
- **Impacto y beneficio:** Datos reales de velocidad para optimizar donde realmente duele.

### 5.11. Generación automática de reportes de cobertura de código (Code Coverage) en CI
- **Diagnóstico actual:** No se mide qué porcentaje de líneas de código están protegidas por tests automatizados.
- **Archivos involucrados:** `.github/workflows/tests.yml`
- **Propuesta técnica:** Configurar `jest --coverage` y publicar el badge en Codecov o GitHub Actions Summary.
- **Impacto y beneficio:** Transparencia sobre la calidad del código y metas de cobertura (>80%).

### 5.12. Linter de accesibilidad automatizado con axe-core en CI
- **Diagnóstico actual:** Los problemas de contraste o etiquetas faltantes se detectan manualmente o pasan desapercibidos.
- **Archivos involucrados:** `tests/a11y/a11y.test.js`
- **Propuesta técnica:** Integrar `@axe-core/playwright` para auditar automáticamente las páginas principales en cada PR.
- **Impacto y beneficio:** Garantía de que ningún PR degrade la accesibilidad de la plataforma.

### 5.13. Configuración de Husky y lint-staged para validaciones pre-commit locales
- **Diagnóstico actual:** Los desarrolladores pueden commitear accidentalmente archivos con errores de TypeScript o formato roto.
- **Archivos involucrados:** `package.json`
- **Propuesta técnica:** Instalar `husky` y `lint-staged` para correr linter y typecheck automáticamente antes de crear el commit.
- **Impacto y beneficio:** El repositorio remoto se mantiene impecable sin commits de 'fix lint'.

### 5.14. Estandarización de formato de código con Prettier y plugin de Tailwind CSS
- **Diagnóstico actual:** El orden de las clases de Tailwind es dispar entre diferentes archivos, dificultando la lectura de diffs.
- **Archivos involucrados:** `.prettierrc, package.json`
- **Propuesta técnica:** Instalar `prettier-plugin-tailwindcss` que ordene automáticamente las clases según la convención recomendada.
- **Impacto y beneficio:** Diffs limpios y consistencia estética en todo el código fuente.

### 5.15. Mocking integral de Firebase Auth y Firestore en pruebas unitarias
- **Diagnóstico actual:** Muchos tests intentan conectar a la red o fallan por falta de emulador levantado.
- **Archivos involucrados:** `tests/mocks/firebase.ts`
- **Propuesta técnica:** Construir mocks exhaustivos con `jest.mock` para las llamadas de Firestore y Auth.
- **Impacto y beneficio:** Tests unitarios ultra veloces ejecutables sin conexión a Internet.

### 5.16. Contenedorización del entorno de desarrollo local con Docker Compose
- **Diagnóstico actual:** Levantar emuladores de Firebase, Moodle local y Next.js requiere instalar Node, Java y utilidades a mano.
- **Archivos involucrados:** `docker-compose.yml`
- **Propuesta técnica:** Diseñar un `docker-compose.yml` que orqueste la app, emuladores y Moodle de prueba con un solo comando `docker compose up`.
- **Impacto y beneficio:** Onboarding de nuevos programadores en menos de 10 minutos.

### 5.17. Simulador de Moodle local para pruebas de desarrollo (LTI Mock Server)
- **Diagnóstico actual:** Probar la integración con Moodle requiere acceso a servidores reales de la universidad o túneles ngrok.
- **Archivos involucrados:** `scripts/moodle-mock-server.js`
- **Propuesta técnica:** Crear un servidor Express diminuto local que simule las respuestas de la API REST y lanzamientos LTI de Moodle.
- **Impacto y beneficio:** Desarrollo ágil e independiente de la infraestructura de la universidad.

### 5.18. Pruebas de estrés y carga con k6 para inscripciones y entregas masivas
- **Diagnóstico actual:** No se conoce el límite de concurrencia cuando 200 alumnos escanean asistencia al mismo segundo al iniciar la clase.
- **Archivos involucrados:** `tests/load/k6-load-test.js`
- **Propuesta técnica:** Diseñar scripts de carga con `k6` simulando 500 peticiones concurrentes a las Cloud Functions.
- **Impacto y beneficio:** Identificación de cuellos de botella antes del primer día de clases.

### 5.19. Auditoría continua de seguridad en dependencias con npm audit y Snyk
- **Diagnóstico actual:** Vulnerabilidades en librerías de terceros pueden pasar meses sin ser descubiertas.
- **Archivos involucrados:** `.github/workflows/security.yml`
- **Propuesta técnica:** Añadir un job semanal de GitHub Actions que ejecute `npm audit --audit-level=high`.
- **Impacto y beneficio:** Protección proactiva contra dependencias comprometidas.

### 5.20. Estandarización de mensajes de commit mediante Commitlint
- **Diagnóstico actual:** Se exige Conventional Commits pero la regla depende de la disciplina humana sin enforcement automatizado.
- **Archivos involucrados:** `commitlint.config.js, package.json`
- **Propuesta técnica:** Instalar `@commitlint/config-conventional` y validarlo en el hook `commit-msg` de Git.
- **Impacto y beneficio:** Historial de Git inmaculado y generación automática de changelogs.

### 5.21. Generación automática de Changelog semántico en cada Release
- **Diagnóstico actual:** Las actualizaciones se despliegan sin un registro público claro de qué cambios o mejoras incluye cada versión.
- **Archivos involucrados:** `.github/workflows/release.yml`
- **Propuesta técnica:** Integrar `semantic-release` para versionado semántico automático y notas de versión en GitHub Releases.
- **Impacto y beneficio:** Comunicación fluida de novedades a los docentes y autoridades académicas.

### 5.22. Monitorización de estado de salud (Healthcheck) de endpoints externos
- **Diagnóstico actual:** Si la API de GitHub o el Moodle de la universidad sufren caídas, Dojo puede arrojar errores confusos a los usuarios.
- **Archivos involucrados:** `functions/src/monitoring/externalHealth.js`
- **Propuesta técnica:** Implementar comprobaciones automáticas periódicas del estado de GitHub y Moodle y reflejarlo en un banner de estado.
- **Impacto y beneficio:** Transparencia sobre fallas atribuibles a servicios externos.

### 5.23. Validación estricta de licencias de dependencias de código abierto
- **Diagnóstico actual:** La inclusión inadvertida de dependencias con licencias GPL restrictivas puede ser un problema para proyectos institucionales.
- **Archivos involucrados:** `.github/workflows/licenses.yml`
- **Propuesta técnica:** Integrar `license-checker` en CI para alertar si se introduce una librería con licencia no compatible (MIT/Apache/BSD).
- **Impacto y beneficio:** Cumplimiento legal y regulatorio institucional.

### 5.24. Limpieza automática de ramas remotas fusionadas (Branch Pruning)
- **Diagnóstico actual:** Las ramas de features y bots se acumulan en el repositorio remoto saturando el selector de Git.
- **Archivos involucrados:** `.github/workflows/cleanup-branches.yml`
- **Propuesta técnica:** Habilitar en la configuración de GitHub 'Automatically delete head branches' tras merge.
- **Impacto y beneficio:** Repositorio ágil, limpio y libre de ramas huérfanas.

### 5.25. Alertas instantáneas a canal de Discord / Slack de docentes ante fallos críticos
- **Diagnóstico actual:** Si el servidor de asistencia falla durante un parcial, el equipo de soporte técnico se entera tarde.
- **Archivos involucrados:** `functions/src/monitoring/alerts.js`
- **Propuesta técnica:** Configurar webhooks a un canal privado de alertas de Discord/Slack ante errores 500 reiterados en Functions.
- **Impacto y beneficio:** Respuesta y asistencia técnica en tiempo récord.

### 5.26. Pruebas de regresión visual automatizadas con Playwright Screenshots
- **Diagnóstico actual:** Cambios accidentales en Tailwind pueden romper layouts de tarjetas o botones sin arrojar errores de código.
- **Archivos involucrados:** `tests/e2e/visual-regression.spec.ts`
- **Propuesta técnica:** Implementar pruebas visuales con `expect(page).toHaveScreenshot()` en componentes clave (Dashboard, Auth, Calificaciones).
- **Impacto y beneficio:** Inmunidad ante alteraciones estéticas imprevistas.

### 5.27. Configuración de Source Maps seguros en producción para depuración
- **Diagnóstico actual:** Los errores en producción muestran trazas de código ofuscado difíciles de rastrear.
- **Archivos involucrados:** `next.config.ts`
- **Propuesta técnica:** Habilitar source maps ocultos (`productionBrowserSourceMaps: true`) que se suban exclusivamente a Sentry sin exponerse al cliente.
- **Impacto y beneficio:** Trazas de error legibles con líneas de código exactas de TypeScript en producción.

### 5.28. Scripts de Seed deterministas para poblar la base de datos de desarrollo
- **Diagnóstico actual:** El script de seed actual es básico y no genera variedad de entregas, calificaciones dispares ni foros activos.
- **Archivos involucrados:** `functions/seed.js`
- **Propuesta técnica:** Construir un generador de fixtures con `@faker-js/faker` que cree 3 materias, 50 alumnos, entregas reales y asistencias.
- **Impacto y beneficio:** Desarrollo con datos representativos y visualmente atractivos.

### 5.29. Testeo automatizado de compatibilidad en múltiples navegadores (Chromium, Firefox, WebKit)
- **Diagnóstico actual:** Se asume que la plataforma funciona igual en Safari o Firefox habiendo testeado solo en Chrome.
- **Archivos involucrados:** `.github/workflows/tests.yml`
- **Propuesta técnica:** Ejecutar la suite de Playwright sobre Chromium, Firefox y WebKit en el CI de GitHub.
- **Impacto y beneficio:** Cero sorpresas para alumnos que utilizan Mac/Safari o Linux/Firefox.

### 5.30. Pruebas unitarias para Cloud Functions con firebase-functions-test
- **Diagnóstico actual:** La lógica de las Cloud Functions carece de tests unitarios que simulen triggers de base de datos.
- **Archivos involucrados:** `functions/tests/unit/moodle.test.js`
- **Propuesta técnica:** Implementar pruebas con `firebase-functions-test` en modo offline mockeando el SDK admin.
- **Impacto y beneficio:** Garantía de que las funciones responden adecuadamente sin necesidad de desplegarlas en la nube.

### 5.31. Análisis estático de seguridad de código (SAST) con CodeQL o SonarQube
- **Diagnóstico actual:** Falta un escaneo profundo de patrones de código vulnerables o anti-patrones de concurrencia.
- **Archivos involucrados:** `.github/workflows/codeql.yml`
- **Propuesta técnica:** Activar el workflow oficial de GitHub CodeQL para análisis semántico continuo.
- **Impacto y beneficio:** Detección de vulnerabilidades complejas en tiempo de pull request.

### 5.32. Manejo de secretos de CI rotativos con GitHub Environments
- **Diagnóstico actual:** Los secretos de CI están en un solo nivel sin diferenciar permisos de staging y producción.
- **Archivos involucrados:** `.github/workflows/`
- **Propuesta técnica:** Configurar GitHub Environments (`staging`, `production`) con requerimiento de aprobación manual antes de desplegar en prod.
- **Impacto y beneficio:** Control riguroso de despliegues productivos.

### 5.33. Simulador de mala conexión (Network Throttling) en tests E2E
- **Diagnóstico actual:** En el campus universitario la conexión Wi-Fi suele saturarse con alta latencia y pérdida de paquetes.
- **Archivos involucrados:** `tests/e2e/slow-network.spec.ts`
- **Propuesta técnica:** Configurar pruebas de Playwright con emulación de 'Slow 3G' para comprobar el comportamiento de spinners y reintentos.
- **Impacto y beneficio:** Plataforma resiliente y tolerante a redes inestables.

### 5.34. Verificación de expiración de certificados SSL y dominios institucionales
- **Diagnóstico actual:** Una expiración imprevista del certificado de Moodle rompe la integración LTI sin aviso.
- **Archivos involucrados:** `scripts/check-certs.js`
- **Propuesta técnica:** Configurar una sonda que alerte 30 días antes de la expiración de cualquier certificado SSL de los dominios vinculados.
- **Impacto y beneficio:** Cero caídas imprevistas por certificados vencidos.

### 5.35. Automatización de rollback ante fallos en Firebase App Hosting
- **Diagnóstico actual:** Si una versión desplegada falla en producción, el proceso de vuelta atrás es manual.
- **Archivos involucrados:** `.github/workflows/deploy.yml`
- **Propuesta técnica:** Implementar verificación post-despliegue (Smoke Test); si falla, disparar rollback automático a la versión anterior con Firebase CLI.
- **Impacto y beneficio:** Alta disponibilidad garantizada con tiempo de caída cercano a cero.

### 5.36. Test de idempotencia en suscripciones en tiempo real de Firestore
- **Diagnóstico actual:** Comprobar que abrir y cerrar 20 veces una pantalla no cree 20 listeners simultáneos de Firestore en memoria.
- **Archivos involucrados:** `tests/firestore-leak.test.js`
- **Propuesta técnica:** Crear un test que valide que el contador de listeners activos se mantenga en cero al desmontar los módulos.
- **Impacto y beneficio:** Prevención de degradación de rendimiento por fugas de memoria en la app.

### 5.37. Aislamiento de la configuración de Firebase en un módulo desacoplado
- **Diagnóstico actual:** La configuración lee `process.env` en múltiples puntos dispersos.
- **Archivos involucrados:** `src/lib/firebase/config.ts`
- **Propuesta técnica:** Centralizar la inicialización con validación de credenciales en un único archivo de configuración inmutable.
- **Impacto y beneficio:** Facilidad para alternar entre emuladores locales y proyectos en la nube.

### 5.38. Pruebas de accesibilidad de contraste automatizadas en CI
- **Diagnóstico actual:** Garantizar que ninguna nueva clase de Tailwind reduzca el ratio de contraste por debajo de 4.5:1.
- **Archivos involucrados:** `tests/a11y/contrast.test.js`
- **Propuesta técnica:** Incluir chequeo de contraste en las pruebas automatizadas de componentes.
- **Impacto y beneficio:** Imposibilidad de incorporar textos ilegibles en futuros PRs.

### 5.39. Configuración de observabilidad y métricas de servidor en Cloud Functions con Cloud Monitoring
- **Diagnóstico actual:** Falta visibilidad de la duración de ejecución, uso de memoria RAM y errores de las funciones en la nube.
- **Archivos involucrados:** `functions/index.js`
- **Propuesta técnica:** Configurar tableros personalizados de Google Cloud Monitoring con alertas de consumo de memoria y timeouts.
- **Impacto y beneficio:** Dimensionamiento óptimo de la memoria de las funciones (128MB, 256MB, 512MB) para ahorrar costos.

### 5.40. Generación automatizada de documentación de APIs con Swagger / OpenAPI
- **Diagnóstico actual:** Los endpoints de la plataforma (LTI, exportación, CLI) no tienen documentación técnica interactiva.
- **Archivos involucrados:** `src/app/api/docs/`
- **Propuesta técnica:** Generar especificación OpenAPI y servir una interfaz Swagger UI protegida para desarrolladores.
- **Impacto y beneficio:** Integraciones externas y desarrollo de extensiones mucho más ágiles.

### 5.41. Auditoría de integridad de dependencias con Lockfile Lint
- **Diagnóstico actual:** Asegurar que los archivos de lockfile (`package-lock.json`, `pnpm-lock.yaml`) solo apunten a los registros oficiales de npm.
- **Archivos involucrados:** `.github/workflows/lockfile-lint.yml`
- **Propuesta técnica:** Integrar `lockfile-lint` para prevenir ataques a la cadena de suministro por registros maliciosos.
- **Impacto y beneficio:** Inmunidad ante ataques de Supply Chain en dependencias de Node.js.

### 5.42. Monitoreo de Core Web Vitals en CI con Lighthouse CI (LHCI)
- **Diagnóstico actual:** Los PRs pueden introducir cambios que degraden la velocidad de la web sin que nadie lo note.
- **Archivos involucrados:** `.github/workflows/lighthouse.yml`
- **Propuesta técnica:** Configurar Lighthouse CI en GitHub Actions que exija un puntaje mínimo de 90 en Performance y Accesibilidad.
- **Impacto y beneficio:** Calidad de software no negociable en cada línea de código agregada.

### 5.43. Test de concurrencia en la votación de 'Mejor Respuesta' en foros
- **Diagnóstico actual:** Validar que dos docentes marcando la mejor respuesta al mismo milisegundo no dejen el foro en estado inconsistente.
- **Archivos involucrados:** `tests/unit/comments-concurrency.test.js`
- **Propuesta técnica:** Crear un test que dispare escrituras simultáneas y valide que solo una quede marcada atómicamente.
- **Impacto y beneficio:** Consistencia de datos absoluta en la base de datos.

### 5.44. Configuración de política de seguridad de contenido (CSP) estricta en encabezados HTTP
- **Diagnóstico actual:** Falta de encabezados CSP que restrinjan de dónde se pueden cargar scripts, estilos e imágenes.
- **Archivos involucrados:** `next.config.ts`
- **Propuesta técnica:** Configurar cabeceras `Content-Security-Policy`, `X-Content-Type-Options: nosniff` y `X-Frame-Options: SAMEORIGIN`.
- **Impacto y beneficio:** Blindaje robusto contra Clickjacking y Cross-Site Scripting (XSS).

### 5.45. Creación de entorno de Staging con despliegues automáticos (Preview Channels)
- **Diagnóstico actual:** Los PRs se prueban a ciegas en local sin un entorno web accesible para que los docentes validen antes de producción.
- **Archivos involucrados:** `firebase.json, .github/workflows/preview.yml`
- **Propuesta técnica:** Configurar Firebase App Hosting / Hosting Preview Channels que desplieguen una URL temporal por cada Pull Request.
- **Impacto y beneficio:** Revisión interactiva real de cada funcionalidad antes de autorizar el merge.

### 5.46. Auditoría de cookies de sesión con directivas SameSite y Secure
- **Diagnóstico actual:** Verificar que las cookies de sesión tengan `Secure`, `HttpOnly` y `SameSite=Lax` (o `None` para iframes de Moodle LTI).
- **Archivos involucrados:** `src/app/api/lti/route.ts`
- **Propuesta técnica:** Garantizar configuración estricta de cookies para evitar secuestro de sesiones.
- **Impacto y beneficio:** Protección de sesión impecable en navegadores de última generación.

### 5.47. Verificación de tiempo de ejecución de tests unitarios evitando tests lentos
- **Diagnóstico actual:** Tests individuales que tardan más de 3 segundos retrasan innecesariamente la suite de desarrollo.
- **Archivos involucrados:** `jest.config.js`
- **Propuesta técnica:** Configurar flags de Jest que alerten sobre tests lentos para optimizar mocks y timeouts.
- **Impacto y beneficio:** Suite de tests ágil que no desmotive a los desarrolladores a correrla constantemente.

### 5.48. Pruebas de resiliencia ante caídas de Firebase Auth (Offline Mode)
- **Diagnóstico actual:** Validar cómo responde la UI si los servidores de Google Auth demoran o fallan al verificar tokens.
- **Archivos involucrados:** `tests/e2e/offline-auth.spec.ts`
- **Propuesta técnica:** Comprobar que el usuario reciba un mensaje amigable 'Servicio de autenticación no disponible temporalmente' con reintento.
- **Impacto y beneficio:** Experiencia de usuario clara y sin bloqueos silenciosos.

### 5.49. Documentación viva de la arquitectura del sistema mediante C4 Model o Mermaid diagrams en el repo
- **Diagnóstico actual:** No existe un diagrama visual actualizado que explique cómo interactúan Next.js, Cloud Functions, Moodle, GitHub y Firestore.
- **Archivos involucrados:** `docs/architecture.md`
- **Propuesta técnica:** Crear `docs/architecture.md` con diagramas Mermaid de flujo de datos, autenticación y despliegue.
- **Impacto y beneficio:** Claridad arquitectónica y alineación técnica para todo el equipo.

### 5.50. Automatización de la resolución y descarte de Pull Requests duplicados de bots en CI
- **Diagnóstico actual:** Bots automatizados pueden generar decenas de PRs redundantes que saturan la lista de revisiones del repositorio.
- **Archivos involucrados:** `.github/workflows/bot-pr-hygiene.yml`
- **Propuesta técnica:** Crear una acción programada que detecte PRs duplicados de los mismos archivos, mantenga el más reciente y cierre los obsoletos con comentario explicativo.
- **Impacto y beneficio:** Higiene continua del repositorio sin intervención humana manual.


---

## Matriz de Priorización y Roadmap de Implementación

Para facilitar la planificación estratégica del equipo de desarrollo, las 250 propuestas se estructuran en 4 fases de ejecución sugeridas:

| Fase | Enfoque Principal | Cantidad de Mejoras | Esfuerzo Estimado |
|---|---|---|---|
| **Fase 1: Estabilización y Seguridad Crítica** | Reglas de Firestore, Tipado estricto inicial, Prevención de fugas de memoria, Atrapado de foco en modales y CI fixes. | 60 mejoras | 2 sprints (4 semanas) |
| **Fase 2: Rendimiento y Virtualización** | Virtualización de tablas, Code Splitting dinámico (`next/dynamic`), `next/image`, Cache SWR y pre-instanciación de formateadores. | 65 mejoras | 3 sprints (6 semanas) |
| **Fase 3: Arquitectura y Modularización** | División del monolito `CourseSchedulesPanel`, desacoplamiento de Custom Hooks de negocio, migración de Functions a TS v2. | 65 mejoras | 3 sprints (6 semanas) |
| **Fase 4: Testing Avanzado y Nuevas Experiencias** | Migración total a Playwright, LTI 1.3 Advantage, Gamificación avanzada, Modo presentación y Observabilidad profunda (Sentry). | 60 mejoras | 3 sprints (6 semanas) |

---
_Documento generado para el proyecto **Ninja Dojo (Jutsu Classroom)** - Repositorio: `martinvilu/dojo`._
