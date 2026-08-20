/* Integratietests voor het Gezondheidsmaatje (RTFoundation-gezin): medicijnen met
   afvink-per-dag, medische afspraken (aankomend), de groeicurve, en de
   allergiekaart die uit het zorgprofiel (oppasinfo) komt. Medische vrije tekst
   ligt versleuteld op schijf. Dicht voor gasten.
   Draai los: node --test test/gezondheid.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-gezondheid-'));
let child;

function api(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
const json = r => r.json();
const overzicht = (code, token) => fetch(BASE + '/api/foundation/gezin/' + code + '/gezondheid?token=' + token).then(json);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

async function gezin() {
  const g = await json(await api('/gezin/maak', { gezinsnaam: 'Gezond', naam: 'Ouder', pin: '2468' }));
  const kind = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind' }));
  const kt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id }))).token;
  const gast = await json(await api('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oma', rol: 'gast' }));
  const gt = (await json(await api('/gezin/profiel/kies', { code: g.code, profielId: gast.profiel.id }))).token;
  return { code: g.code, token: g.token, kindId: kind.profiel.id, kt, gt };
}
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

test('medicijnen: toevoegen voor een kind, vandaag afvinken en weer weghalen', async () => {
  const G = await gezin();
  assert.equal((await api('/gezin/gezondheid/medicijn', { code: G.code, token: G.token, voor: G.kindId, naam: 'Paracetamol', dosis: '250mg', tijd: 'ochtend' })).status, 200);
  // een medicijn zonder naam kan niet
  assert.equal((await api('/gezin/gezondheid/medicijn', { code: G.code, token: G.token, voor: G.kindId, naam: '' })).status, 400);
  let d = await overzicht(G.code, G.token);
  const kind = d.personen.find(p => p.pid === G.kindId);
  assert.equal(kind.medicijnen.length, 1);
  assert.equal(kind.medicijnen[0].naam, 'Paracetamol');
  assert.equal(kind.medicijnen[0].gegevenVandaag, false);
  assert.equal(kind.teGeven, 1, 'staat als nog-te-geven');
  const medId = kind.medicijnen[0].id;
  // vandaag gegeven afvinken
  assert.equal((await api('/gezin/gezondheid/medicijn/gegeven', { code: G.code, token: G.token, voor: G.kindId, medId, gegeven: true })).status, 200);
  d = await overzicht(G.code, G.token);
  assert.equal(d.personen.find(p => p.pid === G.kindId).medicijnen[0].gegevenVandaag, true);
  assert.equal(d.personen.find(p => p.pid === G.kindId).teGeven, 0);
  // weghalen
  assert.equal((await api('/gezin/gezondheid/medicijn/verwijder', { code: G.code, token: G.token, voor: G.kindId, medId })).status, 200);
  d = await overzicht(G.code, G.token);
  assert.equal(d.personen.find(p => p.pid === G.kindId).medicijnen.length, 0);
});

test('afspraken: aankomend gesorteerd met de dagen-tot, en de volgende bovenaan', async () => {
  const G = await gezin();
  assert.equal((await api('/gezin/gezondheid/afspraak', { code: G.code, token: G.token, voor: G.kindId, wat: 'Tandarts', datum: morgen(), tijd: '10:00', waar: 'Centrum' })).status, 200);
  assert.equal((await api('/gezin/gezondheid/afspraak', { code: G.code, token: G.token, voor: G.kindId, wat: 'Fout', datum: 'nope' })).status, 400);
  const d = await overzicht(G.code, G.token);
  const kind = d.personen.find(p => p.pid === G.kindId);
  assert.equal(kind.volgende.wat, 'Tandarts');
  assert.equal(kind.volgende.dagenTot, 1);
  assert.equal(kind.volgende.waar, 'Centrum');
});

test('groeicurve: metingen op datum gesorteerd, laatste gewicht/lengte apart', async () => {
  const G = await gezin();
  await api('/gezin/gezondheid/meting', { code: G.code, token: G.token, voor: G.kindId, gewicht: 20, lengte: 118, datum: '2026-01-01' });
  await api('/gezin/gezondheid/meting', { code: G.code, token: G.token, voor: G.kindId, gewicht: 21.5, lengte: 121, datum: '2026-06-01' });
  // een lege meting kan niet
  assert.equal((await api('/gezin/gezondheid/meting', { code: G.code, token: G.token, voor: G.kindId })).status, 400);
  const d = await overzicht(G.code, G.token);
  const kind = d.personen.find(p => p.pid === G.kindId);
  assert.equal(kind.metingen.length, 2);
  assert.equal(kind.metingen[0].datum, '2026-01-01', 'op datum gesorteerd');
  assert.equal(kind.laatsteGewicht.gewicht, 21.5, 'de laatste weging telt');
  assert.equal(kind.laatsteLengte.lengte, 121);
});

/* WAT ER OP SCHIJF STAAT, EN WACHTEN TOT DEZE SCHRIJFACTIE ER ECHT IN ZIT.

   De twee toetsen hieronder beweren iets NEGATIEFS: de allergie en de
   medicijnnaam staan niet leesbaar op schijf. Daar zit een val in. Lees je te
   vroeg, dan staat er nog helemaal niets van deze schrijfactie -- en dan is
   "het geheim staat er niet" waar om de verkeerde reden. Er stond hiervoor
   `setTimeout(200)`, en die val bleef daarmee gewoon open: 200 ms is genoeg tot
   het niet genoeg is.

   Het anker is de schijf zelf. We nemen een afdruk VOOR de schrijfactie en
   wachten tot de bytes veranderd zijn; dan is er aantoonbaar iets van deze
   actie geland, en pas dan zegt "het geheim staat er niet in" iets. */
function opSchijf() {
  return ['db.json', 'store.db', 'store.db-wal']
    .map(f => path.join(TMP, f)).filter(f => fs.existsSync(f))
    .map(f => fs.readFileSync(f, 'utf8')).join('\n');
}
async function naSchrijven(voor, ms) {
  const eind = Date.now() + (ms || 15000);
  for (;;) {
    const nu = opSchijf();
    if (nu !== voor) return nu;
    if (Date.now() >= eind) {
      throw new Error('wachtte ' + (ms || 15000) + 'ms tot de schrijfactie op schijf stond, en de bestanden ' +
        'veranderden niet; de bewering hieronder zou dan waar zijn omdat er NIETS staat');
    }
    await new Promise(r => setTimeout(r, 25));
  }
}

test('de allergiekaart komt uit het zorgprofiel en ligt versleuteld op schijf', async () => {
  const G = await gezin();
  const voor = opSchijf();
  // de ouder vult de allergie in het zorgprofiel (oppasinfo)
  await api('/gezin/oppasinfo', { code: G.code, token: G.token, allergie: 'GEHEIM-PINDA-ALLERGIE', eten: '', huisregels: '' });
  const d = await overzicht(G.code, G.token);
  assert.match(d.allergie, /PINDA/, 'de allergiekaart toont de zorgprofiel-info');
  // en die medische info ligt niet leesbaar op schijf
  const ruw = await naSchrijven(voor);
  assert.ok(!ruw.includes('GEHEIM-PINDA-ALLERGIE'), 'de allergie ligt versleuteld op schijf');
});

test('medicijn-namen liggen ook versleuteld op schijf', async () => {
  const G = await gezin();
  const voor = opSchijf();
  await api('/gezin/gezondheid/medicijn', { code: G.code, token: G.token, voor: G.kindId, naam: 'GEHEIM-MEDICIJN-XYZ', dosis: '1 tablet' });
  const ruw = await naSchrijven(voor);
  assert.ok(!ruw.includes('GEHEIM-MEDICIJN-XYZ'), 'de medicijnnaam ligt versleuteld op schijf');
});

test('het gezondheidsmaatje is dicht voor gasten en voor een verkeerd token', async () => {
  const G = await gezin();
  assert.equal((await api('/gezin/gezondheid/medicijn', { code: G.code, token: G.gt, naam: 'stiekem' })).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/gezondheid?token=' + G.gt)).status, 403);
  assert.equal((await fetch(BASE + '/api/foundation/gezin/' + G.code + '/gezondheid?token=nep')).status, 403);
});
