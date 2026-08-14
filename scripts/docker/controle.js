/* Snelle self-host-keuring zonder Docker te hoeven starten. Controleert de
   geheimen, placeholders, bestandsrechten en dezelfde productiepoorten als de
   server. Netwerkafhankelijke controles volgen later via npm run golive. */
'use strict';

const fs = require('fs');
const path = require('path');
const { leesEnv, leesGeheim } = require('./start');
const config = require('../../server/config');

const ROOT = path.join(__dirname, '..', '..');
const envPad = path.resolve(process.env.RTG_ENV_FILE || path.join(ROOT, '.env.productie'));
const pgPad = path.resolve(process.env.RTG_POSTGRES_PASSWORD_FILE || path.join(ROOT, '.rtg-secrets', 'postgres_password'));
const fouten = [], waarschuwingen = [];

function rechten(pad, geheim) {
  try {
    const mode = fs.statSync(pad).mode & 0o777;
    if (mode & 0o077) fouten.push(pad + ' is te breed leesbaar (' + mode.toString(8) + '); vereist 600.');
    if (!geheim) fouten.push(pad + ' is leeg.');
  } catch (e) { fouten.push(pad + ' ontbreekt.'); }
}

let env = {};
try {
  const tekst = fs.readFileSync(envPad, 'utf8');
  rechten(envPad, tekst.trim());
  if (/VUL-IN/.test(tekst)) fouten.push(envPad + ' bevat nog VUL-IN-plaatsen.');
  env = { ...leesEnv(tekst), NODE_ENV: 'production', REDIS_URL: 'redis://redis:6379' };
} catch (e) { if (!fouten.length) fouten.push(e.message); }

try {
  const pg = leesGeheim(pgPad);
  rechten(pgPad, pg);
  env.DATABASE_URL = 'postgresql://rtg:' + encodeURIComponent(pg) + '@postgres:5432/rtg';
} catch (e) { fouten.push(e.message); }

const uitslag = config.valideer(env);
fouten.push(...uitslag.fouten);
waarschuwingen.push(...uitslag.waarschuwingen);

console.log('\n=== RTG self-host-keuring ===\n');
for (const f of fouten) console.log(' ✗ ' + f);
for (const w of waarschuwingen) console.log(' ⚠ ' + w);
if (fouten.length) {
  console.log('\nNiet startklaar: ' + fouten.length + ' blokkerende fout(en).');
  process.exit(1);
}
console.log('\n✓ Geheimen en productieconfiguratie zijn startklaar.' +
  (env.RTG_PRIVATE_BETA === '1' ? ' De app blijft een private, lokale beta.' : ' Draai voor publieke livegang ook npm run golive.'));
