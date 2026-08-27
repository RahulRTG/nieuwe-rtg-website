/* DE VERKOOPWEG -- waarlangs een zaak verkoopt.

   DE ZWAARSTE TOETS IS 4. Publiek verkopen kan hier niet, en dat is een
   GEWEIGERDE regel en geen ontbrekende: kern/webdomein.js legt uit dat een
   openbaar adres verandert wie de lezers zijn, en zet daar twee sloten op
   waarvan het eerste een besluit van de boardroom is. Een verkoopweg die
   zichzelf publiek kan zetten, legt daar een derde naast die de andere twee
   omzeilt. De weigering draagt de REDEN, zoals TENANT.md de modus `sovereign`
   weigert in plaats van hem als knop te laten bestaan.

   En toets 7: de weg telt zijn aanbod NIET zelf maar vraagt het aan de graaf.
   Een eigen kopie loopt binnen een week uiteen met wat er werkelijk te koop
   staat, en dan staat er een winkel met een verzonnen aantal artikelen.

   Draai los: node --test test/commerce-verkoopweg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakWeg = require('../server/kern/commerce/verkoopweg');

/* Een verse motor per toets, met een etalage die we zelf sturen: zo is te
   toetsen wat er gebeurt als de aanbodlaag omvalt zonder dat daar een echte
   kapotte bron voor nodig is. */
function motor(etalage) {
  const db = { data: {} };
  return maakWeg({ db, save: () => {}, nu: () => 1700000000000,
    etalage: etalage || (() => ({ teKoop: [{ id: 'a1' }, { id: 'a2' }], nietTeKoop: [{ id: 'x' }], volledig: true })) });
}
const basis = { naam: 'Onze winkel', soort: 'web', toegang: 'leden' };

test('1. een verkoopweg heeft een naam, een soort en een toegang', () => {
  const W = motor();
  assert.equal(W.zet('MODE', { soort: 'web', toegang: 'leden' }).status, 400);
  assert.equal(W.zet('MODE', { naam: 'X', toegang: 'leden' }).status, 400);
  assert.equal(W.zet('MODE', { naam: 'X', soort: 'web' }).status, 400);
  assert.equal(W.zet('', basis).status, 400, 'en altijd bij een zaak');
  assert.ok(W.zet('MODE', basis).ok);
});

test('2. soort en toegang komen uit een gesloten lijst', () => {
  const W = motor();
  assert.equal(W.zet('MODE', Object.assign({}, basis, { soort: 'telepathie' })).status, 400);
  assert.equal(W.zet('MODE', Object.assign({}, basis, { toegang: 'iedereen-behalve-jan' })).status, 400);
  assert.ok(W.WEGSOORTEN.every(s => s.id && s.label && s.wat));
  assert.ok(W.TOEGANG.every(t => t.id && t.label && typeof t.kan === 'boolean'));
});

test('3. de zaak komt van de aanroeper en niet uit het lijf', () => {
  const W = motor();
  W.zet('MODE', Object.assign({}, basis, { zaak: 'ANDERE', zaakCode: 'ANDERE' }));
  assert.equal(W.lijst('ANDERE').length, 0, 'een zaakveld in de body doet niets');
  assert.equal(W.lijst('MODE').length, 1);
  assert.equal(W.lijst('MODE')[0].zaak, 'MODE');
});

test('4. PUBLIEK verkopen wordt geweigerd, met de reden en de beslisser', () => {
  const W = motor();
  const r = W.zet('MODE', Object.assign({}, basis, { toegang: 'publiek' }));
  assert.equal(r.status, 403);
  assert.match(r.error, /wie de lezers zijn/);
  assert.equal(r.besluitVan, 'boardroom');
  assert.equal(W.lijst('MODE').length, 0, 'en er blijft niets half aangemaakt staan');

  /* De optie STAAT in de lijst, met kan:false en een waarom. Een lijst waar hij
     niet in staat laat de vraag onbeantwoord; deze geeft het antwoord. */
  const p = W.TOEGANG.find(t => t.id === 'publiek');
  assert.equal(p.kan, false);
  assert.ok(p.waarom && p.waarom.length > 40);
});

test('5. live zetten is een aparte handeling dan bewerken', () => {
  const W = motor();
  const w = W.zet('MODE', basis).verkoopweg;
  assert.equal(w.live, false, 'nieuw is niet live');
  assert.equal(W.publiceer('MODE', w.id, true).verkoopweg.live, true);
  assert.equal(W.publiceer('MODE', w.id, false).verkoopweg.live, false);
  assert.equal(W.publiceer('MODE', 'bestaat-niet', true).status, 404);
});

test('6. een lege verkoopweg gaat niet live', () => {
  const W = motor();
  const w = W.zet('MODE', Object.assign({}, basis, { alleen: ['bestaat-niet'] })).verkoopweg;
  assert.equal(w.teKoop, 0);
  const r = W.publiceer('MODE', w.id, true);
  assert.equal(r.status, 409);
  assert.match(r.error, /niets te koop/);
});

test('7. de telling komt uit de graaf, niet uit een eigen kopie', () => {
  let aanbod = [{ id: 'a1' }, { id: 'a2' }];
  const W = motor(() => ({ teKoop: aanbod, nietTeKoop: [], volledig: true }));
  const w = W.zet('MODE', basis).verkoopweg;
  assert.equal(w.teKoop, 2);
  aanbod = [{ id: 'a1' }];                       // het domein verandert
  assert.equal(W.lijst('MODE')[0].teKoop, 1, 'de weg beweegt mee zonder dat iemand hem bijwerkt');
});

test('8. een selectie is een opsomming, en leeg betekent alles', () => {
  const W = motor();
  const alles = W.zet('MODE', basis).verkoopweg;
  assert.equal(alles.selectie, 'alles wat te koop staat');
  assert.equal(alles.teKoop, 2);
  const deel = W.zet('MODE', Object.assign({}, basis, { naam: 'Kassa', soort: 'pos', alleen: ['a1'] })).verkoopweg;
  assert.equal(deel.selectie, 'gekozen');
  assert.equal(deel.teKoop, 1);
});

test('9. een kapotte aanbodlaag geeft geen nul maar een onbekend', () => {
  const W = motor(() => { throw new Error('bron weg'); });
  const w = W.zet('MODE', basis).verkoopweg;
  assert.equal(w.teKoop, null, 'nul zou "deze winkel is leeg" betekenen; dat weten we niet');
  assert.match(w.tellingOnbekend, /niet worden gelezen/);
});

test('10. wat er met opzet niet is, staat er met de reden', () => {
  const W = motor();
  for (const k of ['prijsbeleid', 'betaalbeleid', 'fulfilmentbeleid', 'eigenDomein', 'merk']) {
    assert.ok(W.NIET_GEBOUWD[k] && W.NIET_GEBOUWD[k].length > 40, k + ' hoort een reden te dragen');
  }
  assert.match(W.NIET_GEBOUWD.eigenDomein, /twee sloten/);
});

test('11. het aantal verkoopwegen per zaak is begrensd', () => {
  const W = motor();
  for (let i = 0; i < W.MAX_PER_ZAAK; i++) W.zet('MODE', Object.assign({}, basis, { naam: 'Weg ' + i }));
  const r = W.zet('MODE', Object.assign({}, basis, { naam: 'Een te veel' }));
  assert.equal(r.status, 409);
  // bijwerken van een bestaande mag wel, ook aan de grens
  const id = W.lijst('MODE')[0].id;
  assert.ok(W.zet('MODE', Object.assign({}, basis, { id, naam: 'Hernoemd' })).ok);
});
