# Posibles Mejoras y Roadmap - Jutsu Classroom

Este documento recopila una serie de ideas y potenciales mejoras para evolucionar la plataforma en futuras iteraciones, abarcando nuevas funcionalidades para docentes y estudiantes, así como optimizaciones técnicas.

## 🛠️ Mejoras Técnicas y de Arquitectura

1. **Refactorización del Monolito Frontend (`app.js`)**
   - *Problema:* Actualmente toda la lógica de UI e interacciones con Firebase reside en un único archivo `app.js` muy extenso.
   - *Solución:* Modularizar este archivo dividiéndolo en módulos más pequeños (ej. `auth.js`, `course.js`, `schedule.js`) o considerar una migración progresiva de la lógica de UI a componentes de React aprovechando que el proyecto ya utiliza Next.js.
2. **Soporte PWA (Progressive Web App) y Modo Offline**
   - Configurar Service Workers para que los alumnos puedan consultar el cronograma, sus notas y el material de lectura incluso sin conexión a internet.
3. **Caché y Optimización de Consultas (Firestore)**
   - Implementar caché local riguroso para las consultas de clases y configuraciones, reduciendo la cantidad de lecturas en Firestore al navegar entre pestañas del curso.

## 👩‍🏫 Mejoras para el Rol Docente

1. **Gestión de Asistencia Integrada (Presentismo)**
   - Añadir una vista rápida en cada clase para tomar lista.
   - Posibilidad de generar códigos QR dinámicos que los alumnos puedan escanear desde su celular para marcar el presente automáticamente en clases presenciales.
2. **Sincronización Bidireccional con Google Calendar**
   - Permitir que las ediciones de fechas/horas de las clases realizadas en la plataforma actualicen automáticamente un evento en un Google Calendar vinculado.
3. **Dashboard de Métricas y Rendimiento**
   - Un panel visual que muestre el progreso general de la cursada: porcentaje de alumnos que entregaron tareas, promedios de notas, y alumnos en "riesgo" de abandono.
4. **Roles Intermedios (Ayudantes/Tutores)**
   - Crear un rol intermedio que permita a otros usuarios corregir entregas y responder dudas, pero sin permisos para modificar la configuración de la cátedra ni borrar clases.

## 🎓 Mejoras para el Rol Estudiante

1. **Sistema de Notificaciones (In-App y Email)**
   - Alertar a los alumnos cuando:
     - El docente publica una nueva nota o corrección.
     - Se cancela o reprograma una clase de último minuto.
     - Se sube un nuevo enlace de material o grabación.
2. **Suscripción a Calendario (iCal)**
   - Generar un enlace `.ics` único por estudiante que le permita sincronizar el cronograma de la materia directamente con la aplicación de calendario de su teléfono.
3. **Foro o Q&A por Clase**
   - Una pequeña sección de comentarios al final del detalle de cada clase donde los alumnos puedan dejar dudas específicas sobre ese tema y el profesor o compañeros puedan responder.

## 🔗 Integraciones Externas Avanzadas

1. **Integración Profunda con GitHub (Webhooks & CI/CD)**
   - Mostrar el estado de los tests (verde/rojo) de GitHub Actions directamente en la vista de "Entregas" del docente.
   - Asignar calificaciones automáticamente si los tests automatizados del repositorio del alumno pasan exitosamente.
2. **Integración de Evaluaciones (Quizzes)**
   - Incorporar un sistema de cuestionarios de corrección automática (multiple choice) nativo en la plataforma, ideal para controles de lectura rápidos antes de la clase.
