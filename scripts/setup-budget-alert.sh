#!/bin/bash
# Alerta de presupuesto mensual del proyecto (mejora 3.31): avisa por mail a
# los administradores de facturación al 50 %, 90 % y 100 % del monto, y ante
# un pronóstico que supere el 100 % (consumo anómalo, p. ej. un loop de
# lecturas de Firestore).
#
#   scripts/setup-budget-alert.sh <billing-account-id> [monto-USD] [proyecto]
#   (el ID se ve con: gcloud billing accounts list)
set -euo pipefail
BILLING_ACCOUNT="${1:?Falta el ID de la cuenta de facturación (gcloud billing accounts list)}"
AMOUNT="${2:-25}"
PROJECT="${3:-jutsu-classroom-mrtin}"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"

gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="Ninja Dojo - $PROJECT" \
  --budget-amount="${AMOUNT}USD" \
  --filter-projects="projects/$PROJECT_NUMBER" \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.9 \
  --threshold-rule=percent=1.0 \
  --threshold-rule=percent=1.0,basis=forecasted-spend

echo "Presupuesto de ${AMOUNT} USD/mes creado para $PROJECT."
