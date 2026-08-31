/* DE VIER-OGENREGEL OP DE MENS -- wie inzendt, tekent niet af.

   Grens 2 stond op de ORGANISATIE, en dat is genoeg zolang de uitgever een
   externe partij is: die heeft geen kantoorinlog. Bij RTG's eigen uitgever is
   het niets -- daar kan dezelfde mens bouwen, inzenden en aftekenen. Wat deze
   toets vastlegt:

     1. De inzender wordt vastgelegd op de VERSIE, met een handvat en een naam.
     2. Het handvat komt nooit in een antwoord: het dient om te vergelijken, niet
        om te tonen.
     3. Dezelfde SLEUTEL tekent niet af -- dat is de harde vergelijking.
     4. Dezelfde NAAM tekent ook niet af -- de zachte, voor een gedeelde
        kantoorcode, en die is er juist voor het geval dat hierboven niet werkt.
     5. Een besluit draagt de GRAAD van de scheiding: bewezen (twee inlogs),
        opgegeven (twee ingetypte namen) of onbekend. "Twee mensen" is een andere
        bewering wanneer hij op een inlog rust dan wanneer hij op een tekstveld
        rust, en het dossier hoort dat verschil te tonen.
     6. Twee verschillende mensen komen er gewoon door.

   Draai los: node --test test/appstore-vierogen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const vierogen = require('../server/kern/appstore/vierogen');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vierogen-'));
let srv, base, sup, office, tech, actorNaam;

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
const HTML = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>P</title></head><body><p id="n">Proef</p><script src="app.js"></script></body></html>';
const bundel = (n) => [{ pad: 'index.html', inhoud: HTML }, { pad: 'app.js', inhoud: 'var n=' + n + ';\n' }];
const manifest = (versie) => ({ sleutel: 'vierogen-proef', naam: 'Vierogen', versie,
  uitleg: 'Een proefapp om de scheiding tussen inzenden en aftekenen te toetsen.', categorie: 'leven',
  machtigingen: [{ id: 'opslag.eigen', doel: 'voortgang-onthouden' }] });

test('0. de toets zelf: sleutel gaat voor naam, en de graad zegt hoe hard hij is', () => {
  const zelfde = vierogen.toets({ inzender: { id: 'staff:K:9', naam: 'Sam' }, doorKey: 'staff:K:9', doorNaam: 'Iemand anders' });
  assert.equal(zelfde.mag, false);
  assert.equal(zelfde.code, 'zelfde-mens');
  assert.equal(zelfde.graad, 'bewezen', 'een gelijke sleutel is bewijs, geen vermoeden');

  const zelfdeNaam = vierogen.toets({ inzender: { id: 'a', naam: 'Sam van RTG ' }, doorKey: 'b', doorNaam: 'sam van rtg.' });
  assert.equal(zelfdeNaam.mag, false);
  assert.equal(zelfdeNaam.code, 'zelfde-naam');

  assert.equal(vierogen.toets({ inzender: { id: 'a', naam: 'Sam' }, doorKey: 'b', doorNaam: 'Ada' }).graad, 'bewezen');
  assert.equal(vierogen.toets({ inzender: { id: null, naam: 'Sam' }, doorKey: null, doorNaam: 'Ada' }).graad, 'opgegeven');
  assert.equal(vierogen.toets({ inzender: null, doorKey: null, doorNaam: 'Ada' }).graad, 'onbekend');
});

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  tech = (await api('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).body.token;
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const chef = (roster.staff || []).find(x => x.role === 'manager');
  actorNaam = chef.name;
  sup = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: chef.id, pin: '1234' })).body.token;
  await api('/api/techniek/tenant', { org: 'O-VIER', naam: 'Vierogen Uitgeverij' }, tech);
  await api('/api/techniek/tenant/bind', { org: 'O-VIER', soort: 'zaak', code: 'KIKUNOI' }, tech);
  await api('/api/appstore/uitgever/aanvraag', { naam: 'Vierogen Uitgeverij', contact: 'dev@vier.nl' }, sup);
  await api('/api/appstore/kantoor/uitgever', { org: 'O-VIER', besluit: 'toegelaten', door: 'Sam van RTG' }, office);
});
test.after(() => stop(srv));

test('1. de inzender staat op de versie, met zijn naam en zonder zijn handvat', async () => {
  const inz = await api('/api/appstore/uitgever/inzenden', { manifest: manifest('1.0.0'), bestanden: bundel(1) }, sup);
  assert.equal(inz.status, 200, JSON.stringify(inz.body.bevindingen || inz.body.fouten || inz.body.error));
  assert.equal(inz.body.versie.inzender.soort, 'medewerker');
  assert.equal(inz.body.versie.inzender.naam, actorNaam);
  /* De sleutel dient om te vergelijken en niet om te tonen: hij hoort in geen
     enkel antwoord te staan. */
  assert.ok(!('id' in inz.body.versie.inzender), 'het handvat van de inzender lekt naar buiten');
  assert.ok(!JSON.stringify(inz.body).includes('staff:KIKUNOI'), 'de sleutel staat in het antwoord');
});

test('2. dezelfde NAAM tekent niet af', async () => {
  const wachtrij = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body;
  const v = wachtrij.inzendingen.find(x => x.sleutel === 'vierogen-proef');
  await api('/api/appstore/kantoor/toegankelijk', { versieId: v.id, stand: 'in-orde', fouten: 0 }, office);
  const r = await api('/api/appstore/kantoor/besluit',
    { versieId: v.id, besluit: 'gepubliceerd', door: actorNaam }, office);
  assert.equal(r.status, 403, 'de inzender tekende zijn eigen inzending af');
  assert.equal(r.body.code, 'zelfde-naam');
  assert.match(r.body.error, /tekent hem niet af/);
});

test('3. een andere mens komt er wel door, en de graad staat erbij', async () => {
  const wachtrij = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body;
  const v = wachtrij.inzendingen.find(x => x.sleutel === 'vierogen-proef');
  const r = await api('/api/appstore/kantoor/besluit',
    { versieId: v.id, besluit: 'gepubliceerd', door: 'Ada van RTG' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.versie.besluit.scheiding.graad, 'opgegeven',
    'een gedeelde kantoorcode levert geen bewezen scheiding op, en dat hoort er te staan');
  assert.match(r.body.versie.besluit.scheiding.uitleg, /ingetypt/);
});

test('4. de wachtrij toont de inzender, zodat de mens die tekent het ZIET', async () => {
  await api('/api/appstore/uitgever/inzenden', { manifest: manifest('1.1.0'), bestanden: bundel(2) }, sup);
  const wachtrij = (await api('/api/appstore/kantoor/wachtrij', {}, office)).body;
  const v = wachtrij.inzendingen.find(x => x.sleutel === 'vierogen-proef' && x.versie === '1.1.0');
  assert.ok(v, 'de nieuwe inzending staat in de wachtrij');
  assert.equal(v.inzender.naam, actorNaam, 'wie tekent, ziet van wie hij tekent');
});
