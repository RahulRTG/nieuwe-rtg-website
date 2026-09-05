/* Een wegwerpconfiguratie voor de werkelijk gestarte releasekandidaat.

   Deze configuratie bevat bewust GEEN productieprovider, klantgegeven,
   live-URL of blijvend geheim. De kandidaat mag zijn migrations, workers en
   readiness alleen tegen de aparte keur-Postgres/Redis uitvoeren. De echte
   productieconfiguratie wordt later uitsluitend door de eenmalige golive-
   controle gelezen; daarmee wordt nooit een applicatieserver gestart. */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function waarden() {
  const hex = () => crypto.randomBytes(32).toString('hex');
  const genesis = 'g-' + crypto.randomBytes(16).toString('hex');
  return {
    NODE_ENV: 'production',
    APP_URL: 'https://candidate.local',
    RTG_PRIVATE_BETA: '1',
    RTG_OWNER_EMAIL: 'candidate@keuring.invalid',
    RTG_OWNER_BOOTSTRAP: hex(),
    RTG_ENC_KEY: hex(),
    RTG_VAULT_KEY: hex(),
    RTG_SECRET_KEY: hex(),
    OFFICE_CODE: 'keur-' + crypto.randomBytes(12).toString('hex'),
    OFFICE_TOTP_SECRET: 'ABCDEFGHIJKLMNOP234567ABCDEFGHIJKLMNOP',
    RTG_ISOLATIE_AFDWINGEN: '1',
    RTG_PIN_ENTERPRISE: '1',
    DATABASE_URL: 'postgresql://rtg_keuring:rtg-candidate-db-only@keurpostgres:5432/rtg_keuring',
    REDIS_URL: 'redis://keurredis:6379',
    RTG_DATA_DIR: '/tmp/rtg-data',
    RTG_AI_UIT: '1',
    RTG_BETALEN_UIT: '1',
    RTG_HERSTEL_SMS_UIT_BEWUST: '1',
    RTG_MOTOR_GELD: 'uit',
    RTG_MAGNAAT_RUST: 'uit',
    RTG_CAPABILITY_RUST_MODE: 'uit',
    RTG_RUST_ALLES_UIT: '1',
    RTG_TLS: '0',
    RTG_ACME: '0',
    RTG_PROXY_HOPS: '0',
    RTG_MOTOR_TOKEN: hex(),
    RTG_MOTOR_STATE_KEY_FILE: '/run/secrets/rtg-keur-motor-state-key',
    RTG_MOTOR_EXPECT_GENESIS: genesis,
    RTG_UPLOADS_UIT: '1'
  };
}

function schrijfBestand(doel, tekst) {
  const absoluut = path.resolve(doel);
  fs.mkdirSync(path.dirname(absoluut), { recursive: true, mode: 0o700 });
  const tijdelijk = absoluut + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, tekst, { mode: 0o600, flag: 'wx' });
  fs.renameSync(tijdelijk, absoluut);
  fs.chmodSync(absoluut, 0o600);
  return absoluut;
}

function schrijf(doel, sleutelDoel, inhoud = waarden()) {
  if (!sleutelDoel) throw new Error('apart tijdelijk geldsnapshot-sleutelbestand ontbreekt');
  const absoluut = path.resolve(doel);
  const sleutelAbsoluut = path.resolve(sleutelDoel);
  if (fs.existsSync(absoluut) || fs.existsSync(sleutelAbsoluut))
    throw new Error('tijdelijke kandidaatconfiguratie of sleutel bestaat al');
  const id = 'k-' + crypto.randomBytes(8).toString('hex');
  try {
    schrijfBestand(sleutelAbsoluut, id + ':' + crypto.randomBytes(32).toString('hex') + '\n');
    const tekst = Object.entries(inhoud).map(([naam, waarde]) => naam + '=' + waarde).join('\n') + '\n';
    schrijfBestand(absoluut, tekst);
  } catch (e) {
    try { fs.unlinkSync(absoluut); } catch (_) {}
    try { fs.unlinkSync(sleutelAbsoluut); } catch (_) {}
    throw e;
  }
  return { envPad: absoluut, sleutelPad: sleutelAbsoluut, genesisId: inhoud.RTG_MOTOR_EXPECT_GENESIS };
}

module.exports = { waarden, schrijf, schrijfBestand };

if (require.main === module) {
  const doel = process.argv[2];
  const sleutelDoel = process.argv[3];
  if (!doel || !sleutelDoel || process.argv.length !== 4) {
    console.error('Gebruik: node scripts/keur-omgeving.js <tijdelijk-envbestand> <tijdelijke-geldsnapshotsleutel>');
    process.exit(64);
  }
  try { schrijf(doel, sleutelDoel); }
  catch (e) { console.error('[keur-omgeving] ' + e.message); process.exit(1); }
}
