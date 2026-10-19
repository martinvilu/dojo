#!/bin/bash
# Prepara el export diario de Firestore (mejora 3.22): bucket con
# retención de 30 días y permisos para la cuenta de servicio de Functions.
#
#   scripts/setup-backups.sh [proyecto] [región]
set -euo pipefail
PROJECT="${1:-jutsu-classroom-mrtin}"
REGION="${2:-us-central1}"
BUCKET="gs://${PROJECT}-backups"
SA="${PROJECT}@appspot.gserviceaccount.com"

gcloud storage buckets describe "$BUCKET" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud storage buckets create "$BUCKET" --project "$PROJECT" --location "$REGION" --uniform-bucket-level-access

cat > /tmp/dojo-backups-lifecycle.json <<'JSON'
{ "rule": [ { "action": { "type": "Delete" }, "condition": { "age": 30 } } ] }
JSON
gcloud storage buckets update "$BUCKET" --lifecycle-file=/tmp/dojo-backups-lifecycle.json

gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role roles/datastore.importExportAdmin --condition=None >/dev/null
gcloud storage buckets add-iam-policy-binding "$BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectAdmin >/dev/null

ENV_FILE="functions/.env.$PROJECT"
grep -q '^BACKUP_BUCKET=' "$ENV_FILE" 2>/dev/null || echo "BACKUP_BUCKET=$BUCKET" >> "$ENV_FILE"
echo "Listo: $BUCKET (retención 30 días). Commiteá $ENV_FILE y desplegá las funciones."
echo "Restaurar: gcloud firestore import $BUCKET/firestore/<AAAA-MM-DD> --project $PROJECT"
