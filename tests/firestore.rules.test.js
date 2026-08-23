/**
 * Firestore security rules tests for Ninja Dojo.
 *
 * Runs against the Firestore emulator via `npm run test:rules`
 * (wraps jest in `firebase emulators:exec --only firestore`).
 *
 * RulesTestContext#firestore() hands back the namespaced wrapper; its
 * `_delegate` is the modular Firestore instance expected by the v9 API.
 */
const { readFileSync } = require("node:fs");
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  arrayUnion,
  serverTimestamp,
} = require("firebase/firestore");

const PROJECT_ID = "demo-ninja-dojo-rules";

// Canonical fixture ids
const COURSE = "course1";
const STUDENT = "alice"; // enrolled student
const STUDENT2 = "dave"; // authenticated but not a member
const TEACHER = "bob"; // assigned teacher of COURSE
const ADMIN = "carol"; // platform admin

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = delegateOf(ctx);
    await setDoc(doc(db, `profiles/${STUDENT}`), { role: "student", full_name: "Alice" });
    await setDoc(doc(db, `profiles/${STUDENT2}`), { role: "student", full_name: "Dave" });
    await setDoc(doc(db, `profiles/${TEACHER}`), { role: "teacher", full_name: "Bob" });
    await setDoc(doc(db, `profiles/${ADMIN}`), { role: "admin", full_name: "Carol" });
    await setDoc(doc(db, `courses/${COURSE}`), { name: "Algoritmos 1" });
    await setDoc(doc(db, `course_teachers/${COURSE}_${TEACHER}`), { teacher_id: TEACHER });
    await setDoc(doc(db, `course_roster/${COURSE}_${STUDENT}`), { student_id: STUDENT });
    await setDoc(doc(db, `enrollments/${STUDENT}_${COURSE}`), { course_id: COURSE });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

/** Modular Firestore instance that bypasses security rules (seeding). */
async function withAdminDb(fn) {
  return testEnv.withSecurityRulesDisabled(async (ctx) => fn(delegateOf(ctx)));
}

/** Modular Firestore instance acting as the given fixture user. */
function user(uid) {
  return delegateOf(testEnv.authenticatedContext(uid));
}

function delegateOf(ctx) {
  const db = ctx.firestore();
  return db._delegate ?? db;
}

describe("unauthenticated access", () => {
  it("denies reading and writing everything", async () => {
    const anon = delegateOf(testEnv.unauthenticatedContext());
    await assertFails(getDoc(doc(anon, `profiles/${STUDENT}`)));
    await assertFails(getDoc(doc(anon, `courses/${COURSE}/attendance/class_1`)));
    await assertFails(addDoc(collection(anon, "audit_logs"), { x: 1 }));
  });
});

describe("profiles", () => {
  it("allows reading only the own profile", async () => {
    await assertSucceeds(getDoc(doc(user(STUDENT), `profiles/${STUDENT}`)));
    await assertFails(getDoc(doc(user(STUDENT), `profiles/${TEACHER}`)));
    await assertFails(getDocs(query(collection(user(TEACHER), "profiles"))));
  });

  it("allows teachers to edit only the commissions map of students", async () => {
    const t = user(TEACHER);
    await assertSucceeds(updateDoc(doc(t, `profiles/${STUDENT}`), { "commissions.x1": "A" }));
    await assertFails(updateDoc(doc(t, `profiles/${STUDENT}`), { full_name: "Hacked" }));
    await assertFails(updateDoc(doc(t, `profiles/${STUDENT}`), { role: "teacher" }));
    await assertFails(updateDoc(doc(t, `profiles/${TEACHER}`), { "commissions.x1": "A" }));
  });

  it("denies profile creation and deletion to clients", async () => {
    await assertFails(setDoc(doc(user(STUDENT2), "profiles/new1"), { role: "admin" }));
    await assertFails(deleteDoc(doc(user(ADMIN), `profiles/${STUDENT}`)));
  });

  it("denies self-service profile edits (backend handles updates)", async () => {
    await assertFails(updateDoc(doc(user(STUDENT), `profiles/${STUDENT}`), { role: "admin" }));
  });
});

describe("courses root documents", () => {
  it("are inaccessible from clients", async () => {
    await assertFails(getDoc(doc(user(ADMIN), `courses/${COURSE}`)));
    await assertFails(updateDoc(doc(user(TEACHER), `courses/${COURSE}`), { name: "X" }));
  });

  it("membership collections are backend-only", async () => {
    await assertFails(getDoc(doc(user(STUDENT), `course_teachers/${COURSE}_${TEACHER}`)));
    await assertFails(setDoc(doc(user(STUDENT2), `enrollments/${STUDENT2}_${COURSE}`), {}));
  });
});

describe("attendance subcollection", () => {
  const att = (uid) => doc(user(uid), `courses/${COURSE}/attendance/class_1`);

  it("is readable by members, not by outsiders", async () => {
    await assertSucceeds(getDoc(att(STUDENT)));
    await assertFails(getDoc(att(STUDENT2)));
  });

  it("can be written only by the assigned teacher", async () => {
    await assertSucceeds(setDoc(att(TEACHER), { records: {} }, { merge: true }));
    await assertFails(setDoc(att(STUDENT), { records: { [STUDENT]: true } }));
    await assertFails(setDoc(att(ADMIN), { records: {} })); // admin not assigned to this course
    await assertFails(deleteDoc(att(TEACHER)));
  });
});

describe("active QR token", () => {
  const qr = (uid) => doc(user(uid), `courses/${COURSE}/active_qr/current`);

  it("can be published by the assigned teacher", async () => {
    await assertSucceeds(setDoc(qr(TEACHER), { token: "ABC123", classNumber: 1 }));
  });

  it("is unreadable by any client and unwritable by students", async () => {
    await withAdminDb((db) => setDoc(doc(db, `courses/${COURSE}/active_qr/current`), { token: "ABC123" }));
    await assertFails(getDoc(qr(STUDENT)));
    await assertFails(getDoc(qr(TEACHER)));
    await assertFails(setDoc(qr(STUDENT), { token: "FAKE1" }));
  });
});

describe("class_comments subcollection", () => {
  const thread = () => collection(user(STUDENT), `courses/${COURSE}/class_comments`);
  const seedComment = () =>
    withAdminDb((db) => setDoc(doc(db, `courses/${COURSE}/class_comments/c1`), {
      classNumber: 1,
      user_id: STUDENT,
      content: "Consulta",
      created_at: new Date(),
      reactions: {},
    }));

  it("members read; outsiders do not", async () => {
    await seedComment();
    await assertSucceeds(getDocs(query(thread(), orderBy("created_at", "asc"))));
    await assertFails(getDocs(query(collection(user(STUDENT2), `courses/${COURSE}/class_comments`))));
  });

  it("members comment as themselves only, with bounded content", async () => {
    await assertSucceeds(addDoc(thread(), {
      classNumber: 1, user_id: STUDENT, content: "Hola", created_at: serverTimestamp(),
    }));
    await assertFails(addDoc(thread(), {
      classNumber: 1, user_id: TEACHER, content: "Suplantación", created_at: serverTimestamp(),
    }));
    await assertFails(addDoc(thread(), {
      classNumber: 1, user_id: STUDENT, content: "", created_at: serverTimestamp(),
    }));
    await assertFails(addDoc(thread(), {
      classNumber: 1, user_id: STUDENT, content: "x".repeat(4001), created_at: serverTimestamp(),
    }));
    await assertFails(addDoc(collection(user(STUDENT2), `courses/${COURSE}/class_comments`), {
      classNumber: 1, user_id: STUDENT2, content: "Hola", created_at: serverTimestamp(),
    }));
  });

  it("members may toggle reactions but not alter the message", async () => {
    await seedComment();
    const c = doc(user(STUDENT), `courses/${COURSE}/class_comments/c1`);
    await assertSucceeds(updateDoc(c, { "reactions.thumbs_up": arrayUnion(STUDENT) }));
    await assertFails(updateDoc(c, {
      content: "Editado maliciosamente",
      "reactions.thumbs_up": arrayUnion(STUDENT),
    }));
  });

  it("supports first reaction on legacy comments without reactions map", async () => {
    await withAdminDb((db) => setDoc(doc(db, `courses/${COURSE}/class_comments/legacy`), {
      classNumber: 1,
      user_id: STUDENT,
      content: "Legacy",
      created_at: new Date(),
    })); // no reactions key
    await assertSucceeds(updateDoc(
      doc(user(STUDENT), `courses/${COURSE}/class_comments/legacy`),
      { "reactions.thumbs_up": arrayUnion(STUDENT) }
    ));
  });

  it("only teachers/admins flag best answers, and nothing else alongside", async () => {
    await seedComment();
    const ref = (uid) => doc(user(uid), `courses/${COURSE}/class_comments/c1`);
    await assertFails(updateDoc(ref(STUDENT), { is_best_answer: true }));
    await assertSucceeds(updateDoc(ref(TEACHER), { is_best_answer: true }));
    await assertSucceeds(updateDoc(ref(ADMIN), { is_best_answer: false }));
    await assertFails(updateDoc(ref(TEACHER), { is_best_answer: true, content: "x" }));
  });

  it("cannot be deleted from clients", async () => {
    await seedComment();
    await assertFails(deleteDoc(doc(user(TEACHER), `courses/${COURSE}/class_comments/c1`)));
  });
});

describe("class_feedback subcollection", () => {
  const fb = (uid, id = "fbhash") => doc(user(uid), `courses/${COURSE}/class_feedback/${id}`);
  const valid = { classNumber: 1, rating: 5, understanding: "Entendí todo", comment: "" };

  it("students submit their own anonymous survey with rating 1-5", async () => {
    await assertSucceeds(setDoc(fb(STUDENT), valid));
    await assertFails(setDoc(fb(STUDENT, "bad0"), { ...valid, rating: 0 }));
    await assertFails(setDoc(fb(STUDENT, "bad6"), { ...valid, rating: 6 }));
    await assertFails(setDoc(fb(STUDENT, "badf"), { ...valid, rating: 4.5 }));
  });

  it("teachers aggregate results; members re-read their submission", async () => {
    await assertSucceeds(setDoc(fb(STUDENT), valid));
    await assertSucceeds(getDoc(fb(STUDENT)));
    await assertSucceeds(getDocs(query(
      collection(user(TEACHER), `courses/${COURSE}/class_feedback`),
      where("classNumber", "==", 1)
    )));
    await assertFails(setDoc(fb(TEACHER), valid)); // surveys are student-authored
  });

  it("outsiders have no access at all", async () => {
    await assertFails(getDoc(fb(STUDENT2)));
    await assertFails(setDoc(fb(STUDENT2), valid));
  });
});

describe("submissions", () => {
  it("owner may get; nobody lists, writes or reads others", async () => {
    await withAdminDb((db) => setDoc(doc(db, "submissions/s1"), {
      assignment_id: "a1",
      student_id: STUDENT,
      grade: "",
    }));
    const s = user(STUDENT);
    await assertSucceeds(getDoc(doc(s, "submissions/s1")));
    await assertFails(getDocs(query(
      collection(s, "submissions"), where("student_id", "==", STUDENT)
    )));
    await assertFails(getDoc(doc(user(STUDENT2), "submissions/s1")));
    await assertFails(updateDoc(doc(s, "submissions/s1"), { grade: "10" })); // grading via backend
  });
});

describe("audit and activity logs", () => {
  it("audit logs are readable by teaching roles, never writable", async () => {
    await withAdminDb((db) => setDoc(doc(db, "audit_logs/log1"), { submission_id: "s1" }));
    await assertSucceeds(getDocs(query(
      collection(user(TEACHER), "audit_logs"), where("submission_id", "==", "s1")
    )));
    await assertFails(getDocs(query(collection(user(STUDENT), "audit_logs"))));
    await assertFails(addDoc(collection(user(ADMIN), "audit_logs"), { fake: true }));
  });

  it("activity logs are fully backend-only", async () => {
    await assertFails(getDoc(doc(user(ADMIN), "activity_logs/a1")));
    await assertFails(addDoc(collection(user(ADMIN), "activity_logs"), { fake: true }));
  });
});
