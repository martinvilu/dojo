#!/bin/sh
# Arranca los emuladores dentro del contenedor. firebase.json los deja en
# 127.0.0.1; acá se genera una copia que escucha en 0.0.0.0 para poder
# publicarlos al host.
set -e
cd /workspace
if [ ! -d functions/node_modules/firebase-functions ]; then (cd functions && npm ci --no-audit --no-fund); fi
node -e '
const fs = require("fs");
const cfg = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
for (const [name, value] of Object.entries(cfg.emulators || {})) {
  if (value && typeof value === "object" && "port" in value) value.host = "0.0.0.0";
}
cfg.emulators.hub = { host: "0.0.0.0", port: 4400 };
fs.writeFileSync("firebase.docker.json", JSON.stringify(cfg, null, 2));
'
exec firebase emulators:start --config firebase.docker.json --only auth,firestore,functions --project demo-ninja-dojo ${EMULATOR_ARGS:-}
