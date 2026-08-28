/* DE BEGROTING, MAAR DAN VANAF DE BUITENKANT.

   WAAROM DIT BESTAAT, en het is de eerlijkste regel uit de krimpronde.
   test/begroting.test.js bewijst dat server/opzet/begroting.js WEIGERT: dertien
   beweringen, met de oude collectie aantoonbaar nog intact na de poging. Maar
   die dertien voeden de laag rechtstreeks -- ze maken zelf een handelingscontext
   en roepen bewaak() aan. Geen van hen komt langs een route, een server of een
   sessie.

   Dat verschil is geen muggenzifterij. De eerste krimpronde gaf nul meldingen
   over 6806 toetsen, en dat getal heeft twee lezingen die je niet uit elkaar
   kunt houden zonder deze toets: er krimpt niets, of de val hangt wel aan
   db.data maar wordt via een echte route nooit geraakt. KRIMP.json noemde het
   zo: bewezen weigerend, niet bewezen bereikbaar. Dit bestand is dat tweede.

   DE WEG DIE HIER GELOPEN WORDT is de kortste echte: een lid registreert zich,
   maakt een stuk in RTG Studio, en haalt het weg. Dat laatste is in de kern een
   hervulling -- `db.data.muziek = T().filter(x => x.id !== t.id)` in
   kern/muziek.js -- en dus precies de vorm die deze laag onderschept.

   DRIE SERVERS, want twee zouden een verkeerde conclusie toelaten:

     1. MELDEN op 0,5   -- de val ziet de krimp en zegt het, met de collectie
                           erbij. Dit is het bereikbaarheidsbewijs.
     2. WEIGEREN op 0,5 -- de route komt er niet doorheen, en het stuk staat er
                           daarna NOG. Dit is het weigerbewijs.
     3. DE TEGENPROEF    -- dezelfde weg zonder verlaagde grens: dan verdwijnt
                           het stuk wel. Zonder deze derde server bewijst nummer
                           2 niets: een route die altijd stuk is, laat het stuk
                           ook staan (LAT.md regel 10).

   WAAROM 0,5 EN NIET 1. De grens vergelijkt met `krimp <= grens`, dus met een
   grens van 1 komt een verwijdering van EEN rij er ongemeld doorheen -- en dat
   is de vorm van bijna elke verwijdering in dit huis. Een halve rij bestaat
   niet, dus 0,5 betekent: elke krimp telt. Dat is geen truc maar precies wat de
   krimpronde als volgende stap noemde.

   WAT DEZE TOETS NIET BEWIJST: dat de andere 115 hervullingsplekken ook langs
   een route bereikbaar zijn. Hij bewijst dat de laag er in een ECHTE server
   tussen zit en zijn werk doet, op een van hen. Dat is precies een plek meer
   dan er gisteren was.

   Draai los: node --experimental-sqlite --test test/begrotingroute.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

/* De grens waarop ELKE krimp telt. Zie de kop: 1 laat een rij door. */
const ELKE_KRIMP = '0.5';

let seq = 0;
function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

async function lid(base) {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const r = await api(base, '/api/auth/register', { name: 'Krimpproef', email: 'kp' + u + '@x.nl',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-04-04', geslacht: 'x',
    tier: 'rtg', pasApp: 'rtg' });
  assert.ok(r.body && r.body.token, 'registreren lukte niet: ' + JSON.stringify(r).slice(0, 300));
  return r.body.token;
}

/* Een stuk maken en het id teruggeven. Maken is GROEI, en groei is hier bewust
   geen weigering -- dus dit werkt ook op de strengste server. */
async function stuk(base, token) {
  const r = await api(base, '/api/muziek/maak', {}, token);
  assert.ok(r.body && r.body.track && r.body.track.id,
    'een stuk maken lukte niet: ' + JSON.stringify(r).slice(0, 300));
  return r.body.track.id;
}

const ids = async (base, token) =>
  ((await api(base, '/api/muziek/mijn', {}, token)).body.tracks || []).map(t => t.id);

/* Elke server een eigen verse datamap: anders leest de ene de leden van de
   andere (helper.js legt in zijn kop uit wat dat een keer heeft gekost). */
function versMap(naam) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-krimp-' + naam + '-'));
}

test('MELDEN: een echte route laat de val aanslaan, met de collectie erbij', async () => {
  const map = versMap('meld');
  let srv = null, log = '';
  try {
    srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map,
      RTG_BEGROTING: 'melden', RTG_BEGROTING_KRIMP: ELKE_KRIMP }, stderr: 'pipe' });
    srv.child.stderr.on('data', d => { log += d; });

    const token = await lid(srv.base);
    const id = await stuk(srv.base, token);
    const weg = await api(srv.base, '/api/muziek/weg', { id }, token);
    assert.equal(weg.status, 200, 'in meldmodus hoort de handeling gewoon door te gaan');
    await new Promise(r => setTimeout(r, 400));   // het log loopt na het antwoord

    assert.match(log, /begroting: waakt/,
      'de val kwam in deze server niet eens tot installatie:\n' + log.slice(-1500));
    assert.match(log, /begroting: zou zijn geweigerd/,
      'GEEN ENKELE melding terwijl er via een echte route een rij verdween. Dan hangt de laag ' +
      'wel aan db.data maar wordt hij op dit pad niet geraakt -- precies het gat dat KRIMP.json ' +
      'noemt:\n' + log.slice(-2000));
    assert.match(log, /"collectie":"muziek"/,
      'de melding noemt niet de collectie die kromp; dan bouwt hij geen catalogus:\n' + log.slice(-1500));
  } finally {
    stop(srv);
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('WEIGEREN: de route komt er niet door, en het stuk staat er NA de poging nog', async () => {
  const map = versMap('weiger');
  let srv = null, log = '';
  try {
    srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map,
      RTG_BEGROTING: 'weigeren', RTG_BEGROTING_KRIMP: ELKE_KRIMP }, stderr: 'pipe' });
    srv.child.stderr.on('data', d => { log += d; });

    const token = await lid(srv.base);
    const id = await stuk(srv.base, token);
    assert.deepEqual(await ids(srv.base, token), [id], 'het stuk staat er voor de poging');

    const weg = await api(srv.base, '/api/muziek/weg', { id }, token);
    assert.notEqual(weg.status, 200, 'de handeling ging gewoon door terwijl de begroting hem hoorde te weigeren');
    /* 409 en geen 500: BegrotingOverschreden draagt zijn eigen status, en
       afsluiters.js merkt alleen 5xx als serverfout. Een weigering is geen
       storing, en de strenge poort hoort er dus niet op te vallen. */
    assert.equal(weg.status, 409,
      'een geweigerde handeling hoort een 409 te zijn en geen 500 -- anders leest hij als een storing ' +
      'en laat hij de strenge poort omvallen (kreeg ' + weg.status + ')');

    assert.deepEqual(await ids(srv.base, token), [id],
      'het stuk is WEG na een geweigerde handeling: de weigering kwam te laat, of maar half');
    await new Promise(r => setTimeout(r, 400));
    assert.match(log, /begroting: handeling geweigerd/,
      'de weigering staat niet in het log:\n' + log.slice(-2000));
  } finally {
    stop(srv);
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});

test('DE TEGENPROEF: zonder verlaagde grens verdwijnt hetzelfde stuk wel', async () => {
  /* Zonder deze toets bewijst de vorige niets. Een route die kapot is, laat het
     stuk ook staan -- en dan zou "hij staat er nog" als weigerbewijs gelden
     terwijl er helemaal niets geweigerd werd (LAT.md regel 10). */
  const map = versMap('gewoon');
  let srv = null;
  try {
    srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map } });
    const token = await lid(srv.base);
    const id = await stuk(srv.base, token);
    assert.deepEqual(await ids(srv.base, token), [id], 'het stuk staat er voor de poging');

    const weg = await api(srv.base, '/api/muziek/weg', { id }, token);
    assert.equal(weg.status, 200, 'de gewone weg werkt niet meer: ' + JSON.stringify(weg).slice(0, 300));
    assert.deepEqual(await ids(srv.base, token), [],
      'het stuk staat er NOG zonder begroting -- dan bewijst de weigering hierboven niets');
  } finally {
    stop(srv);
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});
