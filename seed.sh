#!/bin/bash
TOKEN=$(jq -r .tokens.access_token ~/.config/configstore/firebase-tools.json)
BASE_URL="https://firestore.googleapis.com/v1/projects/jutsu-classroom-mrtin/databases/(default)/documents"

# Admin Profile
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/profiles/admin123" -H "Content-Type: application/json" -d '{
  "fields": {
    "full_name": { "stringValue": "Tsunade Senju" },
    "email": { "stringValue": "admin@jutsu.com" },
    "role": { "stringValue": "admin" },
    "account_status": { "stringValue": "approved" }
  }
}'

# Student Profile
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/profiles/student123" -H "Content-Type: application/json" -d '{
  "fields": {
    "full_name": { "stringValue": "Naruto Uzumaki" },
    "email": { "stringValue": "student@jutsu.com" },
    "role": { "stringValue": "student" },
    "account_status": { "stringValue": "pending" }
  }
}'

# Teacher Profile
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/profiles/teacher123" -H "Content-Type: application/json" -d '{
  "fields": {
    "full_name": { "stringValue": "Kakashi Hatake" },
    "email": { "stringValue": "kakashi@jutsu.com" },
    "role": { "stringValue": "teacher" },
    "account_status": { "stringValue": "approved" }
  }
}'

# Course
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/courses/course123" -H "Content-Type: application/json" -d '{
  "fields": {
    "name": { "stringValue": "Introducción al Ninjutsu" },
    "github_org": { "stringValue": "jutsu-ninjutsu-101" },
    "teacher_id": { "stringValue": "teacher123" },
    "created_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

# Course Teacher Relation
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/course_teachers/course123_teacher123" -H "Content-Type: application/json" -d '{
  "fields": {
    "course_id": { "stringValue": "course123" },
    "teacher_id": { "stringValue": "teacher123" },
    "role": { "stringValue": "titular" }
  }
}'

# Assignment
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/assignments/assignment123" -H "Content-Type: application/json" -d '{
  "fields": {
    "course_id": { "stringValue": "course123" },
    "title": { "stringValue": "Clon de Sombra Básico" },
    "description": { "stringValue": "Demostrar la técnica del clon de sombra creando un repositorio en la organización." },
    "due_date": { "stringValue": "2026-06-08T00:00:00Z" },
    "created_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

# Enrollment
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/enrollments/enrollment123" -H "Content-Type: application/json" -d '{
  "fields": {
    "course_id": { "stringValue": "course123" },
    "student_id": { "stringValue": "student123" },
    "enrolled_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

# Course Roster for Student
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/course_roster/course123_student123" -H "Content-Type: application/json" -d '{
  "fields": {
    "course_id": { "stringValue": "course123" },
    "student_id": { "stringValue": "student123" },
    "enrolled_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

# Student Submission
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/submissions/assignment123_student123" -H "Content-Type: application/json" -d '{
  "fields": {
    "assignment_id": { "stringValue": "assignment123" },
    "student_id": { "stringValue": "student123" },
    "repo_url": { "stringValue": "https://github.com/jutsu-ninjutsu-101/tp-clon-de-sombra-naruto" },
    "status": { "stringValue": "submitted" },
    "grade": { "stringValue": "" },
    "feedback": { "stringValue": "" },
    "submitted_at": { "timestampValue": "2026-06-05T12:00:00Z" }
  }
}'


# Extra Students
names=(
  "Sasuke Uchiha" "Sakura Haruno" "Shikamaru Nara" "Choji Akimichi" 
  "Ino Yamanaka" "Neji Hyuga" "Rock Lee" "Tenten" 
  "Kiba Inuzuka" "Shino Aburame" "Hinata Hyuga" "Gaara" 
  "Temari" "Kankuro" "Sai" "Yamato" 
  "Konohamaru Sarutobi" "Mirai Sarutobi" "Boruto Uzumaki" "Sarada Uchiha"
)

for i in {0..19}
do
  id=$((i+1))
  student_id="student_extra_$id"
  name="${names[$i]}"
  email=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -d ' ')@jutsu.com
  status="approved"
  if (( i % 2 != 0 )); then
    status="pending"
  fi
  matricula="UNRN-100$((i+10))"

  # Profile
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/profiles/$student_id" -H "Content-Type: application/json" -d "{
    \"fields\": {
      \"full_name\": { \"stringValue\": \"$name\" },
      \"email\": { \"stringValue\": \"$email\" },
      \"role\": { \"stringValue\": \"student\" },
      \"account_status\": { \"stringValue\": \"$status\" },
      \"matricula_unrn\": { \"stringValue\": \"$matricula\" }
    }
  }" > /dev/null

  # Enrollment
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/enrollments/enrollment_extra_$id" -H "Content-Type: application/json" -d "{
    \"fields\": {
      \"course_id\": { \"stringValue\": \"course123\" },
      \"student_id\": { \"stringValue\": \"$student_id\" },
      \"enrolled_at\": { \"timestampValue\": \"2026-06-01T00:00:00Z\" }
    }
  }" > /dev/null

  # Course Roster
  curl -s -X PATCH -H "Authorization: Bearer $TOKEN" "$BASE_URL/course_roster/course123_$student_id" -H "Content-Type: application/json" -d "{
    \"fields\": {
      \"course_id\": { \"stringValue\": \"course123\" },
      \"student_id\": { \"stringValue\": \"$student_id\" },
      \"enrolled_at\": { \"timestampValue\": \"2026-06-01T00:00:00Z\" }
    }
  }" > /dev/null
done

echo "Database seeded!"

