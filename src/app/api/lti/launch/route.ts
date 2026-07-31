import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/url";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let assignmentId = "";
    let courseId = "";
    let targetModule = "";
    let email = "";
    let name = "";
    let roles: string[] = [];
    let outcomeUrl = "";
    let resultId = "";

    const requestUrl = new URL(request.url);
    if (requestUrl.searchParams.get("targetModule")) {
      targetModule = requestUrl.searchParams.get("targetModule")!;
    }
    if (requestUrl.searchParams.get("assignmentId")) {
      assignmentId = requestUrl.searchParams.get("assignmentId")!;
    }
    if (requestUrl.searchParams.get("courseId")) {
      courseId = requestUrl.searchParams.get("courseId")!;
    }

    if (contentType.includes("form") || contentType.includes("multipart")) {
      const formData = await request.formData();
      const idToken = formData.get("id_token") as string;

      targetModule = (formData.get("targetModule") || formData.get("custom_targetmodule") || formData.get("custom_target_module") || targetModule) as string;
      courseId = (formData.get("courseId") || formData.get("custom_courseid") || formData.get("custom_course_id") || courseId) as string;
      assignmentId = (formData.get("assignmentId") || formData.get("custom_assignmentid") || formData.get("custom_activityid") || assignmentId) as string;
      email = (formData.get("lis_person_contact_email_primary") || formData.get("ext_user_username") || email) as string;
      name = (formData.get("lis_person_name_full") || name) as string;
      outcomeUrl = (formData.get("lis_outcome_service_url") || outcomeUrl) as string;
      resultId = (formData.get("lis_result_sourcedid") || resultId) as string;

      if (idToken) {
        const tokenParts = idToken.split(".");
        if (tokenParts.length >= 2) {
          try {
            const payload = JSON.parse(Buffer.from(tokenParts[1], "base64").toString("utf-8"));
            email = payload.email || payload["https://purl.imsglobal.org/spec/lti/claim/lis"]?.person_sourcedid || email;
            name = payload.name || name || "Moodle User";
            roles = payload["https://purl.imsglobal.org/spec/lti/claim/roles"] || roles;
            const customParams = payload["https://purl.imsglobal.org/spec/lti/claim/custom"] || {};
            
            assignmentId = customParams.assignmentId || customParams.activityId || assignmentId;
            courseId = customParams.courseId || customParams.course_id || courseId;
            targetModule = customParams.targetModule || customParams.target_module || customParams.target || customParams.tab || targetModule;

            // Parse LTI grade outcome params (LTI 1.1 / 1.2 POX, or LTI 1.3 AGS claim)
            const lisClaim = payload["https://purl.imsglobal.org/spec/lti/claim/lis"] || {};
            outcomeUrl = lisClaim.outcome_service_url || outcomeUrl;
            resultId = lisClaim.result_sourcedid || resultId;
            
            if (!outcomeUrl) {
              const agsClaim = payload["https://purl.imsglobal.org/spec/lti-ags/claim/endpoint"] || {};
              outcomeUrl = agsClaim.lineitem || agsClaim.lineitems || outcomeUrl;
              resultId = agsClaim.lineitem ? "ags-lineitem" : resultId;
            }
          } catch (e) {
            logger.error("Error decoding LTI token parts", e);
          }
        }
      }
    }

    // Default fallbacks in case of empty LTI payload
    if (!email) {
      email = "moodle-user@example.com";
    }

    // Map targetModule to internal dashboard tab & subtab routes
    let mainTab = "student-courses";
    let subtab = "";

    const cleanTarget = targetModule.toLowerCase();
    if (cleanTarget === "schedules" || cleanTarget === "calendar") {
      subtab = "schedules";
    } else if (cleanTarget === "assignments" || cleanTarget === "activities" || assignmentId) {
      subtab = "assignments";
    } else if (cleanTarget === "overview" || cleanTarget === "status" || cleanTarget === "roster" || cleanTarget === "alerts") {
      subtab = "overview";
    } else if (cleanTarget === "announcements" || cleanTarget === "avisos") {
      subtab = "announcements";
    } else if (cleanTarget === "tutorias" || cleanTarget === "tutoring") {
      subtab = "tutorias";
    } else if (cleanTarget === "study_groups" || cleanTarget === "groups" || cleanTarget === "grupos") {
      subtab = "study_groups";
    } else if (cleanTarget === "emails" || cleanTarget === "mail") {
      subtab = "emails";
    } else if (cleanTarget === "profile" || cleanTarget === "auth") {
      mainTab = "profile";
    } else if (cleanTarget === "students") {
      subtab = "students";
    } else if (cleanTarget) {
      subtab = cleanTarget; // fallback
    }

    const baseUrl = getBaseUrl(request);
    const redirectUrl = new URL("/dashboard", baseUrl);
    redirectUrl.searchParams.set("lti_launch", "true");
    redirectUrl.searchParams.set("lti_email", email);
    redirectUrl.searchParams.set("lti_name", name);
    redirectUrl.searchParams.set("lti_role", roles.some(r => r.includes("Instructor") || r.includes("Administrator")) ? "teacher" : "student");
    
    if (mainTab) redirectUrl.searchParams.set("tab", mainTab);
    if (subtab) redirectUrl.searchParams.set("subTab", subtab);
    if (targetModule) redirectUrl.searchParams.set("targetModule", targetModule);
    if (courseId) redirectUrl.searchParams.set("courseId", courseId);
    if (assignmentId) redirectUrl.searchParams.set("assignmentId", assignmentId);

    if (outcomeUrl) {
      redirectUrl.searchParams.set("lis_outcome_service_url", outcomeUrl);
    }
    if (resultId) {
      redirectUrl.searchParams.set("lis_result_sourcedid", resultId);
    }

    // Safety net: ensure final redirect URL never contains internal addresses
    let finalUrl = redirectUrl.toString();
    const CANONICAL = "https://dojo--jutsu-classroom-mrtin.us-east4.hosted.app";
    finalUrl = finalUrl
      .replace(/https?:\/\/0\.0\.0\.0(:\d+)?/g, CANONICAL)
      .replace(/https?:\/\/127\.0\.0\.1(:\d+)?/g, CANONICAL)
      .replace(/https?:\/\/localhost(:\d+)?/g, CANONICAL);

    logger.info("[LTI Launch] Redirecting", { baseUrl, finalUrl, targetModule, courseId });
    return NextResponse.redirect(new URL(finalUrl), 303);
  } catch (error: any) {
    logger.error("Error procesando LTI Launch", error);
    return NextResponse.json({ error: "Error procesando LTI Launch: " + error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
