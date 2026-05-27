# Guía de Pruebas Locales

Para probar el proyecto Gaula Classroom localmente, sigue estos pasos:

## 1. Levantar el entorno de Supabase
Asegúrate de tener Docker instalado y la CLI de Supabase.

```bash
npm run supabase:start
```
Esto levantará la base de datos, las funciones y el auth. Al finalizar, la base de datos se poblará automáticamente con los datos de prueba definidos en `supabase/seed.sql`.

## 2. Ejecutar Pruebas de Base de Datos (RLS)
Para verificar que las políticas de seguridad funcionan correctamente:

```bash
npm run test:db
```

## 3. Ejecutar Pruebas de Edge Functions
Para probar la lógica de integración con GitHub:

```bash
npm run test:functions
```

## 4. Probar el Frontend
Inicia el servidor local para ver los dashboards:

```bash
npm start
```
Luego abre `http://localhost:3000`.

### Usuarios de Prueba (Seed)
Puedes usar estos IDs de usuario en el panel de Supabase para simular diferentes roles:
- **Admin**: `00000000-0000-0000-0000-000000000001`
- **Teacher**: `00000000-0000-0000-0000-000000000002`
- **Student**: `00000000-0000-0000-0000-000000000003`

---
**Nota**: Para las pruebas de GitHub, recuerda configurar tu token localmente:
`supabase secrets set GITHUB_ACCESS_TOKEN=tu_token`
