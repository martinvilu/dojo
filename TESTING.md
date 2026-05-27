# Guía de Pruebas y Seed Data

Para validar el sistema localmente, utiliza los recursos automáticos de este repositorio.

## 🧪 Pruebas de Desarrollo

1.  **Levantar Entorno**: `npm run supabase:start` (Levanta Docker + Seed Data).
2.  **Resetear DB**: `npm run supabase:reset` (Limpia y reaplica todo).
3.  **Seguridad RLS**: `npm run test:db` (Verifica aislamiento de datos).

## 👤 Usuarios de Prueba (Seed)

El sistema incluye 3 usuarios pre-configurados. Inicia sesión con `email` y contraseña `password123`:

| Rol | Email | Propósito |
| :--- | :--- | :--- |
| **Admin** | `admin@gaula.com` | Crear materias, exportar/importar. |
| **Profesor** | `teacher@gaula.com` | Gestionar tareas, QR de asistencia y corrección. |
| **Estudiante** | `student@gaula.com` | Aceptar tareas y escanear asistencia. |

## 📡 Simulación de Asistencia QR
Para probar el escáner:
1. Abre el dashboard de **Profesor** y haz clic en "Generate QR" en la sección de Attendance.
2. El QR se actualizará cada 10 segundos.
3. Abre el dashboard de **Estudiante** (preferiblemente en un móvil o modo móvil de Chrome) y ve a "Scan QR".
4. La cámara capturará el token dinámico y validará contra la Edge Function.

## 🛠️ Validación de Integración GitHub
Para que los tests de creación de repos funcionen localmente, debes setear tu token en los secretos locales:
```bash
supabase secrets set --local GITHUB_ACCESS_TOKEN=tu_pat_aqui
```
