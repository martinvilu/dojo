# Especificación Técnica: Servidor Standalone de Exámenes

El servidor *standalone* de exámenes está diseñado para ejecutarse localmente en la máquina del docente (por ejemplo, en laboratorios sin conexión externa) y actuar como el backend del sistema para el Dojo CLI de los estudiantes.

---

## 🎨 Principios de Diseño
1. **Instalación Cero**: Implementado en Python 3 utilizando la biblioteca estándar (`http.server` o `wsgiref`, `sqlite3`, `json`, `hashlib`, `uuid`). No requiere instalar frameworks como Flask o FastAPI.
2. **Autónomo y Portable**: Toda la información de alumnos, exámenes, entregas y estado de presentismo se almacena en una única base de datos SQLite local (`exam.db`).
3. **Distribución Local de Archivos**: Almacena las plantillas de código (`.zip`) en una carpeta local y recibe las entregas de los estudiantes almacenándolas ordenadamente por matrícula/cohorte.

---

## 💾 Esquema de Base de Datos (SQLite)

```sql
-- 1. Tabla de Estudiantes/Usuarios
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,               -- UID autogenerado o matrícula
    matricula TEXT UNIQUE NOT NULL,    -- Código UNRN / DNI
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,       -- Hash SHA-256 de contraseña
    cohorte TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Exámenes/Tareas
CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    template_filename TEXT,            -- Nombre del archivo ZIP de la plantilla en el disco
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabla de Entregas (Submissions)
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    assignment_id TEXT NOT NULL,
    zip_filename TEXT NOT NULL,        -- Ruta al ZIP entregado por el estudiante
    grade TEXT,                        -- Calificación (Aprobado/Desaprobado/Nota)
    feedback TEXT,                     -- Comentarios del docente
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(assignment_id) REFERENCES assignments(id),
    UNIQUE(student_id, assignment_id)  -- Una sola entrega activa por alumno por examen
);

-- 4. Tabla de Asistencia Local (Opcional)
CREATE TABLE IF NOT EXISTS local_attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    class_number INTEGER NOT NULL,
    status TEXT NOT NULL,              -- 'present', 'late', 'absent'
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(id),
    UNIQUE(student_id, class_number)
);
```

---

## 📂 Endpoints REST Implementados

| Método | Endpoint | Descripción | Payload |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/login` | Autentica un alumno. Devuelve JWT ficticio (token UUID). | `{"matricula": "...", "password": "..."}` |
| `GET` | `/api/assignments` | Lista todos los exámenes publicados en el servidor. | *Ninguno (con Token de Auth)* |
| `GET` | `/api/assignments/download?id=<id>` | Descarga el archivo ZIP de plantilla. | *Parámetro de query* |
| `POST` | `/api/assignments/submit` | Sube la entrega de un estudiante. | *Multipart-form o JSON con bytes codificados en Base64* |
| `GET` | `/api/submissions/status` | Obtiene la corrección y notas de las entregas del alumno. | *Ninguno (con Token de Auth)* |

---

## 📝 Plano de Código: `server.py` (Servidor con Biblioteca Estándar)

A continuación se muestra el esqueleto de un servidor HTTP local en Python con cero dependencias externas:

```python
import http.server
import json
import sqlite3
import urllib.parse
import os
import hashlib
import uuid

DB_FILE = "exam.db"
STORAGE_DIR = "./storage"
os.makedirs(STORAGE_DIR, exist_ok=True)

class ExamServerHandler(http.server.BaseHTTPRequestHandler):
    def _send_response(self, status, data, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        if content_type == "application/json":
            self.wfile.write(json.dumps(data).encode('utf-8'))
        else:
            self.wfile.write(data)

    def do_OPTIONS(self):
        # Soporte CORS para desarrollo local
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = urllib.parse.parse_qs(parsed_url.query)

        # Autenticación simple mediante cabecera Authorization (Bearer Token)
        auth_header = self.headers.get("Authorization", "")
        token = auth_header.replace("Bearer ", "").strip() if auth_header else None

        if path == "/api/assignments":
            if not token:
                return self._send_response(401, {"error": "No autorizado"})
            # Listar tareas desde SQLite
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT id, title, description, due_date FROM assignments")
            rows = cursor.fetchall()
            conn.close()
            
            assignments = [{"id": r[0], "title": r[1], "description": r[2], "due_date": r[3]} for r in rows]
            return self._send_response(200, assignments)

        elif path == "/api/assignments/download":
            assign_id = query.get("id", [None])[0]
            if not assign_id:
                return self._send_response(400, {"error": "Falta ID de examen"})
                
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT template_filename FROM assignments WHERE id = ?", (assign_id,))
            row = cursor.fetchone()
            conn.close()
            
            if not row or not row[0]:
                return self._send_response(404, {"error": "Plantilla no encontrada"})
                
            file_path = os.path.join(STORAGE_DIR, row[0])
            if not os.path.exists(file_path):
                return self._send_response(404, {"error": "Archivo físico no encontrado"})
                
            with open(file_path, 'rb') as f:
                file_bytes = f.read()
            return self._send_response(200, file_bytes, content_type="application/zip")

        else:
            self._send_response(404, {"error": "Ruta no encontrada"})

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length).decode('utf-8')
        
        try:
            body = json.loads(post_data) if post_data else {}
        except ValueError:
            return self._send_response(400, {"error": "JSON inválido"})

        if self.path == "/api/login":
            matricula = body.get("matricula")
            password = body.get("password")
            
            if not matricula or not password:
                return self._send_response(400, {"error": "Matrícula y clave requeridas"})
                
            # Verificar en SQLite
            pw_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            cursor.execute("SELECT id, full_name FROM students WHERE matricula = ? AND password_hash = ?", (matricula, pw_hash))
            student = cursor.fetchone()
            conn.close()
            
            if student:
                # Generar token aleatorio ficticio (para el SQLite o sesión en memoria)
                session_token = str(uuid.uuid4())
                return self._send_response(200, {
                    "token": session_token,
                    "student": {"id": student[0], "name": student[1]}
                })
            else:
                return self._send_response(401, {"error": "Matrícula o clave incorrectas"})

        elif self.path == "/api/assignments/submit":
            auth_header = self.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "").strip() if auth_header else None
            if not token:
                return self._send_response(401, {"error": "No autorizado"})
                
            # En la versión base64: {"assignmentId": "...", "filename": "...", "contentBase64": "..."}
            assign_id = body.get("assignmentId")
            filename = body.get("filename")
            content_b64 = body.get("contentBase64")
            
            if not assign_id or not content_b64:
                return self._send_response(400, {"error": "Payload incompleto"})
                
            import base64
            try:
                file_data = base64.b64decode(content_b64)
            except Exception:
                return self._send_response(400, {"error": "Base64 inválido"})

            # Guardar en storage local
            local_filename = f"submit_{token}_{assign_id}_{filename}"
            save_path = os.path.join(STORAGE_DIR, local_filename)
            with open(save_path, 'wb') as f:
                f.write(file_data)

            # Registrar entrega en base de datos
            conn = sqlite3.connect(DB_FILE)
            cursor = conn.cursor()
            try:
                # Resolver token de sesión a student_id
                # En producción, usar una tabla de sesiones para mapear tokens
                student_id = token  # Simulación
                cursor.execute(
                    "INSERT OR REPLACE INTO submissions (id, student_id, assignment_id, zip_filename) VALUES (?, ?, ?, ?)",
                    (str(uuid.uuid4()), student_id, assign_id, local_filename)
                )
                conn.commit()
            except Exception as e:
                conn.close()
                return self._send_response(500, {"error": f"Error base de datos: {str(e)}"})
            conn.close()

            return self._send_response(200, {"status": "success", "message": "Entrega recibida correctamente"})

        else:
            self._send_response(404, {"error": "Ruta no encontrada"})

def run_server(port=8000):
    # Inicializar Base de Datos en el arranque
    conn = sqlite3.connect(DB_FILE)
    # Ejecutar comandos de creación de esquemas
    conn.close()
    
    server_address = ('', port)
    httpd = http.server.HTTPServer(server_address, ExamServerHandler)
    print(f"Servidor Standalone de Exámenes corriendo en el puerto {port}...")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()
```
