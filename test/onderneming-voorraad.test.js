/* Ronde: de voorraad -- wat er ligt, en wat wij niet kunnen zien.

   Vijf beweringen:

   1. ER KOMT GEEN VIJFDE VOORRAAD BIJ. De vier registers die er zijn (keuken,
      retail, boerderij, groothandel) worden GELEZEN. Een vijfde ernaast loopt
      binnen een maand uiteen met alle vier, en is de enige die niemand bijwerkt
      omdat er niet in gewerkt wordt.
   2. GEEN VOORRAADWAARDE OP EEN VERKOOPPRIJS. Retail en boerderij kennen geen
      inkoopprijs; een waarde daarop bevat de winst al en is dus een
      omzetverwachting, geen voorraadwaarde.
   3. GEEN BESTELPUNT WAAR ER GEEN IS. `minBestel` bij een groothandel is een
      minimale bestelHOEVEELHEID, geen bestelpunt. Die twee verwarren meldt een
      volle groothandel als "bijna op".
   4. RETAIL TELT OP DE VARIANT. Maat 42 op is een gemiste verkoop, ook al ligt
      de rest in het schap.
   5. GEEN DEKKING IN DAGEN. Daarvoor zouden wij verbruik over tijd moeten
      kennen, en dat kennen wij alleen in de keuken en alleen binnen RTG.

   Draai los: node --test test/onderneming-voorraad.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

/* Koppelen vraagt sinds deze ronde BEWIJS dat de zaak van de aanvrager is: in
   de route komt dat uit de sessie (een actieve beheerplek in het
   personeelsregister), of uit de eigen aanvraag waar RTG de zaak uit maakte.
   Een toets heeft geen sessie, dus zegt hij het hier met zoveel woorden: in
   deze opzet IS de zaak van dit lid. Zonder deze regel zou een toets stil
   uitgaan van een recht dat de code niet meer geeft. */
const MIJN_ZAAK = () => true;

const maakOnderneming = require('../server/kern/onderneming');
const VRD = require('../server/kern/onderneming/voorraad');

function stubKern(over) {
  const zaak = Object.assign({
    code: 'ZAAK', name: 'Proefzaak', type: 'zzp', city: 'Haarlem', staff: [{ id: 1 }],
    online: true, salon: { bio: 'Wij doen werk.', foto: 'f.jpg' },
    rondleiding: { kassa: 'j', werk: 'j' },
    services: [{ id: 's', name: 'K', price: 100 }], boekingen: [], orders: []
  }, over || {});
  const data = { ondernemingen: [], suppliers: [zaak], posts: [], vakOffertes: [], facturen: [],
    werkruimtes: {}, vacatures: {}, applications: {}, thuisHuizen: {},
    supplierTypes: { zzp: { label: 'Zelfstandige', caps: ['services'] } } };
  const db = require('../server/kern/werkvormen').haakAan({ data });
  const K = maakOnderneming({
    db, save: () => {}, crypto: require('crypto'),
    schoon: (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : ''),
    ondernemerpoort: require('../server/opzet/salonregel')({ data }).ondernemerpoort,
    findSupplier: (c) => (c === 'ZAAK' ? zaak : null),
    ordersVanZaak: () => [], boekingenVanZaak: () => zaak.boekingen,
    aanmeldingen: { aanvraag: () => ({ ok: true }), een: () => ({ status: 404 }) }
  });
  K._zaak = zaak;
  return K;
}

function ond(K, koppel) {
  const o = K.ondernemingVind(K.ondernemingNieuw('LID1', { naam: 'Proef' }).onderneming.id);
  if (koppel !== false) K.ondernemingKoppel(o, 'ZAAK', MIJN_ZAAK);
  return o;
}
const deel = (v, bron) => v.delen.find(d => d.bron === bron);

/* ---------------- geen vijfde register ---------------- */

test('de voorraad leest de bestaande registers en schrijft er niets in', () => {
  const K = stubKern({ voorraad: [{ id: 'a', naam: 'Bloem', aantal: 8, min: 5, eenheid: 'kg', kostprijs: 1.2 }] });
  const voor = JSON.stringify(K._zaak);
  const v = K.ondernemingVoorraad(ond(K));
  assert.equal(JSON.stringify(K._zaak), voor, 'de zaak is onaangeroerd');
  assert.equal(v.zaak, 'ZAAK');

  const bron = require('fs').readFileSync('server/kern/onderneming/voorraad.js', 'utf8');
  assert.ok(!/\bsave\s*\(/.test(bron), 'nergens een schrijfactie');
  assert.deepEqual(Object.keys(VRD.BRONNEN).sort(),
    ['boerderij', 'groothandel', 'keuken', 'retail'], 'en precies de vier die er al zijn');
});

test('zonder zaak en zonder enig register is er geen voorraadbeeld', () => {
  const K = stubKern();
  assert.equal(K.ondernemingVoorraad(ond(K, false)), null, 'geen zaak');
  assert.equal(K.ondernemingVoorraad(ond(K)), null,
    'een zaak zonder een enkel artikel: nul artikelen zou lezen als "uw voorraad is op"');
});

/* ---------------- de keuken: bestelpunt en kostprijs ---------------- */

test('de keuken kent een minimum per artikel en een kostprijs', () => {
  const K = stubKern({ voorraad: [
    { id: 'a', naam: 'Bloem', aantal: 3, min: 5, eenheid: 'kg', kostprijs: 2 },
    { id: 'b', naam: 'Zout', aantal: 20, min: 5, eenheid: 'kg', kostprijs: 1 },
    { id: 'c', naam: 'Gist', aantal: 1, min: 0, eenheid: 'kg', kostprijs: 4 }
  ], voorraadLog: [{ at: 'x' }, { at: 'y' }] });
  const v = K.ondernemingVoorraad(ond(K));
  const k = deel(v, 'keuken');
  assert.equal(k.artikelen, 3);
  assert.equal(k.laag, 1, 'alleen Bloem staat onder zijn minimum; Gist heeft er geen');
  assert.equal(k.laagRijen[0].naam, 'Bloem');
  assert.equal(k.waarde, 3 * 2 + 20 * 1 + 1 * 4);
  assert.equal(k.journaal, 2, 'en het mutatiejournaal wordt geteld');
});

test('een artikel zonder minimum telt nooit als laag', () => {
  const K = stubKern({ voorraad: [{ id: 'a', naam: 'Bloem', aantal: 0, min: 0, kostprijs: 2 }] });
  const v = K.ondernemingVoorraad(ond(K));
  assert.equal(deel(v, 'keuken').laag, 0,
    'zonder bestelpunt weten wij niet wat weinig is');
  assert.equal(VRD.voorraadOpvolging(v), null);
});

/* ---------------- retail: op de variant, en geen waarde ---------------- */

test('retail telt laag op de variant en niet op het artikel', () => {
  const K = stubKern({ artikelen: [
    { id: 'p1', name: 'Trui', price: 89, varianten: [
      { vsku: 'p1-40', maat: '40', voorraad: 12 }, { vsku: 'p1-42', maat: '42', voorraad: 1 }] },
    { id: 'p2', name: 'Broek', price: 99, varianten: [{ vsku: 'p2-40', maat: '40', voorraad: 20 }] }
  ] });
  const v = K.ondernemingVoorraad(ond(K));
  const r = deel(v, 'retail');
  assert.equal(r.artikelen, 2);
  assert.equal(r.varianten, 3);
  assert.equal(r.laag, 1, 'de trui telt als laag: maat 42 op is een gemiste verkoop');
  assert.deepEqual(r.laagRijen[0].varianten.map(x => x.maat), ['42'],
    'en alleen die maat, niet het hele artikel');
  assert.equal(r.drempel, VRD.RETAIL_DREMPEL);
});

test('de eigen drempel van de zaak wint van de standaard', () => {
  const K = stubKern({ settings: { retailDrempel: 15 },
    artikelen: [{ id: 'p1', name: 'Trui', price: 89, varianten: [{ vsku: 'a', voorraad: 12 }] }] });
  const r = deel(K.ondernemingVoorraad(ond(K)), 'retail');
  assert.equal(r.drempel, 15);
  assert.equal(r.laag, 1, 'twaalf is laag zodra de zaak zelf vijftien als grens zet');
});

test('een winkelartikel krijgt geen voorraadwaarde, met de reden', () => {
  const K = stubKern({ artikelen: [{ id: 'p1', name: 'Trui', price: 89, varianten: [{ vsku: 'a', voorraad: 10 }] }] });
  const v = K.ondernemingVoorraad(ond(K));
  const r = deel(v, 'retail');
  assert.equal(r.waarde, null, 'geen 890 euro: dat bedrag bevat de winst al');
  assert.ok(r.waardeReden.includes('omzetverwachting'));
  assert.equal(v.waarde, null, 'en dan is er ook geen totaal');
  assert.deepEqual(v.waardeBuiten.map(x => x.bron), ['retail']);
});

/* ---------------- boerderij en groothandel ---------------- */

test('een oogstproduct heeft geen bestelpunt en geen kostprijs', () => {
  const K = stubKern({ boerderij: { producten: [
    { id: 'o1', naam: 'Appels', eenheid: 'kg', prijs: 2.5, voorraad: 40 }] } });
  const b = deel(K.ondernemingVoorraad(ond(K)), 'boerderij');
  assert.equal(b.artikelen, 1);
  assert.equal(b.laag, null, 'null en niet nul: er is geen bestelpunt om aan te meten');
  assert.ok(b.laagReden.includes('Wat er groeit'));
  assert.equal(b.waarde, null);
});

test('minBestel is geen bestelpunt', () => {
  const K = stubKern({ groothandel: { producten: [
    { id: 'g1', naam: 'Meel', voorraad: 900, minBestel: 50, inkoopPrijs: 0.8, actief: true },
    { id: 'g2', naam: 'Suiker', voorraad: 0, minBestel: 20, inkoopPrijs: 1, actief: true },
    { id: 'g3', naam: 'Oud', voorraad: 5, inkoopPrijs: 1, actief: false }
  ] } });
  const v = K.ondernemingVoorraad(ond(K));
  const g = deel(v, 'groothandel');
  assert.equal(g.artikelen, 2, 'wat niet actief is telt niet mee');
  assert.equal(g.laag, null);
  assert.ok(g.laagReden.includes('geen bestelpunt'),
    'anders wordt een volle groothandel als "bijna op" gemeld');
  assert.equal(g.opNul, 1, 'wat echt op is wordt wel geteld');
  assert.equal(g.waarde, 900 * 0.8);
});

/* ---------------- het totaal ---------------- */

test('het totaal telt alleen op wat een inkoopprijs draagt, en zegt wat erbuiten valt', () => {
  const K = stubKern({
    voorraad: [{ id: 'a', naam: 'Bloem', aantal: 10, min: 5, kostprijs: 2 }],
    artikelen: [{ id: 'p1', name: 'Trui', price: 89, varianten: [{ vsku: 'a', voorraad: 10 }] }],
    groothandel: { producten: [{ id: 'g1', naam: 'Meel', voorraad: 100, inkoopPrijs: 1, actief: true }] }
  });
  const v = K.ondernemingVoorraad(ond(K));
  assert.equal(v.waarde, 20 + 100);
  assert.deepEqual(v.waardeOver.sort(), ['groothandel', 'keuken']);
  assert.deepEqual(v.waardeBuiten.map(x => x.bron), ['retail'],
    'een totaal dat stilzwijgend een deel mist, wordt overgetypt in een balans');
  assert.equal(v.delen.length, 3);
});

test('nergens een dekking in dagen', () => {
  const K = stubKern({ voorraad: [{ id: 'a', naam: 'Bloem', aantal: 10, min: 5, kostprijs: 2 }],
    voorraadLog: Array.from({ length: 500 }, () => ({ at: 'x' })) });
  const v = K.ondernemingVoorraad(ond(K));
  const tekst = JSON.stringify(v);
  assert.ok(!/dagen":\s*\d/.test(tekst) && !/"dekking"/.test(tekst),
    'ook met een vol journaal komt er geen "nog vier dagen": daar baseert iemand een bestelling op');
  assert.ok(v.nietGemeten.includes('geen dekking in dagen'));
});

/* ---------------- de opvolging en het dagbeeld ---------------- */

test('de opvolging noemt alleen wat onder zijn eigen bestelpunt staat', () => {
  const K = stubKern({
    voorraad: [{ id: 'a', naam: 'Bloem', aantal: 1, min: 5, kostprijs: 2 }],
    artikelen: [{ id: 'p1', name: 'Trui', price: 89, varianten: [{ vsku: 'a', voorraad: 1 }] }],
    boerderij: { producten: [{ id: 'o1', naam: 'Appels', voorraad: 0, prijs: 2 }] }
  });
  const v = K.ondernemingVoorraad(ond(K));
  assert.equal(v.laag, 2, 'de appels op nul tellen niet mee: daar is geen bestelpunt');
  const o = VRD.voorraadOpvolging(v);
  assert.ok(o.kop.includes('2 artikelen'));
  assert.ok(o.waarom.includes('keukenvoorraad') && o.waarom.includes('winkelvoorraad'));
});

test('het dagbeeld draagt de voorraad en zet hem voor de verkoopkant', () => {
  const K = stubKern({ voorraad: [{ id: 'a', naam: 'Bloem', aantal: 1, min: 5, kostprijs: 2 }],
    vakOffertes: [] });
  const d = K.ondernemingDagbeeld(ond(K));
  assert.ok(d.voorraad, 'de voorraad hangt in het dagbeeld');
  const ids = d.acties.map(a => a.id);
  assert.ok(ids.includes('voorraad'));
  const vi = ids.indexOf('voorraad');
  const pi = ids.findIndex(x => x.startsWith('opvolging:') || x.startsWith('pijplijn:'));
  if (pi >= 0) assert.ok(vi < pi, 'wat u niet heeft kunt u ook niet verkopen');
});
