'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const OWNER = 'incident-owner@x.nl';
let srv, token;
function post(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers.Authorization = 'Bearer ' + tok;
  return fetch(srv.base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_OWNER_EMAIL: OWNER } });
  token = (await post('/api/techniek/inloggen', { login: OWNER, wachtwoord: 'Imran' })).body.token;
});
test.after(() => stop(srv && srv.child));


/* DE CEREMONIE VOOR HET HUIS, in de vorm waarin een mens hem ook loopt.

   `herstel` verlaagt de stand van het hele platform en staat sinds de
   isolatielaag achter dezelfde ceremonie als de dragers eronder. Deze helper is
   dus geen omweg om de toets weer groen te krijgen -- hij IS de nieuwe weg, en
   dat hij hier zoveel regels kost, is precies wat de grens waard is.

   In deze opstelling is er EEN eigenaar en niemand op de handmatige
   toegangslijst. De ceremonie merkt dat en gaat door als NOODONTSLUITING: het
   tweede paar ogen wordt niet gevraagd, maar de ontsluiting draagt een merk dat
   blijft staan. Dat is met opzet zo -- een eis die in een opstelling met een
   eigenaar nooit te halen is, maakt het platform onherstelbaar. De toets kijkt
   dus ook na DAT het merk er staat.

   ER ZIJN SINDS 2 SEPTEMBER 2026 TWEE GRONDEN, en die worden allebei met naam
   nagekeken. Dat is geen overdaad maar noodzaak: de stappenlijst komt UIT het
   verzoek, dus zodra een eis wegvalt, meet deze helper er stilletjes een minder
   en blijft hij groen. Door de gronden te noemen kan zo'n wegval niet meer
   ongemerkt gebeuren -- de tweede eigenaar-account van de toetsopstelling heeft
   geen passkey, en dat hoort een uitgesproken vaststelling te zijn en geen
   toevallige uitkomst. */
async function ceremonie(van, reden) {
  const v = await post('/api/techniek/isolatie/ontsluiting', {
    drager: 'huis', van: van, naar: 'normaal', reden: reden
  }, token);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  const verzoek = v.body.verzoek;
  assert.equal(verzoek.noodontsluiting, true, 'een opstelling met een eigenaar hoort dit te merken');
  assert.ok(!verzoek.vereisten.includes('tweedePaarOgen'));
  const gronden = (verzoek.noodGronden || []).map(g => g.grond).sort();
  assert.deepEqual(gronden, ['geenPasskey', 'geenTweedeMens'],
    'beide gronden staan met naam in het verzoek; een eis die wegvalt zonder grond zou deze ' +
    'helper stilletjes minder laten meten: ' + JSON.stringify(verzoek.noodGronden));
  assert.ok(!verzoek.vereisten.includes('passkey'),
    'en de passkey-eis is dus met reden weggevallen, niet vergeten');
  /* De stappen komen UIT het verzoek en staan hier niet overgetypt. De eisen
     hangen af van hoe zwaar de overgang is -- van `beperkt` naar `normaal` vraagt
     minder dan vanuit `isolatie` -- en een toets die zijn eigen lijst meebrengt,
     zou een verzwaring van die eisen niet merken. */
  for (const soort of verzoek.vereisten) {
    if (soort === 'reden' || soort === 'wachttijd') continue;
    const r = await post('/api/techniek/isolatie/ontsluiting/stap',
      { id: verzoek.id, soort: soort, bewijs: 'proef' }, token);
    assert.equal(r.status, 200, soort + ': ' + JSON.stringify(r.body));
  }
  return verzoek.id;
}

test('de controlelaag is alleen voor de eigenaar en toont code plus routes', async () => {
  assert.equal((await fetch(srv.base + '/api/techniek/controle/status')).status, 401);
  const r = await fetch(srv.base + '/api/techniek/controle/status', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.incident.modus, 'normaal');
  assert.ok(d.inventaris.routes > 1500);
  assert.ok(d.inventaris.schakelaars > 20);
  const routes = await fetch(srv.base + '/api/techniek/controle/inventaris?soort=routes&zoek=%2Fapi%2Fcharter&limiet=10',
    { headers: { Authorization: 'Bearer ' + token } }).then(x => x.json());
  assert.ok(routes.resultaten.some(x => x.functie === 'charter'));
});

test('gericht dichtzetten blokkeert direct en herstel zet de oude stand terug', async () => {
  const dicht = await post('/api/techniek/controle/incident', {
    actie: 'beperk', id: 'charter', reden: 'Verdachte code in charter aangetroffen'
  }, token);
  assert.equal(dicht.status, 200);
  assert.equal(dicht.body.incident.modus, 'beperkt');
  assert.equal((await post('/api/charter/aanbod', { city: 'Ibiza' })).status, 503);
  assert.equal((await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Onderzoek afgerond en schone code bevestigd', bevestiging: 'verkeerd'
  }, token)).status, 400);
  /* Zonder ceremonie komt herstel er niet meer langs, en de getypte zin is
     daarvoor niet genoeg -- die is nog maar de rem tegen een misklik. */
  const zonder = await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Onderzoek afgerond en schone code bevestigd', bevestiging: 'HERSTEL RTG'
  }, token);
  assert.equal(zonder.status, 400, JSON.stringify(zonder.body));
  assert.match(zonder.body.error, /ontsluitceremonie/);

  const herstel = await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Onderzoek afgerond en schone code bevestigd', bevestiging: 'HERSTEL RTG',
    ceremonie: await ceremonie('beperkt', 'Onderzoek afgerond en schone code bevestigd')
  }, token);
  assert.equal(herstel.status, 200);
  assert.equal(herstel.body.incident.modus, 'normaal');
  assert.notEqual((await post('/api/charter/aanbod', { city: 'Ibiza' })).status, 503);
  assert.ok(herstel.body.incident.auditAantal >= 2);
});

test('volledige isolatie laat health en de herstelkamer bereikbaar', async () => {
  const iso = await post('/api/techniek/controle/incident', {
    actie: 'isoleer', reden: 'Bevestigde aanval vereist volledige isolatie', bevestiging: 'ISOLEER RTG'
  }, token);
  assert.equal(iso.status, 200);
  assert.equal(iso.body.incident.modus, 'isolatie');
  assert.equal((await fetch(srv.base + '/api/health')).status, 200);
  assert.equal((await fetch(srv.base + '/api/techniek/controle/status', {
    headers: { Authorization: 'Bearer ' + token } })).status, 200);
  assert.equal((await post('/api/foundation/gezin/maak', { gezinsnaam: 'X' })).status, 503);
  const terug = await post('/api/techniek/controle/incident', {
    actie: 'herstel', reden: 'Schone release hersteld en volledig gecontroleerd', bevestiging: 'HERSTEL RTG',
    ceremonie: await ceremonie('isolatie', 'Schone release hersteld en volledig gecontroleerd')
  }, token);
  assert.equal(terug.status, 200);
  assert.equal(terug.body.incident.modus, 'normaal');
});
