# Pendientes de Desarrollo

Este archivo documenta las tareas y mejoras diferidas para futuras iteraciones del proyecto Ninja Dojo.

## 📅 Calendario Unificado con Filtros Multimateria

### Descripción
Actualmente, la sección de calendario requiere cargar el cronograma seleccionando una cátedra específica a la vez. La meta es implementar una **vista unificada y centralizada del calendario** que cargue los eventos de todas las cátedras disponibles en paralelo.

### Requerimientos Técnicos
1. **Carga en Paralelo**:
   - Consultar las clases (`class_instances`) y tareas (`assignments`) correspondientes a todas las cursadas en las que el usuario participe (inscripto como estudiante o asignado como profesor/admin) al iniciar la sección de Calendario.
2. **Filtros Granulares**:
   - Agregar una barra superior de filtros con checkboxes interactivos para cada una de las materias del usuario.
   - Permitir activar/desactivar individualmente la visualización de los eventos de cada materia en la grilla mensual/semanal para reducir el ruido visual.
3. **Colores Distintivos por Cátedra**:
   - Asignar una paleta de colores o un indicador distintivo por materia para reconocer de un vistazo rápido a qué asignatura corresponde cada clase o entrega.
