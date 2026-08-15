#!/usr/bin/env node
/* Eenmalige, lokale claim van het eerste eigenaarsaccount.

   Dit hoort bewust niet in het publieke registratiegesprek: het eigenaarsadres
   is niet geheim en wie als eerste registreert mag nooit beheerder worden. Deze
   host-side stap leest RTG_OWNER_BOOTSTRAP uit het afgeschermde envbestand,
   vraagt het accountwachtwoord zonder echo en stuurt de claim alleen via de
   lokale HTTPS-poort. Na een succesvolle registratie verdwijnt de bootstrap-
   waarde atomisch uit het bestand. scripts/docker/live.sh herstart daarna de
   app, zodat de eenmalige deur ook uit het procesgeheugen weg is. */
'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');
const readline = require('readline');
const { Writable } = require('stream');
const { leesEnv } = require('./docker/start');

const ROOT = path.join(__dirname, '..');

function zonderBootstrap(tekst) {
  if (!/^RTG_OWNER_BOOTSTRAP=.+$/m.test(tekst))
    throw new Error('RTG_OWNER_BOOTSTRAP ontbreekt in het productie-envbestand.');
  return tekst.replace(/^RTG_OWNER_BOOTSTRAP=.+$/m,
    '# RTG_OWNER_BOOTSTRAP verwijderd na succesvolle eigenaarsclaim');
}

function schrijfZonderBootstrap(envPad, tekst) {
  const tijdelijk = envPad + '.claim-' + process.pid;
  fs.writeFileSync(tijdelijk, zonderBootstrap(tekst), { mode: 0o600, flag: 'wx' });
  try {
    fs.chmodSync(tijdelijk, 0o600);
    fs.renameSync(tijdelijk, envPad);
  } catch (e) {
    try { fs.unlinkSync(tijdelijk); } catch (_) {}
    throw e;
  }
}

function vragen() {
  const stil = new Writable({
    write(chunk, encoding, klaar) {
      if (!stil.geheim) process.stdout.write(chunk, encoding);
      klaar();
    }
  });
  const rl = readline.createInterface({ input: process.stdin, output: stil, terminal: !!process.stdin.isTTY });
  const vraag = (tekst, geheim = false) => new Promise(resolve => {
    if (geheim) process.stdout.write(tekst);
    stil.geheim = geheim;
    rl.question(geheim ? '' : tekst, antwoord => {
      stil.geheim = false;
      if (geheim) process.stdout.write('\n');
      resolve(String(antwoord || '').trim());
    });
  });
  return { vraag, sluit: () => rl.close() };
}

function plaatselijkeRegistratie({ poort, domein, body }) {
  const gegevens = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: '127.0.0.1', port: poort, path: '/api/auth/register', method: 'POST',
      servername: domein, rejectUnauthorized: false,
      headers: {
        Host: domein,
        'Content-Type': 'application/json',
        'Content-Length': gegevens.length
      },
      timeout: 10000
    }, res => {
      let rauw = '';
      res.setEncoding('utf8');
      res.on('data', stuk => { if (rauw.length < 100000) rauw += stuk; });
      res.on('end', () => {
        let data = {};
        try { data = JSON.parse(rauw); } catch (_) {}
        resolve({ status: res.statusCode || 0, data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('lokale HTTPS-aanvraag duurde te lang')));
    req.on('error', reject);
    req.end(gegevens);
  });
}

async function main() {
  const envPad = path.resolve(process.env.RTG_ENV_FILE || path.join(ROOT, '.env.productie'));
  const livePad = path.resolve(process.env.RTG_LIVE_ENV_FILE || path.join(ROOT, 'deploy', 'live.env'));
  const tekst = fs.readFileSync(envPad, 'utf8');
  const env = { ...leesEnv(tekst), ...process.env };
  const live = fs.existsSync(livePad) ? leesEnv(fs.readFileSync(livePad, 'utf8')) : {};
  const email = String(env.RTG_OWNER_EMAIL || '').trim().toLowerCase();
  const sleutel = String(env.RTG_OWNER_BOOTSTRAP || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('RTG_OWNER_EMAIL is ongeldig.');
  if (sleutel.length < 16) throw new Error('RTG_OWNER_BOOTSTRAP ontbreekt of is te kort.');
  const appUrl = new URL(String(env.APP_URL || ''));
  if (appUrl.protocol !== 'https:') throw new Error('APP_URL moet https zijn.');

  const dialoog = vragen();
  try {
    console.log('\nEerste RTG-eigenaar claimen voor ' + email + '.');
    const naam = process.env.RTG_OWNER_NAME || await dialoog.vraag('Volledige naam: ');
    const geboortedatum = process.env.RTG_OWNER_BIRTHDATE || await dialoog.vraag('Geboortedatum (JJJJ-MM-DD): ');
    const telefoon = process.env.RTG_OWNER_PHONE || await dialoog.vraag('Telefoon (optioneel): ');
    const wachtwoord = process.env.RTG_OWNER_PASSWORD || await dialoog.vraag('Nieuw wachtwoord (minimaal 12 tekens): ', true);
    const herhaal = process.env.RTG_OWNER_PASSWORD || await dialoog.vraag('Herhaal wachtwoord: ', true);
    if (naam.trim().length < 2) throw new Error('Vul de volledige naam in.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(geboortedatum)) throw new Error('Geboortedatum moet JJJJ-MM-DD zijn.');
    if (wachtwoord.length < 12) throw new Error('Het eigenaarswachtwoord moet minstens 12 tekens zijn.');
    if (wachtwoord !== herhaal) throw new Error('De wachtwoorden zijn niet gelijk.');

    const antwoord = await plaatselijkeRegistratie({
      poort: Number(live.RTG_PUBLISH_PORT || 443), domein: appUrl.hostname,
      body: { name: naam.trim(), email, phone: telefoon, geboortedatum, password: wachtwoord,
        tier: 'rtg', pasApp: 'rtg', eigenaarSleutel: sleutel }
    });
    if (antwoord.status < 200 || antwoord.status >= 300)
      throw new Error((antwoord.data && antwoord.data.error) || ('registratie gaf HTTP ' + antwoord.status));

    schrijfZonderBootstrap(envPad, tekst);
    console.log('✓ Eigenaarsaccount aangemaakt; bootstrapgeheim is verwijderd.');
    console.log('  Bevestig nu de e-mail en gebruik daarna de technische pagina.');
  } finally {
    dialoog.sluit();
  }
}

module.exports = { zonderBootstrap, schrijfZonderBootstrap, plaatselijkeRegistratie };

if (require.main === module) main().catch(e => {
  console.error('[eigenaar] ' + (e.message || e));
  process.exit(1);
});
