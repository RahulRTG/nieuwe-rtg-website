#!/usr/bin/env node
'use strict';

/* De www toont geen nagetekende productkaarten. Dit gereedschap start een
   wegwerpomgeving, opent de echte app en legt drie rollen vast. Testgegevens
   blijven in de tijdelijke datamap en worden na afloop verwijderd. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { start } = require('./lib/wegwerpserver');
const { startChromium } = require('./lib/scherm');
const { haalSessies, opslagVoor } = require('./lib/proefsessies');
const { schermBronHash, PLATFORM } = require('./websitewaarheid');

const ROOT = path.join(__dirname, '..');
const DOEL = path.join(ROOT, 'public/images/start/app-schermen');

async function post(basis, pad, body) {
  const antwoord = await fetch(basis + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body) });
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok) throw new Error(pad + ' gaf ' + antwoord.status + ': ' + JSON.stringify(data).slice(0, 180));
  return data;
}

async function postMetToken(basis, pad, body, token) {
  const antwoord = await fetch(basis + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token
  }, body: JSON.stringify(body || {}) });
  const data = await antwoord.json().catch(() => ({}));
  if (!antwoord.ok) throw new Error(pad + ' gaf ' + antwoord.status + ': ' + JSON.stringify(data).slice(0, 180));
  return data;
}

async function rondLidAf(basis, token) {
  let status = await postMetToken(basis, '/api/onboarding/status', {}, token);
  const waarden = { geboortedatum: '1985-05-05', naam: 'Rahul Imran',
    email: 'roellie.i@gmail.com', telefoon: '0612345678', adres: 'Voorbeeldstraat 1',
    postcode: '1000 AA', woonplaats: 'Amsterdam', land: 'Nederland', nationaliteit: 'Nederlands' };
  const velden = {};
  (status.velden || []).filter((veld) => !veld.ingevuld && veld.type !== 'kyc')
    .forEach((veld) => { if (waarden[veld.id]) velden[veld.id] = waarden[veld.id]; });
  if (Object.keys(velden).length) status = await postMetToken(basis, '/api/onboarding/opslaan', { velden }, token);
  if (!status.klaar) status = await postMetToken(basis, '/api/onboarding/teken', {
    naam: 'Rahul Imran', akkoord: true, contractVersion: status.contract.versie
  }, token);
  if (!status.klaar) throw new Error('de demosessie kon niet volledig worden afgerond');
}

async function werkSessie(basis) {
  const ruimte = await post(basis, '/api/bedrijf/werkruimte/maak', { naam: 'Voorbeeldorganisatie', land: 'NL' });
  const lid = await post(basis, '/api/bedrijf/lid/aanmeld', { werkruimte: ruimte.werkruimte, naam: 'Samira' });
  await post(basis, '/api/bedrijf/lid/besluit', { werkruimte: ruimte.werkruimte,
    beheerToken: ruimte.beheerToken, lidId: lid.lidId, akkoord: true });
  await post(basis, '/api/bedrijf/lid/rollen', { werkruimte: ruimte.werkruimte,
    beheerToken: ruimte.beheerToken, lidId: lid.lidId, rollen: ['projectleider'] });
  await post(basis, '/api/bedrijf/project/maak', { werkruimte: ruimte.werkruimte, lidToken: lid.lidToken,
    naam: 'Nieuwe locatie Utrecht', werkvorm: 'stadsuitrol' });
  return { werkruimte: ruimte.werkruimte, lidToken: lid.lidToken };
}

async function main() {
  fs.mkdirSync(DOEL, { recursive: true });
  const server = await start({ naam: 'websitebeelden', env: { RTG_DEMO: '1', NODE_ENV: 'test' } });
  let browser;
  try {
    const rollen = await haalSessies(server.basis, ['zaak']);
    if (rollen.overgeslagen.length) throw new Error('app-sessie ontbreekt: ' + JSON.stringify(rollen.overgeslagen));
    const opslag = opslagVoor(rollen.sessies);
    const eigenaar = await post(server.basis, '/api/auth/login', {
      login: 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran'
    });
    if (!eigenaar.token) throw new Error('de bestaande demosessie leverde geen lid-token op');
    await rondLidAf(server.basis, eigenaar.token);
    opslag.rtg_member_token = eigenaar.token;
    opslag.rtg_werk_sessie = JSON.stringify(await werkSessie(server.basis));
    opslag.rtg_lang = 'nl';

    const gestart = await startChromium({ headless: true });
    if (!gestart) throw new Error('geen Chromium beschikbaar om echte app-schermen vast te leggen');
    browser = gestart.browser;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
      serviceWorkers: 'block', colorScheme: 'light' });
    await context.addInitScript((waarden) => {
      Object.keys(waarden).forEach((sleutel) => localStorage.setItem(sleutel, waarden[sleutel]));
    }, opslag);
    const page = await context.newPage();
    const wachten = { organisatie: '#inhoud:not([hidden])', partner: '#app.active', gebruiker: 'body' };
    const screens = [];
    for (const scherm of PLATFORM) {
      await page.goto(server.basis + scherm.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForSelector(wachten[scherm.id], { state: 'visible', timeout: 25000 });
      await page.waitForTimeout(2200);
      if (scherm.id === 'gebruiker') {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
      }
      const bestand = path.join(DOEL, scherm.id + '.png');
      await page.screenshot({ path: bestand, fullPage: false });
      screens.push({ id: scherm.id, route: scherm.route, file: scherm.id + '.png',
        sourceHash: schermBronHash(scherm.route), imageHash: crypto.createHash('sha256').update(fs.readFileSync(bestand)).digest('hex') });
    }
    fs.writeFileSync(path.join(DOEL, 'HERKOMST.json'), JSON.stringify({
      kind: 'Schermafbeeldingen uit de echte RTG-app in een lokale wegwerpomgeving',
      viewport: { width: 390, height: 844 }, screens
    }, null, 2) + '\n');
    console.log('[websitebeelden] drie echte app-schermen bijgewerkt via ' + gestart.waarmee);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.klaar();
  }
}

main().catch((fout) => { console.error('[websitebeelden] ' + fout.message); process.exitCode = 1; });
