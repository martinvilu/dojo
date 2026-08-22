# 🥷 Ninja Dojo (Jutsu Classroom)

> **La plataforma de gestión educativa de próxima generación que fusiona la potencia de un LMS moderno, la integración LTI 1.3 con Moodle, la gamificación por rangos y el monitoreo de entregas en GitHub.**

---

## 🚀 Pitch del Sistema: ¿Qué es y qué hace Ninja Dojo?

**Ninja Dojo** (Jutsu Classroom) es una plataforma integral de gestión del aprendizaje y entorno educativo híbrido diseñada para transformar la experiencia universitaria y de educación técnica. Combina una interfaz reactiva, oscura y ultrarrápida con un robusto backend serverless en la nube.

A diferencia de los LMS tradicionales rígidos y complejos, Ninja Dojo conecta en tiempo real a **Estudiantes**, **Tutores Académicos**, **Docentes** y **Administradores** a través de herramientas colaborativas modernas, analítica predictiva de riesgo académico y una integración fluida con herramientas del mundo profesional como **GitHub**, **Moodle 4.2+** y **Google Workspace**.

---

### 🔥 Características Principales por Rol

#### 🎓 Experiencia del Estudiante
*   **Gamificación por Rango Ninja & XP**: Sistema de niveles y medallas de honor de cursada (*Maestro de Chakra*, *Asistencia Perfecta*, *Ninja Activo*, *Solucionador*) calculadas dinámicamente según asistencias, tareas entregadas a tiempo, promedio de notas y aportes en foros.
*   **Foros Q&A y Modo "Stack Overflow"**: Hilos de discusión por clase con reacciones emoji (👍, 🎉, ❤️) y la capacidad del docente de marcar la *Respuesta Correcta/Destacada*.
*   **Grupos de Estudio Auto-organizados**: Algoritmo de emparejamiento inteligente de compañeros según turnos y disponibilidad horaria.
*   **Módulo de Tutorías y Mentorías entre Pares**: Conexión con alumnos avanzados, reserva de horarios de consulta y generación automática de videollamadas en Google Meet.
*   **Certificados Digitales Verificables**: Emisión y descarga en 1 clic de constancias de alumno regular y actas de examen final con código de autenticidad en PDF.
*   **Sustrato de Calendarios (iCal / ICS)**: Suscripción mediante feeds iCal y exportación `.ics` para Google Calendar, Apple Calendar y Outlook.

#### 👨‍🏫 Experiencia Docente
*   **Presentismo por QR Dinámico + Geolocalización GPS**: Token de 6 caracteres que rota temporalmente con validación de proximidad GPS (<150m) en backend Cloud Functions.
*   **Alertas Tempranas de Desempeño**: Identificación automática en tiempo real de estudiantes en riesgo académico por asistencias críticas (<75%) o tareas atrasadas.
*   **Integración Bidireccional con Hojas de Cálculo (Sheets/Excel)**: Exportación en 1 clic de notas y asistencia a endpoints CSV nativos integrados en secciones desplegables.
*   **Tablero Kanban para Planificación Curricular**: Reorganización interactiva drag & drop de clases entre Teóricas, Prácticas, Feriados y Exámenes.
*   **Encuestas Estudiantiles Anónimas**: Sondeos rápidos (1-5 estrellas) sobre la marcha pedagógica y comprensión de contenidos.
*   **Espacio de Co-Docencia Coordinada**: Gestión de comisiones de estudiantes y asignación de docentes responsables por comisión.
*   **Reportes Académicos PDF**: Generación de reportes consolidados de cursada listos para imprimir o guardar.

#### 🎓 Integración Moodle 4.2+ & LTI 1.3
*   **Navegación LTI 1.3 Deep Linking a 6 Módulos**: Conexión directa desde Moodle hacia *Calendario*, *Actividades Individuales*, *Estado de Cursada*, *Tablero de Avisos*, *Tutorías* y *Grupos de Estudio*.
*   **Generador de Respaldos MBZ/XML Nativos**: Exportación e importación directa de la cátedra empaquetada en formato estándar `.mbz` de Moodle.
*   **Sincronización Web Services REST**: Importación de roster de alumnos, contenido de temas y envío masivo de notas de regreso a Moodle.

#### ⚙️ Administración e Infraestructura
*   **Control de Acceso Basado en Roles (RBAC)**: Gestión y conmutación de roles (**Estudiante**, **Tutor**, **Docente**, **Administrador**) desde el panel de control.
*   **Eliminación en Cascada de Usuarios**: Borrado seguro de credenciales Firebase Auth y perfiles de Firestore con diálogos de confirmación.
*   **Bitácora de Auditoría de Notas & Control de Versiones de Cronograma**: Registro histórico inmutable de calificaciones y snapshots de versiones curriculares.

---

## 🛠️ Stack Tecnológico

*   **Frontend**: Next.js (App Router, React 19, TypeScript), Vanilla CSS Design System modularizado (`BaseModal`, `AlertBadge`, `ToastNotification`), Tailwind CSS.
*   **Backend & Cloud**: Firebase Authentication, Cloud Firestore (con soporte IndexedDB offline), Cloud Functions (Node.js) y Firebase App Hosting (SSR).
*   **Calidad & Pruebas**: Batería E2E con **Selenium WebDriver (56 escenarios en 14 módulos)** y **Jest (74 unit tests)**.
*   **Estándares Abiertos**: LTI 1.3 Advantage (IMS Global), RFC 5545 iCalendar, Moodle 4.2 MBZ Backup.

---

## 💻 Requisitos Previos

* Node.js (v22+)
* Firebase CLI (`npm install -g firebase-tools`)
* Navegador Google Chrome / ChromeDriver (para ejecución de pruebas Selenium E2E)

---

## 🚀 Instalación y Desarrollo Local

1. **Clonar el repositorio e instalar dependencias**:
   ```bash
   npm install
   ```

2. **Instalar dependencias del Backend Cloud Functions**:
   ```bash
   cd functions
   npm install
   cd ..
   ```

3. **Iniciar el servidor de desarrollo local**:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en el navegador.

---

## 🧪 Ejecución de Pruebas Automatizadas

*   **Ejecutar Suite E2E con Selenium WebDriver (56 escenarios)**:
    ```bash
    npm run test:selenium
    ```
*   **Ejecutar Pruebas Unitarias del Backend Jest (74 pruebas)**:
    ```bash
    cd functions && npm test
    ```

---

## ☁️ Despliegue en Firebase

### 1. Despliegue de Reglas de Firestore y Cloud Functions

```bash
firebase login
firebase use tu-proyecto-id
firebase deploy --only functions,firestore
```

### 2. Despliegue de la Aplicación Web (Firebase App Hosting)

La plataforma utiliza **Firebase App Hosting** para renderizado del lado del servidor (SSR) mediante integración directa con GitHub:
1. Ir a la consola de Firebase > App Hosting.
2. Conectar el repositorio de GitHub.
3. Cada commit en la rama `main` compilará y desplegará automáticamente la nueva versión.

---

## 📚 Documentación del Sistema

Toda la documentación técnica y funcional del proyecto se encuentra organizada en `docs/` y `manual/`:

*   **[Roadmap y Plan de Mejoras](file:///home/mrtin/dev/gaula/docs/ROADMAP.md)**: Estado actual del sistema, batería de pruebas y propuestas de arquitectura.
*   **[Registro de Mejoras e Innovaciones](file:///home/mrtin/dev/gaula/MEJORAS.md)**: Historial completo de características e hitos completados.
*   **[Manual de Usuario](file:///home/mrtin/dev/gaula/manual/index.md)**: Guía detallada para [Docentes](file:///home/mrtin/dev/gaula/manual/docentes.md) y [Estudiantes](file:///home/mrtin/dev/gaula/manual/estudiantes.md).
*   **[Arquitectura y Diseño de Datos](file:///home/mrtin/dev/gaula/docs/ARCHITECTURE.md)**: Modelo de seguridad RBAC y colecciones de Firestore.
*   **[Diagramas UML](file:///home/mrtin/dev/gaula/docs/UML.md)**: Diagramas de Secuencia, ER y Casos de Uso.
*   **[Guía de Pruebas y Semillas](file:///home/mrtin/dev/gaula/docs/TESTING.md)**: Instrucciones para ejecutar las pruebas Selenium y Jest.
