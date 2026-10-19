import { describe, it } from "node:test";
import assert from "node:assert";
import { ltiNavigation, parseVerifiedLaunch } from "../../src/lib/lti/launch.ts";
import { getLtiPlatform, LTI_CLAIMS } from "../../src/lib/lti/config.ts";

const config = getLtiPlatform({
  LTI_PLATFORM_ISSUER: "https://moodle.unrn.edu.ar",
  LTI_CLIENT_ID: "client-1",
  LTI_PLATFORM_AUTH_URL: "https://moodle.unrn.edu.ar/mod/lti/auth.php",
  LTI_PLATFORM_JWKS_URL: "https://moodle.unrn.edu.ar/mod/lti/certs.php",
  LTI_DEPLOYMENT_IDS: "3, 4",
})!;

const launch = (overrides: Record<string, any> = {}) => ({
  iss: config.issuer,
  sub: "42",
  email: "Ana@UNRN.edu.ar",
  name: "Ana",
  [LTI_CLAIMS.version]: "1.3.0",
  [LTI_CLAIMS.messageType]: "LtiResourceLinkRequest",
  [LTI_CLAIMS.deploymentId]: "3",
  [LTI_CLAIMS.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Learner"],
  [LTI_CLAIMS.custom]: { courseId: "c1", assignmentId: "a1", targetModule: "assignments" },
  [LTI_CLAIMS.ags]: { lineitem: "https://moodle.unrn.edu.ar/lineitem/7", scope: ["https://purl.imsglobal.org/spec/lti-ags/scope/score"] },
  ...overrides,
});

describe("src/lib/lti/launch", () => {
  it("parses a verified resource link launch", () => {
    const l = parseVerifiedLaunch(launch(), config);
    assert.strictEqual(l.email, "ana@unrn.edu.ar");
    assert.strictEqual(l.courseId, "c1");
    assert.strictEqual(l.isInstructor, false);
    assert.strictEqual(l.ags?.lineitem, "https://moodle.unrn.edu.ar/lineitem/7");
  });

  it("detects instructors and requires deep linking settings", () => {
    const teacher = parseVerifiedLaunch(launch({ [LTI_CLAIMS.roles]: ["http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor"] }), config);
    assert.strictEqual(teacher.isInstructor, true);
    assert.throws(() => parseVerifiedLaunch(launch({ [LTI_CLAIMS.messageType]: "LtiDeepLinkingRequest" }), config), /deep_link_return_url/);
    const dl = parseVerifiedLaunch(launch({
      [LTI_CLAIMS.messageType]: "LtiDeepLinkingRequest",
      [LTI_CLAIMS.deepLinkingSettings]: { deep_link_return_url: "https://moodle.unrn.edu.ar/return", data: "opaque" },
    }), config);
    assert.strictEqual(dl.deepLinking?.data, "opaque");
  });

  it("rejects unknown deployments, versions, message types and anonymous launches", () => {
    assert.throws(() => parseVerifiedLaunch(launch({ [LTI_CLAIMS.deploymentId]: "99" }), config), /Deployment/);
    assert.throws(() => parseVerifiedLaunch(launch({ [LTI_CLAIMS.version]: "1.1" }), config), /Versión/);
    assert.throws(() => parseVerifiedLaunch(launch({ [LTI_CLAIMS.messageType]: "LtiSubmissionReviewRequest" }), config), /Tipo/);
    assert.throws(() => parseVerifiedLaunch(launch({ sub: "" }), config), /sub/);
  });

  it("maps target modules to dashboard tabs", () => {
    assert.deepStrictEqual(ltiNavigation("calendar", null), { tab: "student-courses", subTab: "schedules" });
    assert.deepStrictEqual(ltiNavigation(null, "a1"), { tab: "student-courses", subTab: "assignments" });
    assert.deepStrictEqual(ltiNavigation("auth", null), { tab: "profile", subTab: "" });
  });

  it("returns no config when the platform is not registered", () => {
    assert.strictEqual(getLtiPlatform({}), null);
  });
});
