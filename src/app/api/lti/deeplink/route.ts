import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let returnUrl = "";
    let opaqueData = "";
    let courseId = "global";
    let selectedModule = "";

    const requestUrl = new URL(request.url);
    if (requestUrl.searchParams.get("courseId")) {
      courseId = requestUrl.searchParams.get("courseId")!;
    }
    if (requestUrl.searchParams.get("selectedModule")) {
      selectedModule = requestUrl.searchParams.get("selectedModule")!;
    }

    if (contentType.includes("form") || contentType.includes("multipart")) {
      const formData = await request.formData();
      const idToken = formData.get("id_token") as string;
      returnUrl = (formData.get("deep_link_return_url") || formData.get("content_item_return_url") || "") as string;
      opaqueData = (formData.get("data") || "") as string;
      if (formData.get("selectedModule")) {
        selectedModule = formData.get("selectedModule") as string;
      }

      if (idToken) {
        const tokenParts = idToken.split(".");
        if (tokenParts.length >= 2) {
          try {
            const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf-8"));
            const dlSettings = payload["https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings"] || {};
            if (dlSettings.deep_link_return_url) {
              returnUrl = dlSettings.deep_link_return_url;
            }
            if (dlSettings.data) {
              opaqueData = dlSettings.data;
            }
            const customParams = payload["https://purl.imsglobal.org/spec/lti/claim/custom"] || {};
            courseId = customParams.courseId || customParams.course_id || courseId;
          } catch (e) {
            console.error("Error decoding LTI id_token:", e);
          }
        }
      }
    }

    const baseUrl = getBaseUrl(request);

    // Map modules catalog
    const moduleCatalog: Record<string, { title: string; text: string; target: string }> = {
      calendar: {
        title: "📅 Calendario y Cronograma de Cátedra",
        text: "Acceso al calendario interactivo, cronograma de clases y eventos de la cursada.",
        target: "calendar"
      },
      status: {
        title: "📊 Estado de Cursada, Asistencia y Alertas",
        text: "Panel de control de porcentaje de presentismo, entregas y alertas tempranas.",
        target: "status"
      },
      announcements: {
        title: "📢 Tablero de Avisos y Novedades",
        text: "Novedades oficiales, anuncios de la cátedra e información importante.",
        target: "announcements"
      },
      tutoring: {
        title: "🤝 Módulo de Tutorías y Mentorías Académicas",
        text: "Espacio para solicitar mentorías entre pares y consultas académicas.",
        target: "tutoring"
      },
      groups: {
        title: "👥 Grupos de Estudio y Emparejamiento",
        text: "Organización de equipos de estudio y formación de grupos por afinidad horaria.",
        target: "groups"
      },
      activities: {
        title: "📝 Actividades e Integraciones Individuales",
        text: "Gestión de tareas individuales y proyectos de la cursada.",
        target: "activities"
      }
    };

    // IF AN ITEM HAS BEEN SELECTED BY TEACHER
    if (selectedModule && moduleCatalog[selectedModule]) {
      const itemConfig = moduleCatalog[selectedModule];
      const targetUrl = `${baseUrl}/api/lti/launch?targetModule=${itemConfig.target}&courseId=${courseId}`;

      const contentItemsPayload = {
        "@context": "http://purl.imsglobal.org/ctx/lti/v1/ContentItem",
        "@graph": [
          {
            "@type": "LtiLinkItem",
            "@id": targetUrl,
            "url": targetUrl,
            "title": itemConfig.title,
            "text": itemConfig.text,
            "mediaType": "application/vnd.ims.lti.v1.ltilink",
            "custom": {
              "targetModule": itemConfig.target,
              "courseId": courseId
            }
          }
        ]
      };

      const contentItemsJson = JSON.stringify(contentItemsPayload);

      // Return auto-submitting HTML form to Moodle's return URL
      if (returnUrl) {
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ninja Dojo LTI Deep Linking</title>
</head>
<body style="background:#0a0a0a; color:white; font-family:sans-serif; text-align:center; padding:40px;">
  <h2>Enviando selección a Moodle...</h2>
  <form id="lti-return-form" action="${escapeHtml(returnUrl)}" method="POST">
    <input type="hidden" name="content_items" value="${escapeHtml(contentItemsJson)}" />
    <input type="hidden" name="data" value="${escapeHtml(opaqueData)}" />
    <input type="hidden" name="lti_message_type" value="ContentItemSelection" />
    <input type="hidden" name="lti_version" value="LTI-1p0" />
    <button type="submit" style="background:#2563eb; color:white; padding:10px 20px; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Confirmar Selección</button>
  </form>
  <script>
    document.getElementById("lti-return-form").submit();
  </script>
</body>
</html>`;
        return new NextResponse(html, {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // If no return URL, return standard JSON response
      return NextResponse.json(contentItemsPayload);
    }

    // IF TEACHER IS BROWSING SELECTION UI IN MOODLE IFRAME
    const htmlUI = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Ninja Dojo - Selector de Contenido LTI 1.3</title>
  <style>
    body { background: #0a0a0a; color: #f5f5f5; font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 20px; }
    .header { text-align: center; margin-bottom: 24px; }
    .header h1 { font-size: 20px; margin: 0; color: #60a5fa; }
    .header p { font-size: 12px; color: #a3a3a3; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; max-width: 900px; margin: 0 auto; }
    .card { background: #171717; border: 1px solid #262626; border-radius: 14px; padding: 16px; cursor: pointer; transition: all 0.2s ease; text-align: left; }
    .card:hover { border-color: #3b82f6; background: #1e1e1e; transform: translateY(-2px); }
    .card h3 { font-size: 14px; font-weight: bold; margin: 0 0 6px 0; color: #ffffff; }
    .card p { font-size: 11px; color: #a3a3a3; margin: 0 0 14px 0; line-height: 1.4; }
    .btn-select { display: inline-block; background: #2563eb; color: white; border: none; padding: 6px 12px; font-size: 11px; font-weight: bold; border-radius: 8px; cursor: pointer; }
    .btn-select:hover { background: #3b82f6; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🥷 Ninja Dojo (Jutsu Classroom)</h1>
    <p>Seleccioná el módulo que deseas integrar en esta sección del curso de Moodle:</p>
  </div>

  <div class="grid">
    <div class="card" onclick="selectItem('calendar')">
      <h3>📅 Calendario y Cronograma de Cátedra</h3>
      <p>Acceso al calendario interactivo, cronograma de clases y eventos síncronos de la cursada.</p>
      <button type="button" class="btn-select">Agregar Módulo LTI</button>
    </div>

    <div class="card" onclick="selectItem('status')">
      <h3>📊 Estado de Cursada, Asistencia y Alertas</h3>
      <p>Panel de control de porcentaje de presentismo, entregas y alertas tempranas de riesgo académico.</p>
      <button type="button" class="btn-select">Agregar Módulo LTI</button>
    </div>

    <div class="card" onclick="selectItem('announcements')">
      <h3>📢 Tablero de Avisos y Novedades</h3>
      <p>Novedades oficiales, anuncios de la cátedra e información importante de comunicación.</p>
      <button type="button" class="btn-select">Agregar Módulo LTI</button>
    </div>

    <div class="card" onclick="selectItem('tutoring')">
      <h3>🤝 Módulo de Tutorías y Mentorías Académicas</h3>
      <p>Espacio para solicitar mentorías entre pares y consultas académicas con tutores habilitados.</p>
      <button type="button" class="btn-select">Agregar Módulo LTI</button>
    </div>

    <div class="card" onclick="selectItem('groups')">
      <h3>👥 Grupos de Estudio y Emparejamiento</h3>
      <p>Organización de equipos de estudio y formación de grupos por coincidencia horaria.</p>
      <button type="button" class="btn-select">Agregar Módulo LTI</button>
    </div>

    <div class="card" onclick="selectItem('activities')">
      <h3>📝 Actividades e Integraciones Individuales</h3>
      <p>Gestión de entregas de tareas individuales, repositorios de GitHub y calificaciones.</p>
      <button type="button" class="btn-select">Agregar Módulo LTI</button>
    </div>
  </div>

  <form id="selection-form" action="${baseUrl}/api/lti/deeplink" method="POST" style="display:none;">
    <input type="hidden" name="selectedModule" id="selectedModule" value="" />
    <input type="hidden" name="deep_link_return_url" value="${escapeHtml(returnUrl)}" />
    <input type="hidden" name="data" value="${escapeHtml(opaqueData)}" />
    <input type="hidden" name="courseId" value="${escapeHtml(courseId)}" />
  </form>

  <script>
    function selectItem(modKey) {
      document.getElementById("selectedModule").value = modKey;
      document.getElementById("selection-form").submit();
    }
  </script>
</body>
</html>`;

    return new NextResponse(htmlUI, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Error procesando LTI Deep Link selection: " + error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

function escapeHtml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#039;';
      default: return c;
    }
  });
}
