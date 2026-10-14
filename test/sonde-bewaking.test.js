/* DE SONDE VAN BUITENAF, ONAFHANKELIJK GETOETST (WEERBAARHEID.md par. 9a stap 2
   en par. 9e, "onafhankelijke waarneming" en "geen vals veiligheidsgevoel").

   Het alarm in het proces kan zijn eigen uitval niet zien. Daarvoor is er
   scripts/sonde.js, die op een andere machine draait. Deze toets draait de sonde
   daarom zoals hij echt draait -- als eigen proces, met een echte exitcode -- en
   zet er servers tegenover die op de vijf manieren falen waarop een bewaking
   verdwijnt zonder het te zeggen:

     1. de hele server is weg (er luistert niets meer);
     2. de server draait, maar de interne bewaking is niet te lezen (500, of een
        antwoord zonder bewakingsveld -- een oude of gemanipuleerde meetroute);
     3. een sensor is stil;
     4. de sensoren staan "uit" -- bewust niet gestart, en dus ook niet bewaakt;
     5. de server neemt de verbinding aan en antwoordt nooit.

   In alle vijf hoort de sonde NIET groen te geven en met exitcode 1 af te
   sluiten, zodat cron of de piketdienst er iets mee kan. Alleen als alle
   sensoren stempelen, is de bewaking gelukt. En de laatste toets zet hem
   tegenover de echte server, achter de echte meetpoort.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de regel voor "uit" weghalen uit bewakingMonster
     -> "4. sensoren die uit staan zijn niet bewaakt" ZAKT (RAAK)
   - de tijdslimiet (metEinde) weghalen
     -> "5. een server die nooit antwoordt" ZAKT (RAAK, de sonde blijft hangen)
   - `!b || !Array.isArray(b.stil)` vervangen door `false`
     -> "2. de bewaking is niet te lezen" ZAKT (RAAK)

   Draai: node --test test/sonde-bewaking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const SONDE = path.join(__dirname, '..', 'scripts', 'sonde.js');
const SLO = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'SLO.json'), 'utf8'));
const TOKEN = 'sonde-toets-token-dat-lang-genoeg-is';

/* De sonde als eigen proces. Geeft de exitcode, de uitvoer en de monsters uit
   --json terug. */
function draai(basis, extra, wachtMs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sonde-'));
  const uit = path.join(dir, 'monsters.json');
  return new Promise((resolve) => {
    execFile(process.execPath, [SONDE, basis, '--json=' + uit, '--wacht=' + (wachtMs || 1500)].concat(extra || []),
      { timeout: 60000, env: Object.assign({}, process.env, { RTG_METRICS_TOKEN: '' }) },
      (fout, stdout) => {
        let monsters = null;
        try { monsters = JSON.parse(fs.readFileSync(uit, 'utf8')).monsters; } catch (e) { /* geen bestand */ }
        fs.rmSync(dir, { recursive: true, force: true });
        resolve({ code: fout ? fout.code : 0, gedood: !!(fout && fout.killed), stdout, monsters });
      });
  });
}

const bewaking = (monsters) => (monsters || []).find(m => m.reis === 'bewaking');

/* Een nepserver die elke reis uit SLO.json beantwoordt zoals verwacht, en de
   meetroute zoals het scenario zegt. `gezien` houdt de koppen van de
   meetroute bij, zodat de toets kan zien dat het token echt meegaat. */
async function nepServer(meetroute) {
  const gezien = [];
  const srv = http.createServer((req, res) => {
    const pad = req.url.split('?')[0];
    if (pad === '/api/metrics/kort') { gezien.push(req.headers); return meetroute(req, res); }
    const reis = SLO.reizen.find(r => r.pad === pad);
    res.statusCode = reis && Array.isArray(reis.verwacht) ? reis.verwacht[0] : 200;
    res.end('{}');
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  return { basis: 'http://127.0.0.1:' + srv.address().port, gezien,
    sluit: () => new Promise(r => { srv.closeAllConnections(); srv.close(r); }) };
}

const json = (status, body) => (req, res) => {
  res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body));
};

test('0. alle sensoren stempelen: groen, exitcode 0, en het token gaat mee', async () => {
  const s = await nepServer(json(200, { bewaking: { actief: false, stil: [], uit: [], sensoren: [] } }));
  try {
    const r = await draai(s.basis, ['--token=' + TOKEN]);
    assert.equal(r.code, 0, r.stdout);
    const b = bewaking(r.monsters);
    assert.ok(b && b.gelukt, 'de bewaking is gelukt');
    assert.equal(b.status, 200);
    assert.equal(s.gezien[0].authorization, 'Bearer ' + TOKEN, 'het token gaat als Bearer mee');
    assert.equal(s.gezien[0]['x-rtg-sonde'], '1');
  } finally { await s.sluit(); }
});

test('0b. zonder token en zonder --bewaking vraagt hij de bewaking niet, en zegt dat ook niet', async () => {
  const s = await nepServer(json(200, { bewaking: { stil: [], uit: [] } }));
  try {
    const r = await draai(s.basis);
    assert.equal(r.code, 0, r.stdout);
    assert.equal(bewaking(r.monsters), undefined, 'geen monster, dus ook geen groen vinkje');
    assert.equal(s.gezien.length, 0, 'de meetroute is niet aangeroepen');
  } finally { await s.sluit(); }
});

test('1. de hele server is weg: alles mislukt, de bewaking ook, exitcode 1', async () => {
  /* Een poort die net nog luisterde en nu dicht is: de server is van de aarde. */
  const s = await nepServer(json(200, {}));
  const basis = s.basis;
  await s.sluit();
  const r = await draai(basis, ['--bewaking']);
  assert.equal(r.code, 1, 'een volledige uitval is geen groene sonde');
  assert.ok(r.monsters.length >= SLO.reizen.length + 1);
  assert.ok(r.monsters.every(m => !m.gelukt), 'geen enkele reis is gelukt');
  assert.match(bewaking(r.monsters).reden, /^geen antwoord/);
});

test('2. de interne bewaking is niet te lezen: een 500 of een antwoord zonder bewaking is niet groen', async () => {
  for (const [naam, route] of [
    ['500', json(500, { error: 'kapot' })],
    ['zonder bewakingsveld', json(200, { verzoeken: 10 })],
    ['stil is geen lijst', json(200, { bewaking: { stil: 'niets' } })],
    ['geen json', (req, res) => { res.statusCode = 200; res.end('<html>'); }],
    ['poort dicht (404)', json(404, { error: 'Niet gevonden' })]
  ]) {
    const s = await nepServer(route);
    try {
      const r = await draai(s.basis, ['--token=' + TOKEN]);
      const b = bewaking(r.monsters);
      assert.equal(r.code, 1, naam + ': exitcode 1');
      assert.equal(b.gelukt, false, naam + ': niet gelukt');
      assert.match(b.reden, /de bewaking is niet te lezen/, naam);
      /* De reizen zelf zijn gelukt: de sonde onderscheidt "de app draait" van
         "de bewaking draait", en dat tweede is waar het hier om gaat. */
      assert.ok(r.monsters.filter(m => m.reis !== 'bewaking').every(m => m.gelukt), naam + ': de reizen zelf slaagden');
    } finally { await s.sluit(); }
  }
});

test('3. een stille sensor wordt bij naam genoemd en geeft exitcode 1', async () => {
  const s = await nepServer(json(200, { bewaking: { stil: ['alarm', 'wacht'], uit: [] } }));
  try {
    const r = await draai(s.basis, ['--token=' + TOKEN]);
    assert.equal(r.code, 1);
    assert.equal(bewaking(r.monsters).reden, 'stil: alarm, wacht');
    assert.match(r.stdout, /bewaking.*stil: alarm, wacht/);
  } finally { await s.sluit(); }
});

test('4. sensoren die uit staan zijn niet bewaakt: geen groen vinkje van buitenaf', async () => {
  /* Wie de tikkers uitzet (meetserverstand), krijgt intern "uit" en geen
     stilte -- terecht, het is een uitspraak. Maar bewaakt is er dan niets, en
     een sonde die daar groen op gaf, gaf precies het valse veiligheidsgevoel
     dat par. 9e uitsluit. */
  const s = await nepServer(json(200, { bewaking: { stil: [], uit: ['alarm', 'canary', 'wacht'] } }));
  try {
    const r = await draai(s.basis, ['--token=' + TOKEN]);
    assert.equal(r.code, 1);
    const b = bewaking(r.monsters);
    assert.equal(b.gelukt, false);
    assert.equal(b.reden, 'bewust uit, dus niet bewaakt: alarm, canary, wacht');
  } finally { await s.sluit(); }
});

test('5. een server die nooit antwoordt laat de sonde niet hangen', async () => {
  /* De verbinding wordt aangenomen en nooit beantwoord -- op de meetroute en
     op elke reis. Zonder tijdslimiet bleef de sonde hier eeuwig staan, en dan
     is de externe wachter zelf stil. */
  const hangers = [];
  const srv = http.createServer((req, res) => { hangers.push(res); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  try {
    const begin = Date.now();
    const r = await draai('http://127.0.0.1:' + srv.address().port, ['--token=' + TOKEN], 300);
    assert.equal(r.gedood, false, 'de sonde sloot zelf af en werd niet door de toets gedood');
    assert.equal(r.code, 1);
    assert.ok(r.monsters.every(m => !m.gelukt), 'niets is gelukt');
    assert.match(bewaking(r.monsters).reden, /^geen antwoord/);
    assert.ok(Date.now() - begin < 30000, 'binnen de tijd afgesloten');
  } finally { srv.closeAllConnections(); await new Promise(r => srv.close(r)); }
});

test('6. tegenover de echte server: de sonde leest de echte meetroute en geeft op een niet-bewaakte toetsserver geen groen', async () => {
  const { startServer, stop } = require('./helper');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-sonde-echt-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_METRICS_TOKEN: TOKEN } });
  try {
    const kort = await (await fetch(srv.base + '/api/metrics/kort', { headers: { Authorization: 'Bearer ' + TOKEN } })).json();
    const r = await draai(srv.base, ['--token=' + TOKEN]);
    const b = bewaking(r.monsters);
    assert.equal(b.status, 200, 'de echte meetroute antwoordt achter het token');
    const nietBewaakt = kort.bewaking.stil.concat(kort.bewaking.uit);
    /* Wat de server zelf over zijn sensoren zegt, en wat de sonde ervan maakt,
       hoort hetzelfde te zijn: groen alleen als niets stil of uit is. */
    assert.equal(b.gelukt, nietBewaakt.length === 0, b.reden || 'gelukt');
    if (nietBewaakt.length) assert.equal(r.code, 1, 'een niet-bewaakte server geeft exitcode 1');
  } finally {
    await stop(srv);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
