/* DE TWEE SLOTEN OP PUBLIEK VERKOPEN -- gelezen, niet nagemaakt.

   DE ZWAARSTE TOETS IS 7. Een verkoopweg die publiek live staat en dan zijn
   slot dicht ziet gaan, moet dat ZIEN en niet doorgaan op de vergunning van
   gisteren. Dat is precies wat een bewaarde `mag: true` zou doen, en het is de
   reden dat de stand elke keer opnieuw wordt gelezen.

   En toets 8: deze laag kan geen slot OPENEN. Hij krijgt twee lezers en verder
   niets; een schrijfweg zou een derde slot zijn dat de andere twee omzeilt --
   precies wat kern/webdomein.js met zijn twee sloten voorkomt.

   Draai los: node --test test/commerce-publiek.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakSlot = require('../server/kern/commerce/publiekslot');
const maakWeg = require('../server/kern/commerce/verkoopweg');

/* De vorm van een site is overgenomen uit kern/webdomein.js (siteVanZaak) en
   niet zelf bedacht: een fixture die afwijkt van de bron toetst de fixture. */
const SITE = (o) => Object.assign({ id: 's1', titel: 'Onze site', adres: 'maison', online: true, domein: 'maisonsolene.nl' }, o || {});

function slotMet(functieAan, siteVan) {
  const s = maakSlot();
  s.koppel({ functieAan, siteVan });
  return s;
}

test('1. zonder lezers is het onbekend, en onbekend houdt tegen', () => {
  const s = maakSlot();
  const st = s.stand('MODE');
  assert.equal(st.mag, false);
  assert.deepEqual(st.sloten.map(x => x.open), [null, null], 'null en niet false');
  assert.match(st.waarom, /niet vast te stellen/);
  assert.match(st.waarom, /op een vermoeden/);
});

test('2. slot een is de boardroom, en dat is de functie uit kern/webdomein.js', () => {
  assert.equal(maakSlot().FUNCTIE, 'dom-eigendomein');
  const dicht = slotMet(() => false, () => SITE());
  assert.equal(dicht.stand('MODE').mag, false);
  assert.deepEqual(dicht.stand('MODE').dicht, ['boardroom']);
  assert.match(dicht.stand('MODE').waarom, /boardroom/i);
});

test('3. slot twee is het eigen adres van DEZE zaak', () => {
  const geenSite = slotMet(() => true, () => null);
  assert.deepEqual(geenSite.stand('MODE').dicht, ['eigenAdres']);

  const geenDomein = slotMet(() => true, () => SITE({ domein: '' }));
  assert.deepEqual(geenDomein.stand('MODE').dicht, ['eigenAdres']);

  const offline = slotMet(() => true, () => SITE({ online: false }));
  assert.deepEqual(offline.stand('MODE').dicht, ['eigenAdres'],
    'een site die uit de lucht is, is geen publieke etalage');
});

test('4. staan ze allebei open, dan mag het -- op het adres van de zaak zelf', () => {
  const s = slotMet(() => true, () => SITE());
  const st = s.stand('MODE');
  assert.equal(st.mag, true);
  assert.equal(st.adres, 'maisonsolene.nl', 'geen verzonnen adres: dat van de zaak');
  assert.equal(st.waarom, null);
  assert.deepEqual(st.dicht, []);
});

test('5. de zaak komt van de aanroeper, en het slot vraagt ernaar', () => {
  const gevraagd = [];
  const s = slotMet(() => true, (code) => { gevraagd.push(code); return code === 'MODE' ? SITE() : null; });
  assert.equal(s.stand('MODE').mag, true);
  assert.equal(s.stand('ANDERE').mag, false, 'het adres van de buurman telt niet');
  assert.deepEqual(gevraagd, ['MODE', 'ANDERE']);
});

test('6. een lezer die omvalt geeft onbekend en geen open', () => {
  const stuk = slotMet(() => { throw new Error('bord weg'); }, () => SITE());
  assert.equal(stuk.stand('MODE').mag, false);
  assert.equal(stuk.stand('MODE').sloten[0].open, null);

  const stukSite = slotMet(() => true, () => { throw new Error('sites weg'); });
  assert.equal(stukSite.stand('MODE').sloten[1].open, null);
});

/* ---- en wat de verkoopweg ermee doet ---- */

function weg(functieAan, siteVan) {
  const db = { data: {} };
  return maakWeg({ db, save: () => {}, nu: () => 1700000000000,
    etalage: () => ({ teKoop: [{ id: 'a1' }], nietTeKoop: [], volledig: true }),
    publiekSlot: slotMet(functieAan, siteVan) });
}
const basis = { naam: 'Onze winkel', soort: 'web', toegang: 'publiek' };

test('7. een slot dat DICHTGAAT stopt een weg die al live stond', () => {
  let aan = true;
  const W = weg(() => aan, () => SITE());
  const w = W.zet('MODE', basis).verkoopweg;
  assert.equal(w.publiek.mag, true);
  assert.ok(W.publiceer('MODE', w.id, true).verkoopweg.live);

  aan = false;                                   // de boardroom zet hem uit
  const na = W.lijst('MODE')[0];
  assert.equal(na.publiek.mag, false, 'de stand wordt opnieuw gelezen, niet bewaard');
  assert.equal(na.staatStil, undefined);
  assert.equal(na.publiek.staatStil, true,
    'live maar mag niet meer -- dat is wat een ondernemer moet zien');
  assert.equal(na.publiek.gemaaktOp, 'maisonsolene.nl', 'waar hij ooit op stond, staat er nog');

  /* En opnieuw live zetten kan niet meer. */
  const r = W.publiceer('MODE', w.id, false);
  assert.ok(r.ok, 'uit de lucht halen mag altijd');
  assert.equal(W.publiceer('MODE', w.id, true).status, 403, 'terug live niet');
});

test('8. de verkoopweg kan geen slot openen', () => {
  const W = weg(() => false, () => SITE());
  /* Alles wat een aanroeper zou proberen om het slot te omzeilen: */
  for (const truc of [{ publiek: true }, { mag: true }, { publiekOp: 'kwaad.nl' },
                      { sloten: [{ id: 'boardroom', open: true }] }, { besluitVan: 'ikzelf' }]) {
    const r = W.zet('MODE', Object.assign({}, basis, truc));
    assert.equal(r.status, 403, JSON.stringify(truc) + ' hoort niets te openen');
  }
  assert.equal(W.lijst('MODE').length, 0);
});

test('9. de andere vier toegangen hangen nergens van af', () => {
  const W = weg(() => false, () => null);       // beide sloten dicht
  for (const t of ['personeel', 'leden', 'klanten', 'bedrijven']) {
    const r = W.zet('MODE', { naam: 'Weg ' + t, soort: 'web', toegang: t });
    assert.ok(r.ok, t + ' hoort gewoon te kunnen');
    assert.equal(r.verkoopweg.publiek, null, 'en draagt geen slotenblok');
  }
});
