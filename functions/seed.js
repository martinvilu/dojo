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
        role: "teacher",
        account_status: "approved"
    });

    console.log("Creating student profile...");
    const studentRef = db.collection('profiles').doc('student123');
    await studentRef.set({
        full_name: "Naruto Uzumaki",
        email: "naruto@jutsu.com",
        role: "student",
        account_status: "pending"
    });

    console.log("Creating admin profile...");
    const adminRef = db.collection('profiles').doc('admin123');
    await adminRef.set({
        full_name: "Tsunade Senju",
        email: "admin@jutsu.com",
        role: "admin",
        account_status: "approved"
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

    console.log("Creating course teacher relationship...");
    const courseTeacherRef = db.collection('course_teachers').doc('course123_teacher123');
    await courseTeacherRef.set({
        course_id: "course123",
        teacher_id: "teacher123",
        role: "titular"
    });

    console.log("Creating 20 additional student profiles...");
    const names = [
        "Sasuke Uchiha", "Sakura Haruno", "Shikamaru Nara", "Choji Akimichi", 
        "Ino Yamanaka", "Neji Hyuga", "Rock Lee", "Tenten", 
        "Kiba Inuzuka", "Shino Aburame", "Hinata Hyuga", "Gaara", 
        "Temari", "Kankuro", "Sai", "Yamato", 
        "Konohamaru Sarutobi", "Mirai Sarutobi", "Boruto Uzumaki", "Sarada Uchiha"
    ];
    
    for (let i = 0; i < 20; i++) {
        const studentId = `student_extra_${i+1}`;
        const name = names[i];
        const email = `${name.toLowerCase().replace(/\s+/g, '')}@jutsu.com`;
        
        await db.collection('profiles').doc(studentId).set({
            full_name: name,
            email: email,
            role: "student",
            account_status: i % 2 === 0 ? "approved" : "pending",
            matricula_unrn: `UNRN-100${i+10}`
        });

        await db.collection('enrollments').doc(`enrollment_extra_${i+1}`).set({
            course_id: "course123",
            student_id: studentId,
            enrolled_at: admin.firestore.FieldValue.serverTimestamp()
        });

        await db.collection('course_roster').doc(`course123_${studentId}`).set({
            course_id: "course123",
            student_id: studentId,
            enrolled_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    console.log("Seed complete!");
}

seed().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
