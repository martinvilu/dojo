# Pendientes de Desarrollo

Este archivo documenta las tareas y mejoras diferidas para futuras iteraciones del proyecto Ninja Dojo.

## 📅 Calendario Unificado con Filtros Multimateria — ✅ COMPLETADO

Implementado en `src/modules/calendar/components/CalendarPanel.tsx` (commit `74f8d85`):

1. **Carga en Paralelo** ✅
   - Al entrar a la pestaña Calendario, se consultan en paralelo las clases (`class_instances` vía `getCourseDetails`) y tareas (`getStudentAssignments`/`getTeacherAssignments`) de **todas** las cursadas del usuario.
2. **Filtros Granulares** ✅
   - Barra superior de checkboxes interactivos por materia (con acciones rápidas "Todas" / "Ninguna") para mostrar/ocultar los eventos de cada cátedra en la grilla mensual/semanal.
3. **Colores Distintivos por Cátedra** ✅
   - Paleta determinista por curso: puntos de color + borde izquierdo en los chips de eventos, nombre de la materia en vista semanal y en el modal de detalle.

## 🛡️ Funcionalidades Futuras

- [ ] **Detección de Plagio y Copias**: analizador estático por similitud estructural de AST entre repositorios de alumnos.
- [ ] **Autograding Integrado**: vinculación con GitHub Actions para correr tests y sincronizar el porcentaje de aprobación a la nota.
- [ ] **Buscador Omni (Command + K)**: búsqueda global de clases, avisos y entregas accesible por teclado.
