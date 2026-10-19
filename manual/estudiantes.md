# 🎓 Manual del Estudiante

Todo lo que necesitás para cursar con Jutsu Classroom: inscribirte, firmar asistencia, entregar trabajos prácticos y aprovechar los foros, los grupos de estudio y las tutorías.

```{important}
Antes de aceptar tu primera tarea, cargá tu **Usuario de GitHub** en **Mi Perfil**. Sin él no se puede crear tu repositorio. Ver [Primeros pasos](primeros-pasos.md).
```

---

## 1. Inscribirte en una cátedra

1. En la barra lateral, abrí **Mis Cátedras**.
2. En **Código Cátedra**, escribí el código de 6 caracteres que te dio el docente.
3. Presioná **Unirse**.

La materia aparece como una tarjeta con tres botones:

- **Ingresar**: abre la cátedra.
- **Calendario**: abre el calendario filtrado por esa materia.
- **Asistencia QR**: abre el escáner para firmar el presente.

## 2. Firmar asistencia

Durante la clase, el docente proyecta un código QR con un código de 6 caracteres debajo.

1. Abrí **Escanear QR** en la barra lateral (o **Asistencia QR** en la tarjeta de la materia).
2. Permití el acceso a la **cámara** y a la **ubicación** cuando el navegador lo pida.
3. Apuntá al QR. Si la cámara no funciona, escribí el código a mano (ej. `A1B2C3`).
4. Confirmá. Cada presente suma **10 XP**.

```{warning}
La asistencia se rechaza si:
- el código ya venció: el QR cambia cada 15 segundos y cada código vale como máximo 30 segundos;
- el docente generó el QR con ubicación y no compartiste la tuya, o estás a más de **150 metros** del aula;
- no estás inscripto en esa cátedra;
- el código corresponde a otra clase o no hay un QR activo en ese momento.
```

Si tenés varias cámaras, elegí la trasera en **Cámara seleccionada**.

## 3. Cronograma, materiales y foro de cada clase

En la pestaña **Cronograma** de la cátedra ves todas las clases con su fecha, tema y tipo. Las clases pasadas se marcan como **Finalizada**.

En cada clase podés:

- Abrir el **Material de Clase ↗** y la **Video Grabación ↗**.
- Abrir **💬 Preguntar en GitHub Discussions ↗**, si la cátedra lo usa.
- Responder la encuesta **✍️ Feedback Anónimo**: valoración de 1 a 5, nivel de comprensión y un comentario opcional. Es anónima: el sistema evita duplicados sin guardar tu identidad.
- Participar en el **Foro de Consultas**: escribí en **Nuevo comentario**, reaccioná a las respuestas de otros y fijate cuál marcó el docente como **✔️ Solución**. Tus propios mensajes los podés **Editar** (quedan marcados como «editado») o **Borrar**.

Con **📅 Suscribirse a Calendario** obtenés una URL para agregar el cronograma a tu calendario (ver §6).

## 4. Trabajos prácticos con GitHub

### 4.1. Aceptar la tarea

1. Abrí la pestaña **Tareas**.
2. En la tarea, presioná **Aceptar Tarea en GitHub**.
3. Si es **Grupal**, escribí el **Nombre del Equipo** y confirmá.
4. Se crea tu repositorio privado en la organización de la materia a partir de la plantilla del docente, y quedás como colaborador.

```{note}
En las tareas grupales, hoy cada integrante recibe su propio repositorio: el nombre de equipo no se usa para agruparlos. Acordá con el docente en qué repositorio trabaja el equipo; sumar a tus compañeros como colaboradores se hace desde GitHub, con permisos de administración sobre la organización.
```

### 4.2. Trabajar

```bash
git clone https://github.com/<organizacion>/<tu-repositorio>.git
cd <tu-repositorio>
# ... programá ...
git add .
git commit -m "feat: resuelvo el ejercicio 1"
git push origin main
```

La plataforma sigue tus commits y pull requests. Desde la tarea podés abrir **Ver mi repositorio en GitHub ↗** y **🔍 Ver Commits**.

### 4.3. Entregar

1. Presioná **🚀 Marcar como Entregado**.
2. Si querés, dejale un comentario al docente.
3. Presioná **Enviar Entrega**. El estado pasa a **Entregado para Corrección**.

Cuando el docente corrige, en la tarea aparecen la **Nota** (0 a 10, o conceptual como «Aprobado») y el **Feedback**.

### 4.4. Portafolio público

En una entrega, **🌐 Publicar en Portafolio** la agrega a tu portafolio público, visible sin iniciar sesión en `/p/<tu-id>`. El enlace está en **Mi Perfil → 🌐 Portafolio Público de Proyectos**. Para retirarla, presioná **🌐 En Portafolio** otra vez.

### 4.5. Revisión entre pares

Si el docente activó la revisión entre pares en una tarea, en **👥 Revisión entre Pares** aparecen las entregas de 2 compañeros para revisar:

1. Puntuá cada criterio de la rúbrica (de 0 al máximo indicado).
2. Dejá un comentario constructivo (opcional).
3. Presioná **Enviar Revisión**.

La revisión es anónima: tu compañero ve el promedio por criterio y los comentarios, pero no quién los escribió.

## 5. Avisos

En **Avisos** ves los comunicados de la cátedra. Presioná **Confirmar Recepción** en cada uno: el docente ve quién lo leyó y cuándo.

## 6. Calendario

**Calendario Global** reúne clases, exámenes, feriados y fechas de entrega de todas tus materias.

- **Materias**: elegí qué cátedras mostrar (**Todas** / **Ninguna** o una por una).
- **Vista Mensual** / **Vista Semanal** y **◀ Anterior** / **Siguiente ▶** para navegar.
- Hacé clic en un evento para ver el detalle, la **🎥 Grabación de la clase** y los **🔖 Marcadores Temporales**. Podés agregar los tuyos con el minuto (ej. `12:45`) y un tema, y presionar **+ Agregar**.

Para llevar el calendario a tu teléfono:

- **📥 Exportar .ics**: descarga un archivo para importar en Google Calendar, Apple Calendar u Outlook. Es una foto del momento: no se actualiza solo.
- **📅 Añadir a Google Calendar** o la URL de **📅 Suscribirse a Calendario**: suscripción que se actualiza sola cuando el docente cambia el cronograma.

## 7. Rango Ninja y medallas

Al entrar a una cátedra ves tu tarjeta de **Rango Ninja de Cursada**:

| Acción | XP |
|---|---|
| Comentario en el foro | 10 |
| Respuesta marcada como solución | 100 |
| Presente | 10 |
| Entrega | 50 + 5 × nota |

Cada 100 XP subís un nivel: **Genin** (niveles 1–2), **Chūnin** (3–4) y **Jōnin** (5 en adelante).

| Medalla | Cómo se gana |
|---|---|
| 🥇 Maestro de Chakra | Promedio de notas de 9 o más |
| 🥈 Asistencia Perfecta | Presente en todas las clases registradas (mínimo 3) |
| 🥉 Ninja Activo | 3 o más comentarios en los foros |
| 🎖️ Solucionador | Al menos una respuesta marcada como solución |

**📜 Ver bitácora XP ↗** abre el historial en **Mi Perfil**.

## 8. Grupos de estudio

En la pestaña **👥 Grupos de Estudio**:

- **✨ Crear Nuevo Grupo**: nombre, objetivo y horario preferido (mañana, tarde, noche o fines de semana).
- **Unirme al Grupo** / **Abandonar Grupo** en los grupos existentes.
- **🔍 Emparejamiento Inteligente**: elegí tu **preferencia horaria** y buscá compañeros que estudien en tus mismos horarios.

## 9. Tutorías entre pares

En la pestaña **🎓 Tutorías**:

- **Reservar Mentoría**: elegí un tutor, contá el **tema de la consulta** y proponé **fecha y hora**. Cuando el tutor acepta, aparece **🎥 Entrar a Sala Virtual** en **📅 Mis Tutorías y Mentorías**.
- **🤝 Postularme como Tutor**: indicá tus **temas fuertes** y tu **disponibilidad horaria**. Las reservas que recibas se **aceptan** o **rechazan** desde **Mis Tutorías y Mentorías**.
