#!/bin/bash
TOKEN=$(jq -r .tokens.access_token ~/.config/configstore/firebase-tools.json)
BASE_URL="https://firestore.googleapis.com/v1/projects/jutsu-classroom-mrtin/databases/(default)/documents"

# Admin Profile
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/profiles?documentId=admin123" -H "Content-Type: application/json" -d '{
  "fields": {
    "full_name": { "stringValue": "Tsunade Senju" },
    "email": { "stringValue": "admin@jutsu.com" },
    "role": { "stringValue": "admin" }
  }
}'

# Student Profile
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/profiles?documentId=student123" -H "Content-Type: application/json" -d '{
  "fields": {
    "full_name": { "stringValue": "Naruto Uzumaki" },
    "email": { "stringValue": "student@jutsu.com" },
    "role": { "stringValue": "student" }
  }
}'

# Course
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/courses?documentId=course123" -H "Content-Type: application/json" -d '{
  "fields": {
    "name": { "stringValue": "Introducción al Ninjutsu" },
    "github_org": { "stringValue": "jutsu-ninjutsu-101" },
    "teacher_id": { "stringValue": "teacher123" },
    "created_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

# Assignment
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/assignments?documentId=assignment123" -H "Content-Type: application/json" -d '{
  "fields": {
    "course_id": { "stringValue": "course123" },
    "title": { "stringValue": "Clon de Sombra Básico" },
    "description": { "stringValue": "Demostrar la técnica del clon de sombra creando un repositorio en la organización." },
    "due_date": { "stringValue": "2026-06-08T00:00:00Z" },
    "created_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

# Enrollment
curl -s -X POST -H "Authorization: Bearer $TOKEN" "$BASE_URL/enrollments?documentId=enrollment123" -H "Content-Type: application/json" -d '{
  "fields": {
    "course_id": { "stringValue": "course123" },
    "student_id": { "stringValue": "student123" },
    "enrolled_at": { "timestampValue": "2026-06-01T00:00:00Z" }
  }
}'

echo "Database seeded!"
