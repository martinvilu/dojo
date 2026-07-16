# Dojo CLI & Standalone Server - Especificación Técnica

Este directorio contiene las especificaciones técnicas para la construcción del ecosistema de línea de comandos de **Ninja Dojo / Jutsu Classroom**. 

El sistema está diseñado para permitir a los estudiantes interactuar con la plataforma (descargar laboratorios, enviar tareas, ver notas y feedback) directamente desde la terminal, con soporte tanto para el backend en la nube como para un servidor local autónomo (*standalone*) utilizado en entornos de examen controlados (sin acceso a internet).

---

## 🏗️ Arquitectura del Sistema

```mermaid
graph TD
    subgraph Cliente (Estudiante)
        CLI[Dojo CLI - Python]
    end

    subgraph Backend Cloud (Internet)
        Auth[Firebase Auth]
        API[Cloud Functions API]
        Store[Firestore & Storage]
    end

    subgraph Backend Local (Exámenes)
        Server[Standalone Server - Python]
        DB[SQLite / Local Files]
    end

    CLI -->|Modo Cloud| Auth
    CLI -->|Modo Cloud| API
    CLI -->|Modo Local / Examen| Server
```

El diseño de la CLI es **modular** y expone un cliente backend abstracto (`DojoClient`). Dependiendo del modo seleccionado en la configuración local (`cloud` o `standalone`), la CLI instanciará el driver correspondiente:
1. **CloudClient**: Autentica contra Firebase Auth y realiza llamadas REST seguras a las Cloud Functions de la plataforma.
2. **StandaloneClient**: Se conecta a una dirección IP de red local (ej. `http://10.0.0.5:8000`) para autenticar y realizar operaciones contra el servidor local de examen.

---

## 📁 Estructura de Especificaciones

*   [CLI_SPEC.md](file:///home/mrtin/dev/gaula/cli/CLI_SPEC.md): Especificación detallada de comandos, estructura del código fuente en Python, manejo de almacenamiento local (caché/sesión) y lógica de empaquetado de código con dependencias mínimas (Cero dependencias externas usando la librería estándar).
*   [SERVER_SPEC.md](file:///home/mrtin/dev/gaula/cli/SERVER_SPEC.md): Especificación técnica del servidor Standalone de exámenes en red local, detallando el almacenamiento de plantillas, esquema de SQLite para notas/asistencias, autenticación por Token/Matrícula y endpoints REST necesarios.
