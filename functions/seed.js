const admin = require('firebase-admin');

// Ensure we run against the right project
process.env.GCLOUD_PROJECT = 'jutsu-classroom-mrtin';

admin.initializeApp({
  projectId: "jutsu-classroom-mrtin"
});

const db = admin.firestore();

async function seed() {
    console.log("Creating teacher profile...");
    const teacherRef = db.collection('profiles').doc('teacher123');
    await teacherRef.set({
        full_name: "Kakashi Hatake",
        email: "kakashi@jutsu.com",
        role: "teacher"
    });

    console.log("Creating student profile...");
    const studentRef = db.collection('profiles').doc('student123');
    await studentRef.set({
        full_name: "Naruto Uzumaki",
        email: "naruto@jutsu.com",
        role: "student"
    });

    console.log("Creating admin profile...");
    const adminRef = db.collection('profiles').doc('admin123');
    await adminRef.set({
        full_name: "Tsunade Senju",
        email: "admin@jutsu.com",
        role: "admin"
    });

    console.log("Creating a course...");
    const courseRef = db.collection('courses').doc('course123');
    await courseRef.set({
        name: "Introducción al Ninjutsu",
        github_org: "jutsu-ninjutsu-101",
        teacher_id: "teacher123",
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("Creating an assignment...");
    const assignmentRef = db.collection('assignments').doc('assignment123');
    await assignmentRef.set({
        course_id: "course123",
        title: "Clon de Sombra Básico",
        description: "Demostrar la técnica del clon de sombra creando un repositorio en la organización.",
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("Enrolling student to course...");
    const enrollmentRef = db.collection('enrollments').doc('enrollment123');
    await enrollmentRef.set({
        course_id: "course123",
        student_id: "student123",
        enrolled_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("Seed complete!");
}

seed().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
