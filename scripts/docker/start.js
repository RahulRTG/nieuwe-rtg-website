/* Veilige Docker-startwikkel.

   Docker Compose gebruikt een gemount geheimenbestand in plaats van tientallen
   Environment-regels. Daardoor verschijnen RTG_VAULT_KEY, SMTP-wachtwoorden en
   API-sleutels niet in `docker inspect`. Het bestand wordt net als de Mac-
   wikkel letterlijk gelezen: nooit `source`, nooit shell-evaluatie. */
'use strict';

const fs = require('fs');
const { spawn } = require('child_process');

function leesEnv(tekst) {
  const uit = {};
  let regelnummer = 0;
  for (const rauw of String(tekst || '').split(/\r?\n/)) {
    regelnummer++;
    let regel = rauw.trim();
    if (!regel || regel.startsWith('#')) continue;
    if (regel.startsWith('export ')) regel = regel.slice(7).trim();
    const i = regel.indexOf('=');
    if (i < 1) continue;
    const naam = regel.slice(0, i).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(naam))
      throw new Error('ongeldige variabelenaam op regel ' + regelnummer);
    let waarde = regel.slice(i + 1).trim();
    if ((waarde.startsWith('"') && waarde.endsWith('"')) ||
        (waarde.startsWith("'") && waarde.endsWith("'"))) waarde = waarde.slice(1, -1);
    if (waarde.includes('\0')) throw new Error('nulbyte in ' + naam);
    uit[naam] = waarde;
  }
  return uit;
}

function laadBestand(pad, env = process.env) {
  const waarden = leesEnv(fs.readFileSync(pad, 'utf8'));
  for (const [naam, waarde] of Object.entries(waarden)) {
    if (env[naam] == null || env[naam] === '') env[naam] = waarde;
  }
  return waarden;
}

function leesGeheim(pad) {
  const waarde = fs.readFileSync(pad, 'utf8').replace(/[\r\n]+$/, '');
  if (!waarde || waarde.length < 16) throw new Error('leeg of te kort geheim in ' + pad);
  return waarde;
}

function bouwOmgeving(env = process.env) {
  const envPad = env.RTG_ENV_FILE || '/run/secrets/rtg_env';
  if (!fs.existsSync(envPad)) throw new Error('RTG-geheimenbestand ontbreekt: ' + envPad);
  laadBestand(envPad, env);

  const pgPad = env.RTG_POSTGRES_PASSWORD_FILE || '/run/secrets/postgres_password';
  if (!env.DATABASE_URL && fs.existsSync(pgPad)) {
    const wachtwoord = encodeURIComponent(leesGeheim(pgPad));
    env.DATABASE_URL = 'postgresql://rtg:' + wachtwoord + '@postgres:5432/rtg';
  }
  if (!env.REDIS_URL) env.REDIS_URL = 'redis://redis:6379';
  return env;
}

function start(doel, env = process.env) {
  bouwOmgeving(env);
  let opdracht;
  if (doel === 'app') opdracht = [process.execPath, ['server/server.js']];
  else if (doel === 'motor') opdracht = ['/app/rtg-motor', []];
  else throw new Error('onbekend Docker-doel: ' + doel);

  if (doel === 'motor' && String(env.RTG_MOTOR_TOKEN || '').length < 16)
    throw new Error('RTG_MOTOR_TOKEN ontbreekt of is te kort');

  const kind = spawn(opdracht[0], opdracht[1], { env, stdio: 'inherit' });
  let afsluiten = false;
  for (const signaal of ['SIGTERM', 'SIGINT']) process.on(signaal, () => {
    if (afsluiten) return;
    afsluiten = true;
    try { kind.kill(signaal); } catch (e) {}
  });
  kind.on('error', (e) => { console.error('[docker-start] starten mislukt:', e.message); process.exit(1); });
  kind.on('exit', (code, signaal) => {
    if (signaal) process.kill(process.pid, signaal);
    else process.exit(code == null ? 1 : code);
  });
  return kind;
}

module.exports = { leesEnv, laadBestand, leesGeheim, bouwOmgeving, start };

if (require.main === module) {
  try { start(process.argv[2] || 'app'); }
  catch (e) { console.error('[docker-start] ' + e.message); process.exit(78); }
}
