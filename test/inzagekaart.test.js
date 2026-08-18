/* De inzagekaart (kern/inzagekaart.js): wie heeft er in mijn gegevens gekeken.

   Deze kaart bestaat omdat het antwoord op die vraag over drie sporen verspreid
   lag. Wat hier vastligt is dus vooral dat het er DRIE zijn en blijven: valt er
   een weg, dan hoort dat op te vallen als een storing en niet als stilte, want
   een ontbrekende bron leest hier als "daar heeft niemand gekeken".

   En twee grenzen die de kaart draagt: de kijker krijgt geen naam (dat is de
   persoonsdata van een ander), en wat de kaart NIET kan zien staat erop.
   Draai los: node --experimental-sqlite --test test/inzagekaart.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const inzagelog = require('../server/inzagelog');
const maakKaart = require('../server/kern/inzagekaart');

/* Een kern met de drie sporen gevuld: een iD-inlog, een partner die het
   identiteitsbewijs opende, en een kluisopvraging met reden. */
function kernMet(extra) {
  const db = { data: { inzageLog: [], paspoortLog: [
    { at: '2026-08-10T09:00:00.000Z', soort: 'aanvraag', niveau: 'idkaart', supplierCode: 'AUR', key: 'user-7' },
    { at: '2026-08-10T09:01:00.000Z', soort: 'goedgekeurd', niveau: 'idkaart', supplierCode: 'AUR', key: 'user-7' },
    { at: '2026-08-10T09:02:00.000Z', soort: 'inzage', niveau: 'idkaart', supplierCode: 'AUR', key: 'user-7', door: 'Marieke van de receptie' },
    { at: '2026-08-10T09:03:00.000Z', soort: 'inzage', niveau: 'idkaart', supplierCode: 'AUR', key: 'user-99' }
  ] } };
  inzagelog.zet(db, () => {});
  inzagelog.noteer({ door: { id: 42, naam: 'Jansen van HR' }, over: { id: 7, codenaam: 'ADELAAR' },
    waarom: 'loonadministratie: identiteitscontrole', bron: '/api/payroll/identiteit' });
  return Object.assign({
    db,
    findSupplier: code => (code === 'AUR' ? { name: 'Hotel Aurora' } : null),
    rtgid: { inzage: () => ({ log: [
      { om: '2026-08-11T12:00:00.000Z', dienst: 'MijnOverheid', attributen: ['codenaam', '18plus'], soort: 'inlog' },
      { om: '2026-08-09T08:00:00.000Z', dienst: 'MijnOverheid', attributen: [], soort: 'toegang ingetrokken' }
    ] }) }
  }, extra || {});
}
const kaartVoor = extra => maakKaart({ kern: kernMet(extra) }).inzagekaartVan('user-7');

test('de drie sporen komen op een lijst, nieuwste eerst', () => {
  const d = kaartVoor();
  assert.deepEqual(d.storingen, [], 'alle drie de bronnen doen het');
  assert.deepEqual([...new Set(d.kaart.map(r => r.bron))].sort(),
    ['Identiteitsbewijs', 'Ledendossier', 'RTG iD'], 'alle drie leveren een regel');
  const tijden = d.kaart.map(r => r.om);
  assert.deepEqual(tijden, [...tijden].sort().reverse(), 'de kaart loopt van nieuw naar oud');
  /* De kluisopvraging is zojuist genoteerd en draagt dus de klok van nu; de
     andere twee sporen staan op vaste datums in het verleden. Dat die regel
     bovenaan komt, bewijst dat er over de bronnen HEEN wordt gesorteerd en niet
     per bron -- precies waar deze kaart voor bestaat. */
  assert.equal(d.kaart[0].bron, 'Ledendossier', 'de jongste regel staat bovenaan, ongeacht uit welk spoor hij komt');
  assert.equal(d.kaart[1].bron, 'RTG iD', 'en daaronder het op een na jongste, uit een ander spoor');
});

test('het spoor van een ANDER lid komt er niet bij', () => {
  /* De paspoortlaag houdt een log voor alle leden samen bij; de kaart moet er
     de eigen sleutel uit filteren. Zou dat wegvallen, dan leest een lid de
     inzages van iemand anders -- de ergste fout die dit scherm kan maken. */
  const d = kaartVoor();
  assert.equal(d.kaart.filter(r => r.bron === 'Identiteitsbewijs').length, 3,
    'drie eigen regels, niet de vierde van user-99');
});

test('de kijker krijgt geen naam, de zaak wel', () => {
  /* Welke ZAAK keek, wist u al -- daar kreeg u bericht van. Welke MEDEWERKER
     daar keek, is de persoonsdata van een ander. Het inzagejournaal liet die
     naam al weg; deze kaart doet voor de paspoortlaag hetzelfde. */
  const d = kaartVoor();
  const alles = JSON.stringify(d);
  assert.match(alles, /Hotel Aurora/, 'de zaak staat er met naam');
  assert.doesNotMatch(alles, /Marieke/, 'de medewerker die keek, niet');
  assert.doesNotMatch(alles, /Jansen/, 'en de opvrager uit de kluis ook niet');
});

test('alleen het inzagejournaal draagt een waarom, en die komt door', () => {
  const d = kaartVoor();
  const kluis = d.kaart.find(r => r.bron === 'Ledendossier');
  assert.match(kluis.waarom, /loonadministratie/, 'de verplichte reden is het hele punt van dat spoor');
  assert.equal(d.kaart.find(r => r.bron === 'RTG iD').waarom, null);
});

test('uw eigen handeling telt niet als "er is gekeken"', () => {
  /* Een goedkeuring van uzelf hoort op de kaart -- zonder die regel is de
     inzage erboven niet te begrijpen -- maar hij hoort niet mee te tellen als
     iemand die in uw gegevens keek. */
  const d = kaartVoor();
  const eigen = d.kaart.find(r => /u keurde die aanvraag goed/.test(r.wat));
  assert.ok(eigen, 'de eigen goedkeuring staat er wel');
  assert.equal(eigen.gekeken, false, 'maar telt niet mee');
  assert.equal(d.gekeken, d.kaart.filter(r => r.gekeken).length);
  assert.ok(d.gekeken < d.kaart.length, 'er is minstens een regel die niet meetelt');
});

test('een soort die de kaart niet kent, verdwijnt niet stilletjes', () => {
  /* Wie in kern/paspoort een nieuwe soort logt, vergeet hem hier. Dan is een
     rauwe naam tonen beter dan een lege regel of geen regel: het valt op. */
  const kern = kernMet();
  kern.db.data.paspoortLog.unshift({ at: '2026-08-12T00:00:00.000Z', soort: 'iets-nieuws', supplierCode: 'AUR', key: 'user-7' });
  const d = maakKaart({ kern }).inzagekaartVan('user-7');
  assert.ok(d.kaart.some(r => r.wat.includes('iets-nieuws')), 'de onbekende soort staat er onder eigen naam');
});

test('een bron die het niet doet, meldt zich als storing en niet als stilte', () => {
  const d = maakKaart({ kern: { rtgid: { inzage: () => { throw new Error('kapot'); } } } }).inzagekaartVan('user-7');
  assert.ok(d.storingen.some(s => /RTG iD/.test(s)), 'de stukke bron staat met naam in de melding');
  assert.ok(d.storingen.length >= 2, 'en de bronnen die niet zijn aangesloten melden zich ook');
});

test('wat de kaart NIET kan zien, staat op de kaart', () => {
  const d = kaartVoor();
  assert.ok(d.nietZichtbaar.length >= 1);
  assert.match(d.nietZichtbaar[0].naam, /Zegel/);
  assert.match(d.nietZichtbaar[0].reden, /pseudoniem/,
    'met de echte reden: het Zegel is per partner anders, dus niet aan een account te koppelen');
});

test('een gast heeft geen dossier en dus geen kaart', () => {
  /* De kaart zelf kent geen sessies; de route bewaakt dat. Wat hier telt is dat
     een sleutel zonder account geen kluisspoor oplevert in plaats van een fout. */
  const d = maakKaart({ kern: kernMet() }).inzagekaartVan('guest');
  assert.equal(d.kaart.filter(r => r.bron === 'Ledendossier').length, 0);
  assert.equal(d.kaart.filter(r => r.bron === 'Identiteitsbewijs').length, 0);
});


/* ---- en de deur zelf, tegen een echte server ---- */
let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kaart-'));
const api = (pad, t) => fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, t ? { Authorization: 'Bearer ' + t } : {}),
  body: '{}' }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de deur: een lid krijgt zijn kaart, een gast en een vreemde niet', async (t) => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  t.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

  assert.equal((await api('/api/inzagekaart')).status, 401, 'zonder inlog geen kaart');

  const gastToken = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'guest', pasApp: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  assert.equal((await api('/api/inzagekaart', gastToken)).status, 403, 'een gast heeft geen dossier');

  const lidToken = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier: 'rtg' }) }).then(r => r.json()).then(d => d.token);
  const r = await api('/api/inzagekaart', lidToken);
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.kaart), 'een lid krijgt een kaart, ook als hij leeg is');
  assert.deepEqual(r.body.storingen, [], 'en alle bronnen zijn in een echte server bereikbaar');
  assert.ok(r.body.nietZichtbaar.length >= 1, 'met de grens van de lijst erbij');
});
