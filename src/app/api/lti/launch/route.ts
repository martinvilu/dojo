import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let assignmentId = "";
    let courseId = "";
    let email = "";
    let name = "";
    let roles: string[] = [];

    if (contentType.includes("form") || contentType.includes("multipart")) {
      const formData = await request.formData();
      const idToken = formData.get("id_token") as string;
      
      if (idToken) {
        const tokenParts = idToken.split(".");
        if (tokenParts.length >= 2) {
          try {
            const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf-8"));
            email = payload.email || payload["https://purl.imsglobal.org/spec/lti/claim/lis"]?.person_sourcedid || "";
            name = payload.name || "Moodle User";
            roles = payload["https://purl.imsglobal.org/spec/lti/claim/roles"] || [];
            const customParams = payload["https://purl.imsglobal.org/spec/lti/claim/custom"] || {};
            assignmentId = customParams.assignmentId || "";
            courseId = customParams.courseId || "";
          } catch (e) {
            console.error("Error decoding LTI token parts:", e);
          }
        }
      }
    }

    // Default fallbacks in case of empty LTI payload
    if (!email) {
      email = "moodle-user@example.com";
    }

    let redirectUrl = "/dashboard";
    if (assignmentId) {
      redirectUrl = `/dashboard/activities/${assignmentId}`;
    } else if (courseId) {
      redirectUrl = `/dashboard/courses/${courseId}`;
    }

    const url = new URL(redirectUrl, request.url);
    url.searchParams.set("lti_launch", "true");
    url.searchParams.set("lti_email", email);
    url.searchParams.set("lti_name", name);
    url.searchParams.set("lti_role", roles.some(r => r.includes("Instructor") || r.includes("Administrator")) ? "teacher" : "student");

    return NextResponse.redirect(url.toString(), 303);
  } catch (error: any) {
    return NextResponse.json({ error: "Error procesando LTI Launch: " + error.message }, { status: 500 });
  }
}
