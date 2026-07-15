# Estándares de Desarrollo y Mantenimiento

Este documento describe las directrices para el mantenimiento y evolución del repositorio de Ninja Dojo.

## 📝 Commits Semánticos

Para mantener un historial de cambios claro y automatizable, utilizamos [Conventional Commits](https://www.conventionalcommits.org/). El formato debe ser:

`<tipo>(<ámbito>): <descripción>`

### Tipos permitidos:
- **feat**: Una nueva funcionalidad (ej. `feat(auth): login con github`).
- **fix**: Corrección de un error (ej. `fix(qr): error en validación de token`).
- **docs**: Cambios solo en la documentación (ej. `docs: guía de instalación`).
- **style**: Cambios que no afectan el significado del código (espacios, formato, etc.).
- **refactor**: Cambio de código que no corrige un error ni añade funcionalidad.
- **test**: Añadir o corregir pruebas existentes.
- **chore**: Actualización de tareas de compilación, dependencias, etc.

## 📚 Mantenimiento de la Documentación

Toda nueva funcionalidad o cambio arquitectónico debe reflejarse en:
1.  **README.md**: Actualizar la visión general y requisitos si cambian.
2.  **TESTING.md**: Añadir instrucciones si se incorporan nuevos tipos de pruebas.
3.  **GEMINI.md**: (Instrucciones de proyecto) Mantener actualizadas las convenciones de equipo y workflows.

## 🔄 Flujo de Reutilización de Cursos (En Desarrollo)

El sistema permite la portabilidad de datos para facilitar el inicio de nuevos cuatrimestres:

1.  **Exportación**: El Administrador puede descargar la estructura de un curso (tareas, cronograma, temas) en formato JSON desde Firestore.
2.  **Importación**: Se puede crear un nuevo curso a partir de un archivo JSON exportado anteriormente, permitiendo cambiar el nombre y la organización de GitHub de destino.

---
*Mantenimiento preventivo: Ejecutar la validación de Reglas de Firestore antes de cualquier cambio masivo en la base de datos.*
