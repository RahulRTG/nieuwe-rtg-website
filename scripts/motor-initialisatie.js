/* Bereidt uitsluitend de expliciete, eenmalige Compose-initialisatie van het
   geldvolume voor. Dit bestand start geen container en maakt geen sleutel.
   De gekozen genesis wordt eerst atomair in de productieconfig vastgelegd;
   een retry gebruikt daardoor exact dezelfde identiteit. */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { leesEnvTekst, werkEnvTekstBij, schrijfAtoom } = require('./productie-installatie');

const CONTAINER_SLEUTEL = '/run/secrets/rtg-motor-state-key';
const GENESIS = /^g-[a-f0-9]{32}$/;
const SLEUTELREGEL = /^([A-Za-z0-9._-]{1,40}):([a-f0-9]{64})$/;

function eisPriveBestand(pad, naam) {
  let stat;
  try { stat = fs.lstatSync(pad); }
  catch (e) { throw new Error(naam + ' ontbreekt: ' + pad); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(naam + ' moet een regulier bestand zijn: ' + pad);
  if ((stat.mode & 0o077) !== 0) throw new Error(naam + ' is te breed leesbaar; vereist rechten 600: ' + pad);
}

function leesSleutelring(sleutelPad) {
  eisPriveBestand(sleutelPad, 'aparte geldsnapshotsleutel');
  const regels = fs.readFileSync(sleutelPad, 'utf8').split(/\r?\n/);
  if (regels.at(-1) === '') regels.pop();
  if (!regels.length) throw new Error('geldsnapshot-sleutelring is leeg');
  const gezien = new Set();
  for (const regel of regels) {
    const raak = regel.match(SLEUTELREGEL);
    if (!raak) throw new Error('geldsnapshot-sleutelring heeft een ongeldige regel');
    if (gezien.has(raak[1])) throw new Error('geldsnapshot-sleutelring heeft een dubbel key-id');
    gezien.add(raak[1]);
  }
  return regels.at(-1).split(':')[0];
}

function bereidVoor({ envPad, sleutelPad, randomBytes = crypto.randomBytes }) {
  envPad = path.resolve(envPad);
  sleutelPad = path.resolve(sleutelPad);
  eisPriveBestand(envPad, 'productieconfiguratie');
  const keyId = leesSleutelring(sleutelPad);
  const oud = fs.readFileSync(envPad, 'utf8');
  const env = leesEnvTekst(oud);
  const bestaandPad = String(env.RTG_MOTOR_STATE_KEY_FILE || '');
  if (bestaandPad && bestaandPad !== CONTAINER_SLEUTEL)
    throw new Error('RTG_MOTOR_STATE_KEY_FILE wijst niet naar het vaste Compose-secretpad');
  let genesisId = String(env.RTG_MOTOR_EXPECT_GENESIS || '');
  if (genesisId && !GENESIS.test(genesisId))
    throw new Error('RTG_MOTOR_EXPECT_GENESIS heeft geen geldige g-<32 lowercase hex>-vorm');
  const nieuw = !genesisId;
  if (nieuw) genesisId = 'g-' + randomBytes(16).toString('hex');
  if (!GENESIS.test(genesisId)) throw new Error('generator leverde geen geldige genesis-identiteit');
  const tekst = werkEnvTekstBij(oud, {
    RTG_MOTOR_STATE_KEY_FILE: CONTAINER_SLEUTEL,
    RTG_MOTOR_EXPECT_GENESIS: genesisId
  });
  if (tekst !== oud) schrijfAtoom(envPad, tekst);
  return { genesisId, keyId, nieuw, envPad, sleutelPad };
}

function optie(argv, naam, standaard) {
  const voor = naam + '=';
  const raak = argv.find(x => x.startsWith(voor));
  return raak ? raak.slice(voor.length) : standaard;
}

function hoofd(argv = process.argv.slice(2)) {
  const root = path.join(__dirname, '..');
  const envPad = optie(argv, '--env', path.join(root, '.env.productie'));
  const sleutelPad = optie(argv, '--sleutel', path.join(root, '.rtg-secrets', 'motor_state_key'));
  if (argv.some(x => !x.startsWith('--env=') && !x.startsWith('--sleutel=')))
    throw new Error('gebruik alleen --env=<bestand> en --sleutel=<bestand>');
  const resultaat = bereidVoor({ envPad, sleutelPad });
  process.stdout.write(resultaat.genesisId + '\n');
}

if (require.main === module) {
  try { hoofd(); }
  catch (e) { console.error('[motor-init] ' + e.message); process.exitCode = 1; }
}

module.exports = { bereidVoor, leesSleutelring, eisPriveBestand, CONTAINER_SLEUTEL, GENESIS };
