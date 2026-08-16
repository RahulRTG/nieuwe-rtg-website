#!/bin/sh
# Maakt een publieke sleutel voor de server en een privésleutel die meteen naar
# offline/opslag buiten de server hoort. Zonder het tweede argument schrijven we
# bewust niets: een privésleutel naast de back-ups zou de versleuteling opheffen.
set -eu
umask 077

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
prive="${1:-}"
publiek="${2:-$ROOT/.rtg-secrets/backup_public_cert.pem}"
[ -n "$prive" ] || {
  echo "Gebruik: npm run backup:sleutel -- /pad/op/offline-medium/rtg-backup-private.pem [publiek-certificaat]" >&2
  exit 64
}
[ ! -e "$prive" ] || { echo "[backup-sleutel] privésleutel bestaat al; overschrijven geweigerd" >&2; exit 73; }
[ ! -e "$publiek" ] || { echo "[backup-sleutel] publiek certificaat bestaat al; overschrijven geweigerd" >&2; exit 73; }
command -v openssl >/dev/null 2>&1 || { echo "[backup-sleutel] OpenSSL ontbreekt" >&2; exit 69; }
mkdir -p "$(dirname "$prive")" "$(dirname "$publiek")"
openssl req -x509 -newkey rsa:3072 -sha256 -nodes -days 3650 \
  -subj "/CN=RTG offline backup/" -keyout "$prive" -out "$publiek" >/dev/null 2>&1
chmod 600 "$prive" "$publiek"
echo "[backup-sleutel] publieke sleutel voor de server: $publiek"
echo "[backup-sleutel] PRIVESLEUTEL OFFLINE BEWAREN EN VAN DE SERVER VERWIJDEREN: $prive"
