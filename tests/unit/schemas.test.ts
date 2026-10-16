import { describe, it } from "node:test";
import assert from "node:assert";
import { UserProfileSchema } from "../../src/lib/schemas/auth.ts";
import { CourseSchema, AssignmentSchema } from "../../src/lib/schemas/course.ts";
import { MoodleConfigSchema, LtiPayloadSchema } from "../../src/lib/schemas/moodle.ts";

describe("src/lib/schemas", () => {
  it("validates UserProfileSchema and rejects invalid profiles", () => {
    const valid = UserProfileSchema.safeParse({
      id: "uid-1",
      full_name: "Ada Lovelace",
      email: "ada@unrn.edu.ar",
      role: "student",
      avatar_url: "",
      account_status: "approved",
    });
    assert.strictEqual(valid.success, true);

    const invalid = UserProfileSchema.safeParse({
      id: "",
      full_name: "A",
      email: "bad-email",
      role: "guest",
      account_status: "unknown",
    });
    assert.strictEqual(invalid.success, false);
  });

  it("validates CourseSchema and AssignmentSchema with defaults", () => {
    const course = CourseSchema.safeParse({
      id: "ing-soft-1",
      name: "Ingeniería de Software",
      year: 2026,
      semester: "1",
    });
    assert.strictEqual(course.success, true);

    const assignment = AssignmentSchema.safeParse({
      title: "TP 1: Git & TDD",
      deadline: "2026-05-01",
      course_id: "ing-soft-1",
    });
    assert.strictEqual(assignment.success, true);
    if (assignment.success) {
      assert.strictEqual(assignment.data.peer_review_enabled, false);
    }
  });

  it("validates MoodleConfigSchema and LtiPayloadSchema", () => {
    const moodleOk = MoodleConfigSchema.safeParse({
      apiUrl: "https://moodle.unrn.edu.ar",
      wsToken: "0123456789abcdef",
      courseId: "42",
    });
    assert.strictEqual(moodleOk.success, true);

    const moodleBad = MoodleConfigSchema.safeParse({
      apiUrl: "not-a-url",
      wsToken: "short",
      courseId: "",
    });
    assert.strictEqual(moodleBad.success, false);

    const lti = LtiPayloadSchema.safeParse({});
    assert.strictEqual(lti.success, true);
    if (lti.success) {
      assert.strictEqual(lti.data.name, "Moodle User");
      assert.deepStrictEqual(lti.data.roles, []);
    }
  });
});
