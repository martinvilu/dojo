# Especificación Técnica: Dojo CLI

La aplicación de línea de comandos `dojo` permite a los estudiantes realizar todas las tareas de la cursada desde la terminal sin dependencias de librerías de terceros (cero pip requirements).

---

## 🎨 Principios de Diseño
1. **Cero Dependencias Externas**: Implementado en Python 3 (versión >= 3.8) utilizando únicamente la biblioteca estándar (`urllib.request` para APIs REST, `argparse` para parsing de comandos, `sqlite3` o archivos JSON para caché local de configuración, `zipfile` para empaquetar entregas).
2. **Abstracción del Cliente**: El núcleo del sistema interactúa con una interfaz `DojoBackend` abstracta, permitiendo el desacoplamiento total entre el modo en la nube (`CloudBackend`) y el modo local de exámenes (`StandaloneBackend`).
3. **Persistencia de Sesión Local**: La sesión del usuario y la configuración (modo actual, tokens de acceso y cursos seleccionados) se guardan localmente en un archivo cifrado o en formato JSON en `~/.dojo/config.json`.

---

## 💻 Comandos Soportados

| Comando | Descripción |
| :--- | :--- |
| `dojo config` | Configura el modo de trabajo (`cloud` / `standalone`), URLs del servidor y credenciales. |
| `dojo login` | Autentica al usuario en el backend activo y almacena la sesión. |
| `dojo courses` | Lista las materias/exámenes disponibles para el usuario. |
| `dojo select <course_id>` | Establece el curso activo en la sesión actual. |
| `dojo assignments` | Lista las tareas, laboratorios o exámenes publicados y su estado. |
| `dojo clone <assignment_id>` | Descarga la plantilla de código, la descomprime localmente y crea una carpeta de trabajo. |
| `dojo submit` | Comprime los archivos locales modificados (excluyendo git/node_modules) y los envía para calificar. |
| `dojo status <assignment_id>` | Muestra la nota, retroalimentación (feedback) del docente y logs del corrector automático. |

---

## 🏗️ Estructura del Proyecto de la CLI

```text
dojo-cli/
│
├── dojo.py                 # Punto de entrada de la CLI (Manejo de argumentos con argparse)
├── config.py               # Gestión de configuración de usuario en ~/.dojo/config.json
│
├── backend/
│   ├── __init__.py
│   ├── base.py             # Interfaz abstracta DojoBackend
│   ├── cloud.py            # Implementación para Firebase Auth / Cloud Functions
│   └── standalone.py       # Implementación para servidor local HTTP Standalone
│
└── utils/
    ├── __init__.py
    ├── zip.py              # Empaquetador de archivos con filtro de exclusión (.gitignore)
    └── http.py             # Cliente REST minimalista basado en urllib.request
```

---

## 📝 Planos de Código (Blueprints de Referencia)

### 1. `utils/http.py` (Cliente REST sin dependencias externas)
```python
import urllib.request
import urllib.error
import json
import ssl

class HttpClient:
    def __init__(self, base_url, token=None):
        self.base_url = base_url.rstrip('/')
        self.token = token
        # Bypassear verificación SSL si es en red local (standalone)
        self.ctx = ssl.create_default_context()
        self.ctx.check_hostname = False
        self.ctx.verify_mode = ssl.CERT_NONE

    def request(self, method, path, data=None, headers=None):
        url = f"{self.base_url}{path}"
        req_headers = {
            "Content-Type": "application/json",
            "User-Agent": "Dojo-CLI/1.0"
        }
        if self.token:
            req_headers["Authorization"] = f"Bearer {self.token}"
        if headers:
            req_headers.update(headers)
            
        payload = json.dumps(data).encode('utf-8') if data else None
        req = urllib.request.Request(url, data=payload, headers=req_headers, method=method)
        
        try:
            with urllib.request.urlopen(req, context=self.ctx, timeout=10) as response:
                res_data = response.read().decode('utf-8')
                return json.loads(res_data) if res_data else {}
        except urllib.error.HTTPError as e:
            err_content = e.read().decode('utf-8')
            try:
                err_json = json.loads(err_content)
                raise Exception(err_json.get("error", f"Error HTTP {e.code}"))
            except ValueError:
                raise Exception(f"Error {e.code}: {e.reason}")
        except Exception as e:
            raise Exception(f"Error de conexión: {str(e)}")
```

### 2. `backend/base.py` (Interfaz Base de Backend)
```python
from abc import ABC, abstractmethod

class DojoBackend(ABC):
    @abstractmethod
    def login(self, username_or_email, password) -> str:
        """Autentica y devuelve el token de sesión"""
        pass

    @abstractmethod
    def get_courses(self) -> list:
        """Devuelve cursos registrados"""
        pass

    @abstractmethod
    def get_assignments(self, course_id) -> list:
        """Devuelve tareas asociadas al curso"""
        pass

    @abstractmethod
    def download_template(self, assignment_id, output_path) -> bool:
        """Descarga el ZIP de la plantilla de trabajo"""
        pass

    @abstractmethod
    def submit_assignment(self, assignment_id, zip_file_bytes) -> dict:
        """Sube la entrega del estudiante y retorna el estado de recepción"""
        pass

    @abstractmethod
    def get_submission_status(self, assignment_id) -> dict:
        """Consulta notas y feedback de la tarea"""
        pass
```

### 3. `utils/zip.py` (Empaquetador inteligente de entregas)
```python
import os
import zipfile

def compress_workspace(source_dir, output_zip_path):
    # Cargar patrones de exclusión estándar
    exclusions = {".git", "node_modules", "__pycache__", ".next", ".env", ".vercel", "build", "dist"}
    
    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Filtrar directorios excluidos en caliente
            dirs[:] = [d for d in dirs if d not in exclusions]
            for file in files:
                if file.endswith('.zip') or file in exclusions:
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, source_dir)
                zipf.write(file_path, arcname)
```
