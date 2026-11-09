#!/usr/bin/env node
/* Handmatige bediening voor server/lib/ankerherstel.js.

   sleutel PRIVE.pem PUBLIEK.txt
     Maakt een APART Ed25519-paar. PRIVE.pem hoort offline/afgeschermd en gaat
     nooit in de app. PUBLIEK.txt gaat naar app én ankerontvanger.

   teken DOSSIER.json VERKLARING.json
     Tekent een vooraf beoordeeld dossier. De private sleutel komt uitsluitend
     uit RTG_ANKER_HERSTEL_SIGN_KEY_FILE; niet uit een argument of de database.
     Het doelbestand moet nog niet bestaan.

   controleer VERKLARING.json
     Toetst met RTG_ANKER_HERSTEL_PUBLIEK of
     RTG_ANKER_HERSTEL_PUBLIEK_BESTAND.
*/
'use strict';

const fs = require('fs');
const crypto = require('crypto');
const herstel = require('../server/lib/ankerherstel');

function schrijfNieuw(bestand, inhoud, mode) {
  const fd = fs.openSync(bestand, 'wx', mode);
  try { fs.writeFileSync(fd, inhoud); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function sleutel(privePad, publiekPad) {
  if (!privePad || !publiekPad) throw new Error('gebruik: ankerherstel sleutel PRIVE.pem PUBLIEK.txt');
  const paar = crypto.generateKeyPairSync('ed25519');
  const prive = paar.privateKey.export({ type: 'pkcs8', format: 'pem' });
  const publiek = paar.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64') + '\n';
  schrijfNieuw(privePad, prive, 0o600);
  try { schrijfNieuw(publiekPad, publiek, 0o644); }
  catch (e) { try { fs.unlinkSync(privePad); } catch {} throw e; }
  return { gemaakt: true, prive: privePad, publiek: publiekPad };
}

function teken(dossierPad, uitPad, env = process.env) {
  if (!dossierPad || !uitPad) throw new Error('gebruik: ankerherstel teken DOSSIER.json VERKLARING.json');
  if (!env.RTG_ANKER_HERSTEL_SIGN_KEY_FILE) throw new Error('RTG_ANKER_HERSTEL_SIGN_KEY_FILE ontbreekt');
  const dossier = JSON.parse(fs.readFileSync(dossierPad, 'utf8'));
  const prive = crypto.createPrivateKey(fs.readFileSync(env.RTG_ANKER_HERSTEL_SIGN_KEY_FILE, 'utf8'));
  const verklaring = herstel.teken(dossier, prive);
  schrijfNieuw(uitPad, JSON.stringify(verklaring, null, 2) + '\n', 0o444);
  return { getekend: true, id: verklaring.id, journaal: verklaring.journaal,
    vanTijdvak: herstel.tijdvakVan(verklaring.van), tijdvak: herstel.tijdvakVan(verklaring.naar), uit: uitPad };
}

function controleer(pad, env = process.env) {
  if (!pad) throw new Error('gebruik: ankerherstel controleer VERKLARING.json');
  const verklaring = JSON.parse(fs.readFileSync(pad, 'utf8'));
  return herstel.controleer(verklaring, herstel.publiekUitOmgeving(env));
}

function main() {
  const [cmd, a, b] = process.argv.slice(2);
  let uit;
  if (cmd === 'sleutel') uit = sleutel(a, b);
  else if (cmd === 'teken') uit = teken(a, b);
  else if (cmd === 'controleer') uit = controleer(a);
  else throw new Error('gebruik: ankerherstel <sleutel|teken|controleer> ...');
  console.log(JSON.stringify(uit));
  if (cmd === 'controleer' && !uit.geldig) process.exitCode = 1;
}

if (require.main === module) {
  try { main(); } catch (e) { console.error(JSON.stringify({ fout: String(e && e.message || e).slice(0, 300) })); process.exitCode = 1; }
}

module.exports = { sleutel, teken, controleer };
