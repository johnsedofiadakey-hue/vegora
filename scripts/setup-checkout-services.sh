#!/usr/bin/env bash
# One-time setup of the services test checkout depends on.
#
#   1. Creates the VEGORA_CRON_SECRET managed secret (a random value that is
#      never printed) and gives the App Hosting backend access to it.
#   2. Turns on Cloud Scheduler.
#   3. Creates, or updates, a job that calls /api/internal/expire-orders every
#      five minutes so unpaid reservations are released.
#
# Run it yourself from a terminal where you are signed in to both CLIs:
#
#   bash scripts/setup-checkout-services.sh
#
# It does NOT set the Paystack key, the delivery zones, or the three checkout
# switches. Checkout stays closed until those are done and verified.
set -euo pipefail

PROJECT="vegoragh"
REGION="europe-west4"
SITE_URL="https://vegora--vegoragh.europe-west4.hosted.app"
JOB="vegora-expire-orders"
SECRET="VEGORA_CRON_SECRET"

say() { printf '\n== %s\n' "$1"; }

say "1/3  Cron secret"
if gcloud secrets describe "$SECRET" --project "$PROJECT" >/dev/null 2>&1; then
  echo "$SECRET already exists. Leaving it as it is."
else
  # tr removes the newline openssl adds; a stored newline would make the secret differ
  # from the token the scheduler sends.
  openssl rand -hex 32 | tr -d '\n' | firebase apphosting:secrets:set "$SECRET" \
    --project "$PROJECT" --data-file - --force
  echo "Created $SECRET."
fi
# The CLI offers to edit apphosting.yaml but skips it when the secret is piped in,
# so make sure the backend is told to read the secret.
if ! grep -q "secret: $SECRET" apphosting.yaml; then
  printf '  - variable: %s\n    secret: %s\n    availability:\n      - RUNTIME\n' "$SECRET" "$SECRET" >> apphosting.yaml
  echo "Added $SECRET to apphosting.yaml."
fi

say "2/3  Cloud Scheduler"
gcloud services enable cloudscheduler.googleapis.com --project "$PROJECT"

say "3/3  Expiry job (every 5 minutes)"
# The job sends the secret as a bearer token. Cloud Scheduler stores request
# headers in the job, so anyone with editor access to the project can read it.
# gcloud prints the job it creates, headers included, so its output is discarded.
TOKEN="$(gcloud secrets versions access latest --secret "$SECRET" --project "$PROJECT")"
COMMON=(--project "$PROJECT" --location "$REGION" --schedule "*/5 * * * *" --time-zone "Etc/UTC"
  --uri "$SITE_URL/api/internal/expire-orders" --http-method POST
  --update-headers "Authorization=Bearer $TOKEN" --attempt-deadline 60s)
if gcloud scheduler jobs describe "$JOB" --project "$PROJECT" --location "$REGION" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "$JOB" "${COMMON[@]}" >/dev/null
else
  CREATE=("${COMMON[@]/--update-headers/--headers}")
  gcloud scheduler jobs create http "$JOB" "${CREATE[@]}" >/dev/null
fi
unset TOKEN

cat <<EOF

Done. Next:
  1. Deploy so the backend can read the new secret and site URL:
       firebase deploy --only apphosting:vegora --project $PROJECT
  2. Set the Paystack TEST secret key (it prompts; nothing is echoed):
       firebase apphosting:secrets:set PAYSTACK_SECRET_KEY --project $PROJECT
  3. Tell Claude, who will check the key, the webhook and the expiry job.
EOF
