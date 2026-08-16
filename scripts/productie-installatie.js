/* Interactieve, dependency-vrije productie-installatie.

   De sleutelgenerator blijft de enige maker van geheimen. Deze wizard vult de
   menselijk te kiezen waarden aan, toont geheimen nooit terug, schrijft het
   bestand atomair met rechten 0600 en laat daarna de bestaande go-live-keuring
   het eindoordeel geven. Een lege invoer behoudt een bestaand geheim. */
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const config = require('../server/config');

const ROOT = path.join(__dirname, '..');
const ENV_PAD = path.join(ROOT, '.env.productie');
const SENTINEL_TOKEN_PAD = path.join(ROOT, '.sentinel-token');
const GEHEIM = new Set([
  'RTG_ENC_KEY', 'RTG_VAULT_KEY', 'RTG_SECRET_KEY', 'RTG_CLUSTER_KEY',
  'RTG_MOTOR_TOKEN', 'POSTGRES_PASSWORD', 'OFFICE_CODE', 'OFFICE_TOTP_SECRET',
  'DEMO_PASS', 'RTG_OWNER_BOOTSTRAP', 'SMTP_URL', 'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET', 'RTG_MEDIA_S3_KEY', 'RTG_MEDIA_S3_SECRET'
]);

function leesEnvTekst(tekst) {
  const env = {};
  for (const regel of String(tekst || '').split(/\r?\n/)) {
    const r = regel.trim();
    if (!r || r.startsWith('#')) continue;
    const i = r.indexOf('=');
    if (i > 0) env[r.slice(0, i).trim()] = r.slice(i + 1).trim();
  }
  return env;
}

function veiligeWaarde(naam, waarde) {
  const s = String(waarde == null ? '' : waarde).trim();
  if (!/^[A-Z][A-Z0-9_]*$/.test(naam)) throw new Error('Ongeldige omgevingsnaam: ' + naam);
  if (/[\r\n\0]/.test(s)) throw new Error(naam + ' bevat een verboden regelovergang.');
  return s;
}

function werkEnvTekstBij(tekst, wijzigingen) {
  const over = new Map(Object.entries(wijzigingen).map(([k, v]) => [k, veiligeWaarde(k, v)]));
  const gezien = new Set();
  const regels = String(tekst || '').replace(/\s*$/, '').split(/\r?\n/).filter((r, i, a) => !(a.length === 1 && i === 0 && r === ''));
  const uit = [];
  for (const regel of regels) {
    const m = regel.match(/^\s*([A-Z][A-Z0-9_]*)=/);
    if (!m || !over.has(m[1])) { uit.push(regel); continue; }
    if (gezien.has(m[1])) continue; // dubbele waarheid verwijderen
    gezien.add(m[1]);
    uit.push(m[1] + '=' + over.get(m[1]));
  }
  if (uit.length) uit.push('');
  for (const [naam, waarde] of over) if (!gezien.has(naam)) uit.push(naam + '=' + waarde);
  return uit.join('\n').replace(/\n*$/, '\n');
}

function schrijfAtoom(doel, tekst) {
  fs.mkdirSync(path.dirname(doel), { recursive: true });
  const tijdelijk = doel + '.tmp-' + process.pid + '-' + Date.now();
  let fd;
  try {
    fd = fs.openSync(tijdelijk, 'wx', 0o600);
    fs.writeFileSync(fd, tekst, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = undefined;
    fs.renameSync(tijdelijk, doel);
    fs.chmodSync(doel, 0o600);
    try {
      const mapFd = fs.openSync(path.dirname(doel), 'r');
      try { fs.fsyncSync(mapFd); } finally { fs.closeSync(mapFd); }
    } catch (e) { /* niet ieder bestandssysteem ondersteunt een map-fsync */ }
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {}
    try { fs.unlinkSync(tijdelijk); } catch (e) {}
  }
}

function zorgVoorSentinelToken() {
  if (fs.existsSync(SENTINEL_TOKEN_PAD)) return false;
  const crypto = require('crypto');
  schrijfAtoom(SENTINEL_TOKEN_PAD, crypto.randomBytes(32).toString('hex') + '\n');
  return true;
}

function urlFout(naam, waarde, protocollen, verplicht = true) {
  if (!waarde && !verplicht) return null;
  try {
    const u = new URL(waarde);
    if (!protocollen.includes(u.protocol)) return naam + ' gebruikt niet ' + protocollen.join(' of ') + '.';
    if (!u.hostname) return naam + ' mist een hostnaam.';
    if (naam === 'APP_URL' && (u.username || u.password || u.pathname !== '/' || u.search || u.hash))
      return 'APP_URL hoort alleen het publieke basisadres te zijn.';
  } catch (e) { return naam + ' is geen geldige URL.'; }
  return null;
}

function valideerKeuzes(env) {
  const fouten = [];
  const email = String(env.RTG_OWNER_EMAIL || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fouten.push('RTG_OWNER_EMAIL is geen geldig e-mailadres.');
  for (const fout of [
    urlFout('APP_URL', env.APP_URL, ['https:']),
    urlFout('DATABASE_URL', env.DATABASE_URL, ['postgres:', 'postgresql:']),
    urlFout('REDIS_URL', env.REDIS_URL, ['redis:', 'rediss:']),
    urlFout('SMTP_URL', env.SMTP_URL, ['smtp:', 'smtps:']),
    urlFout('ERR_WEBHOOK_URL', env.ERR_WEBHOOK_URL, ['https:'], false)
  ]) if (fout) fouten.push(fout);
  if (env.RTG_BACKUP_DIR && !path.isAbsolute(env.RTG_BACKUP_DIR)) fouten.push('RTG_BACKUP_DIR moet een absoluut pad zijn.');
  if (env.RTG_MEDIA_BACKEND === 's3') {
    for (const naam of ['RTG_MEDIA_S3_BUCKET', 'RTG_MEDIA_S3_KEY', 'RTG_MEDIA_S3_SECRET'])
      if (!env[naam]) fouten.push(naam + ' is verplicht voor gedeelde S3-mediaopslag.');
    const ep = urlFout('RTG_MEDIA_S3_ENDPOINT', env.RTG_MEDIA_S3_ENDPOINT, ['http:', 'https:'], false);
    if (ep) fouten.push(ep);
  }
  return fouten;
}

function samenvatting(env) {
  const namen = [
    'RTG_OWNER_EMAIL', 'APP_URL', 'DATABASE_URL', 'REDIS_URL', 'SMTP_URL',
    'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'RTG_MEDIA_BACKEND',
    'RTG_MEDIA_S3_BUCKET', 'RTG_BACKUP_DIR', 'ERR_WEBHOOK_URL', 'RTG_MOTOR_GELD'
  ];
  return namen.map(naam => {
    const waarde = env[naam] || '';
    return { naam, waarde: GEHEIM.has(naam) ? (waarde ? '[ingesteld]' : '[leeg]') : (waarde || '[leeg]') };
  });
}

function vraag(label, opties = {}) {
  const input = opties.input || process.stdin;
  const output = opties.output || process.stdout;
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== 'function') {
    return Promise.reject(new Error('De installatiewizard vraagt een interactieve terminal.'));
  }
  const standaard = opties.standaard == null ? '' : String(opties.standaard);
  const toevoeging = opties.geheim
    ? (standaard ? ' [Enter = behouden]' : '')
    : (standaard ? ' [' + standaard + ']' : '');
  output.write(label + toevoeging + ': ');
  return new Promise((resolve, reject) => {
    let waarde = '';
    const wasRaw = !!input.isRaw;
    const klaar = (fout) => {
      input.off('data', invoer);
      try { input.setRawMode(wasRaw); } catch (e) {}
      output.write('\n');
      if (fout) reject(fout);
      else resolve(waarde || standaard);
    };
    const invoer = brok => {
      for (const teken of String(brok)) {
        if (teken === '\u0003') return klaar(new Error('Installatie afgebroken.'));
        if (teken === '\r' || teken === '\n') return klaar();
        if (teken === '\u007f' || teken === '\b') {
          if (waarde) { waarde = waarde.slice(0, -1); output.write('\b \b'); }
        } else if (teken >= ' ' && teken !== '\u007f') {
          waarde += teken;
          output.write(opties.geheim ? '•' : teken);
        }
      }
    };
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', invoer);
  });
}

async function jaNee(label, standaard, io) {
  const antwoord = (await vraag(label + ' (j/n)', { standaard: standaard ? 'j' : 'n', ...(io || {}) })).toLowerCase();
  if (!['j', 'ja', 'n', 'nee'].includes(antwoord)) throw new Error('Antwoord met j of n.');
  return antwoord === 'j' || antwoord === 'ja';
}

function zonderPlaceholder(v) { return /VUL-IN/i.test(String(v || '')) ? '' : String(v || ''); }

async function verzamel(huidig) {
  const compose = await jaNee('Draait deze installatie met de meegeleverde Docker Compose-opstelling', true);
  const pw = huidig.POSTGRES_PASSWORD || '';
  const wijzigingen = {};
  wijzigingen.RTG_OWNER_EMAIL = await vraag('E-mailadres van de eigenaar', { standaard: zonderPlaceholder(huidig.RTG_OWNER_EMAIL) });
  wijzigingen.APP_URL = await vraag('Publiek HTTPS-basisadres', { standaard: zonderPlaceholder(huidig.APP_URL) });
  wijzigingen.DATABASE_URL = await vraag('PostgreSQL-URL', { standaard: zonderPlaceholder(huidig.DATABASE_URL) ||
    (compose && pw ? 'postgresql://rtg:' + encodeURIComponent(pw) + '@postgres:5432/rtg' : '') });
  wijzigingen.REDIS_URL = await vraag('Redis-URL', { standaard: zonderPlaceholder(huidig.REDIS_URL) || (compose ? 'redis://redis:6379' : '') });
  wijzigingen.SMTP_URL = await vraag('SMTP-URL (wordt verborgen)', { standaard: zonderPlaceholder(huidig.SMTP_URL), geheim: true });
  wijzigingen.ERR_WEBHOOK_URL = await vraag('HTTPS-webhook voor externe foutalarmering (optioneel)', { standaard: huidig.ERR_WEBHOOK_URL || '' });
  wijzigingen.RTG_BACKUP_DIR = await vraag('Absoluut pad naar een tweede backupschijf/mount (optioneel)', { standaard: huidig.RTG_BACKUP_DIR || '' });

  const echtGeld = await jaNee('Moeten echte Stripe-betalingen bij livegang actief zijn', !!huidig.STRIPE_SECRET_KEY);
  if (echtGeld) {
    wijzigingen.STRIPE_SECRET_KEY = await vraag('Stripe secret key', { standaard: huidig.STRIPE_SECRET_KEY || '', geheim: true });
    wijzigingen.STRIPE_WEBHOOK_SECRET = await vraag('Stripe webhook secret', { standaard: huidig.STRIPE_WEBHOOK_SECRET || '', geheim: true });
    wijzigingen.STRIPE_DEMO_BEWUST = '';
    wijzigingen.STRIPE_UITGAAND_UIT_BEWUST = '1';
  } else {
    wijzigingen.STRIPE_SECRET_KEY = '';
    wijzigingen.STRIPE_WEBHOOK_SECRET = '';
    wijzigingen.STRIPE_DEMO_BEWUST = '1';
    wijzigingen.STRIPE_UITGAAND_UIT_BEWUST = '1';
  }

  const s3 = await jaNee('Gedeelde S3-compatibele mediaopslag gebruiken (nodig voor meerdere app-instances)', compose || huidig.RTG_MEDIA_BACKEND === 's3');
  wijzigingen.RTG_MEDIA_BACKEND = s3 ? 's3' : '';
  if (s3) {
    wijzigingen.RTG_MEDIA_S3_BUCKET = await vraag('S3-bucket', { standaard: huidig.RTG_MEDIA_S3_BUCKET || '' });
    wijzigingen.RTG_MEDIA_S3_REGION = await vraag('S3-regio', { standaard: huidig.RTG_MEDIA_S3_REGION || 'us-east-1' });
    wijzigingen.RTG_MEDIA_S3_ENDPOINT = await vraag('S3-endpoint (leeg voor AWS)', { standaard: huidig.RTG_MEDIA_S3_ENDPOINT || '' });
    wijzigingen.RTG_MEDIA_S3_KEY = await vraag('S3 access key', { standaard: huidig.RTG_MEDIA_S3_KEY || '', geheim: true });
    wijzigingen.RTG_MEDIA_S3_SECRET = await vraag('S3 secret key', { standaard: huidig.RTG_MEDIA_S3_SECRET || '', geheim: true });
    wijzigingen.RTG_MEDIA_S3_PREFIX = await vraag('S3-prefix', { standaard: huidig.RTG_MEDIA_S3_PREFIX || 'media/' });
  }
  wijzigingen.RTG_MOTOR_GELD = huidig.RTG_MOTOR_GELD || 'schaduw';
  return { wijzigingen, compose };
}

async function hoofd() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Open deze wizard in een interactieve terminal.');
  console.log('\nRTG productie-installatie: geheimen worden gemaskeerd en nooit gelogd.\n');
  if (!fs.existsSync(ENV_PAD)) {
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'sleutels.js'), '--schrijf', '--stil'], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) throw new Error('De veilige sleutelgenerator kon .env.productie niet maken.');
  }
  if (zorgVoorSentinelToken())
    console.log('Losse Sentinel-beheersleutel gemaakt (niet gedeeld met de app).');
  const oudTekst = fs.readFileSync(ENV_PAD, 'utf8');
  const huidig = leesEnvTekst(oudTekst);
  const { wijzigingen, compose } = await verzamel(huidig);
  const kandidaat = { ...huidig, ...wijzigingen, NODE_ENV: 'production' };
  const invoerFouten = valideerKeuzes(kandidaat);
  const keuring = config.valideer(kandidaat);

  console.log('\nSamenvatting (geheimen blijven verborgen):');
  for (const r of samenvatting(kandidaat)) console.log(' - ' + r.naam.padEnd(29) + r.waarde);
  for (const fout of invoerFouten) console.log(' ✗ ' + fout);
  for (const fout of keuring.fouten) console.log(' ✗ ' + fout);
  for (const waarschuwing of keuring.waarschuwingen) console.log(' ⚠ ' + waarschuwing);
  if (invoerFouten.length) throw new Error('Herstel de ongeldige invoer; er is niets geschreven.');
  if (!(await jaNee('Deze waarden atomair naar .env.productie schrijven', false))) throw new Error('Niets gewijzigd.');

  schrijfAtoom(ENV_PAD, werkEnvTekstBij(oudTekst, wijzigingen));
  console.log('\n.env.productie is atomair bijgewerkt met rechten 600.');
  console.log(compose
    ? 'Controleer binnen het Compose-netwerk: docker compose --env-file .env.productie run --rm app npm run golive'
    : 'Controleer nu: npm run golive');
  console.log('Rond ook het papierwerk af via de eigenaarspagina; de go-live-keuring blokkeert zolang dat openstaat.');
}

if (require.main === module) hoofd().catch(fout => { console.error('\n[installatie] ' + fout.message); process.exitCode = 1; });

module.exports = { leesEnvTekst, werkEnvTekstBij, schrijfAtoom, valideerKeuzes, samenvatting, veiligeWaarde, zorgVoorSentinelToken };
