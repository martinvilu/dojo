#!/bin/bash
# Crea en Google Secret Manager los secretos de Cloud Functions (mejora 3.06)
# y activa su uso en el deploy.
#
#   scripts/setup-secrets.sh [proyecto]      (por defecto: jutsu-classroom-mrtin)
#
# Requiere Firebase CLI con sesión iniciada y permisos de Secret Manager.
set -euo pipefail
PROJECT="${1:-jutsu-classroom-mrtin}"

secret_exists() {
  firebase functions:secrets:get "$1" --project "$PROJECT" >/dev/null 2>&1
}

if secret_exists TOKEN_ENCRYPTION_KEY; then
  echo "TOKEN_ENCRYPTION_KEY ya existe: no se regenera (los tokens cifrados dependen de ella)."
else
  echo "Generando TOKEN_ENCRYPTION_KEY (32 bytes aleatorios)..."
  openssl rand -base64 32 | tr -d '\n' | firebase functions:secrets:set TOKEN_ENCRYPTION_KEY --project "$PROJECT" --data-file=-
fi

for name in GMAIL_CLIENT_ID GMAIL_CLIENT_SECRET; do
  if secret_exists "$name"; then
    echo "$name ya existe."
  else
    read -r -s -p "Valor de $name (OAuth de Google Cloud Console; vacío para saltear): " value; echo
    if [ -n "$value" ]; then
      printf '%s' "$value" | firebase functions:secrets:set "$name" --project "$PROJECT" --data-file=-
    else
      echo "  $name salteado: el deploy fallará con el flag activo hasta que exista."
    fi
  fi
done

ENV_FILE="functions/.env.$PROJECT"
if ! grep -q '^DOJO_SECRETS_FROM_SECRET_MANAGER=true' "$ENV_FILE" 2>/dev/null; then
  echo 'DOJO_SECRETS_FROM_SECRET_MANAGER=true' >> "$ENV_FILE"
fi
echo
echo "Listo. Commiteá $ENV_FILE (solo contiene el flag, no secretos) y desplegá:"
echo "  firebase deploy --only functions --project $PROJECT"
echo "Después migrá los tokens existentes con la acción encryptStoredSecrets (admin)."
