# Documentación UML - Jutsu Classroom

Este documento detalla la estructura lógica, los casos de uso y las interacciones dinámicas del sistema utilizando diagramas en formato **Mermaid**.

---

## 1. Diagrama de Casos de Uso del Sistema (Use Cases)

Representa las interacciones entre los diferentes actores de la plataforma (Administrador, Profesor, Ayudante, Estudiante) y sus respectivos casos de uso dentro del sistema.

```mermaid
graph TD
    %% Actors
    Admin((Administrador))
    Teacher((Profesor))
    Assistant((Ayudante de Cátedra))
    Student((Estudiante))

    %% Admin Use Cases
    UC_AdminUsers(Administrar Usuarios y Cambiar Roles)
    UC_AdminCourses(Crear y Administrar Cátedras)
    UC_AssignTeacher(Asignar Profesores/Ayudantes a Cátedras)
    UC_GlobalSettings(Configurar Parámetros Globales)

    Admin --> UC_AdminUsers
    Admin --> UC_AdminCourses
    Admin --> UC_AssignTeacher
    Admin --> UC_GlobalSettings

    %% Teacher Use Cases
    UC_CourseSettings(Configurar Cátedra: Fechas, Meet, Repo Base)
    UC_Schedule(Regenerar y Guardar Cronograma de Clases)
    UC_Announcements(Publicar Avisos Generales)
    UC_CheckAcks(Ver Acuses de Recepción de Avisos)
    UC_Assignments(Crear y Administrar Tareas)
    UC_Grades(Revisar y Calificar Entregas de Alumnos)

    Teacher --> UC_CourseSettings
    Teacher --> UC_Schedule
    Teacher --> UC_Announcements
    Teacher --> UC_CheckAcks
    Teacher --> UC_Assignments
    Teacher --> UC_Grades

    %% Assistant Use Cases
    Assistant --> UC_Schedule
    Assistant --> UC_Announcements
    Assistant --> UC_CheckAcks
    Assistant --> UC_Grades

    %% Student Use Cases
    UC_Enroll(Inscribirse a Cátedra por Código)
    UC_SubmitMatricula(Completar Registro con Matrícula UNRN)
    UC_ViewSchedule(Ver Cronograma, Asistencia y Materiales)
    UC_SubmitAssignment(Realizar Entregas de Tareas)
    UC_AckAnnouncement(Confirmar Recepción de Avisos)

    Student --> UC_Enroll
    Student --> UC_SubmitMatricula
    Student --> UC_ViewSchedule
    Student --> UC_SubmitAssignment
    Student --> UC_AckAnnouncement
```

---

## 2. Diagrama de Estructura de Datos (Class Diagram - Firestore ERD)

Muestra los modelos y colecciones almacenadas en Cloud Firestore, simulando un diagrama de clases / entidad-relación y definiendo las claves y asociaciones entre colecciones.

```mermaid
classDiagram
    class Profile {
        +String uid
        +String full_name
        +String email
        +String role
        +String account_status
        +String matricula_unrn
    }
    class Course {
        +String id
        +String name
        +String github_org
        +String start_date
        +int duration_weeks
        +String invite_code
        +String teacher_invite_code
        +String assistant_invite_code
        +String cover_text
        +List~ClassInstance~ class_instances
        +List~String~ external_calendars
        +String github_token
        +List~ScheduleRule~ schedules
    }
    class CourseTeacher {
        +String course_id
        +String teacher_id
        +String role
    }
    class CourseRoster {
        +String course_id
        +String student_id
        +Timestamp enrolled_at
    }
    class Enrollment {
        +String course_id
        +String student_id
        +Timestamp enrolled_at
    }
    class Announcement {
        +String id
        +String course_id
        +String message
        +String teacher_id
        +Timestamp created_at
    }
    class AnnouncementAcknowledgment {
        +String announcement_id
        +String student_id
        +Timestamp acknowledged_at
    }
    class Assignment {
        +String id
        +String course_id
        +String title
        +String description
        +String due_date
        +boolean is_group
    }
    class Submission {
        +String id
        +String assignment_id
        +String student_id
        +String repo_url
        +String feedback
        +String grade
        +Timestamp submitted_at
    }

    Profile "1" -- "0..*" CourseTeacher : is assigned
    Profile "1" -- "0..*" CourseRoster : is enrolled
    Profile "1" -- "0..*" Enrollment : is enrolled (legacy)
    Course "1" -- "0..*" CourseTeacher : has teachers
    Course "1" -- "0..*" CourseRoster : has students
    Course "1" -- "0..*" Enrollment : has students (legacy)
    Course "1" -- "0..*" Announcement : publishes
    Announcement "1" -- "0..*" AnnouncementAcknowledgment : has acknowledgments
    Profile "1" -- "0..*" AnnouncementAcknowledgment : acknowledges
    Course "1" -- "0..*" Assignment : contains
    Assignment "1" -- "0..*" Submission : receives
    Profile "1" -- "0..*" Submission : submits
```

---

## 3. Diagrama de Secuencia: Flujo de Avisos con Acuse de Recepción

Describe el ciclo de vida y la interacción dinámica entre el **Docente**, el **Estudiante**, el **Frontend** y el **Backend (Cloud Functions + Firestore)** para la publicación de avisos y su correspondiente firma digital de lectura.

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Docente
    actor Student as Estudiante
    participant Frontend as Cliente Web (Next.js)
    participant Functions as Firebase Cloud Functions
    participant Firestore as Base de Datos (Firestore)

    %% 1. Publicar Aviso
    Teacher->>Frontend: Escribe aviso y presiona "Enviar Aviso"
    Frontend->>Functions: api("createAnnouncement", { course_id, message })
    Functions->>Firestore: Escribe documento en /announcements
    Firestore-->>Functions: Confirmación
    Functions-->>Frontend: { success: true }
    Frontend-->>Teacher: Notifica "Aviso enviado a la cátedra."

    %% 2. Estudiante visualiza aviso
    Student->>Frontend: Entra al panel de la cátedra
    Frontend->>Functions: api("getStudentAnnouncements", { courseIds })
    Functions->>Firestore: Consulta avisos de las cátedras
    Firestore-->>Functions: Lista de avisos
    Functions->>Firestore: Comprueba acuses para cada aviso (/announcement_acknowledgments)
    Firestore-->>Functions: Estado de acuse
    Functions-->>Frontend: Lista de avisos (con propiedad "acknowledged")
    Frontend-->>Student: Renderiza aviso y muestra botón "Confirmar Recepción"

    %% 3. Estudiante confirma lectura
    Student->>Frontend: Presiona "Confirmar Recepción"
    Frontend->>Functions: api("acknowledgeAnnouncement", { announcementId })
    Functions->>Firestore: Crea documento en /announcement_acknowledgments (ID: announcementId_studentId)
    Firestore-->>Functions: Confirmación
    Functions-->>Frontend: { success: true }
    Frontend-->>Student: Cambia vista a "Acuse de recepción confirmado ✓"

    %% 4. Docente inspecciona lecturas
    Teacher->>Frontend: Presiona "Ver Acuses de Recepción"
    Frontend->>Functions: api("getAnnouncementAcknowledgements", { announcementId })
    Functions->>Firestore: Consulta documentos en /announcement_acknowledgments (where announcement_id)
    Firestore-->>Functions: Lista de acuses
    Functions->>Firestore: Recupera perfiles de los estudiantes confirmados (/profiles)
    Firestore-->>Functions: Perfiles de estudiantes
    Functions-->>Frontend: Lista de confirmados con datos de perfil y fecha
    Frontend-->>Teacher: Despliega listado de alumnos y marcas de tiempo
```
