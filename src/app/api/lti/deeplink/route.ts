import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let courseId = "global";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";

    if (contentType.includes("form") || contentType.includes("multipart")) {
      const formData = await request.formData();
      const idToken = formData.get("id_token") as string;
      if (idToken) {
        const tokenParts = idToken.split(".");
        if (tokenParts.length >= 2) {
          try {
            const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf-8"));
            const customParams = payload["https://purl.imsglobal.org/spec/lti/claim/custom"] || {};
            courseId = customParams.courseId || customParams.course_id || courseId;
          } catch (e) {}
        }
      }
    }

    const { searchParams } = new URL(request.url);
    if (searchParams.get("courseId")) {
      courseId = searchParams.get("courseId")!;
    }

    const deepLinkItems = [
      {
        type: "ltiResourceLink",
        title: "📅 Calendario y Cronograma de Cátedra",
        url: `${origin}/api/lti/launch?targetModule=calendar&courseId=${courseId}`,
        custom: { targetModule: "calendar", courseId }
      },
      {
        type: "ltiResourceLink",
        title: "📊 Estado de Cursada, Asistencias y Alertas",
        url: `${origin}/api/lti/launch?targetModule=status&courseId=${courseId}`,
        custom: { targetModule: "status", courseId }
      },
      {
        type: "ltiResourceLink",
        title: "📢 Tablero de Avisos y Novedades",
        url: `${origin}/api/lti/launch?targetModule=announcements&courseId=${courseId}`,
        custom: { targetModule: "announcements", courseId }
      },
      {
        type: "ltiResourceLink",
        title: "🤝 Tutorías Académicas y Mentorías",
        url: `${origin}/api/lti/launch?targetModule=tutoring&courseId=${courseId}`,
        custom: { targetModule: "tutoring", courseId }
      },
      {
        type: "ltiResourceLink",
        title: "👥 Grupos de Estudio y Cursada",
        url: `${origin}/api/lti/launch?targetModule=groups&courseId=${courseId}`,
        custom: { targetModule: "groups", courseId }
      },
      {
        type: "ltiResourceLink",
        title: "📝 Actividades e Integraciones Individuales",
        url: `${origin}/api/lti/launch?targetModule=activities&courseId=${courseId}`,
        custom: { targetModule: "activities", courseId }
      }
    ];

    return NextResponse.json({
      "@context": "http://purl.imsglobal.org/ctx/lti/v1/deeplinking",
      "@type": "LtiDeepLinkingResponse",
      "items": deepLinkItems
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Error procesando LTI Deep Link selection: " + error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
