/* ============================================================================
   FESTIVAL READINESS: EEN GETAL DAT NIET GROEN TE PRATEN IS.

   WAAROM DIT BESTAAT

   Een Festival Readiness Score van 98,7% is een mooi getal en juist daarom
   gevaarlijk (FESTIVAL.md par. 5.5, LAT.md regel 11: bewijsgroen is geen
   go-live-groen). Elk procent hoort uit een control met BEWIJS te komen, en er
   horen precies drie wegen naar groen NIET te bestaan: een stuk dat niemand
   zag, een stuk dat verlopen is, en een kritieke control die stilletjes wordt
   afgezwakt. Deze toets sluit die drie.

   WAT ER WORDT VASTGELEGD

    1. Een editie zonder controls is ONGEKEURD, en dat is geen 100%.
    2. Zonder peildatum komt er geen uitslag, want "verlopen" bestaat dan niet.
    3. Een ingediend stuk telt nul; pas een afgetekend stuk telt.
    4. Wie indient, tekent niet zelf af.
    5. Een verlopen stuk telt niet meer, en dat hangt aan de peildatum.
    6. Een open kritieke control zet alles op NIET GEREED, ook bij 90%.
    7. Een nieuw stuk wist de aftekening van het vorige.
    8. Afzwakken van kritiek vraagt een reden en komt terug in de uitslag.
    9. De open punten staan op volgorde: kritiek eerst, verlopen voor ontbreekt.
   10. De startlijst is een begin en geen tweede lijst.

   DE MUTATIES staan aan het slot.
   Puur, dus zonder server; de peildatum wordt meegegeven en nooit uit de
   wandklok gelezen.
   Draai los: node --test test/festival-gereed.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

function wereld(metSeed) {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  if (metSeed) k.controlsSeed(fid, eid);
  const alle = () => Object.values(k.editieVind(fid, eid).controls || {});
  const stand = (op) => k.gereedheid(fid, eid, { op: op || '2027-07-01' });
  const dien = (id, extra) => k.bewijsIndienen(fid, eid, { control: id, soort: 'besluit',
    nummer: 'X-1', door: 'Marta', ...(extra || {}) });
  const teken = (id, wie) => k.bewijsAftekenen(fid, eid, { control: id, door: wie || 'Pere' });
  return { k, fid, eid, alle, stand, dien, teken };
}

test('1. een editie zonder controls is ongekeurd, en dat is geen 100%', () => {
  const w = wereld(false);
  const s = w.stand();
  assert.equal(s.stand, 'niet-gereed');
  assert.equal(s.deel, 0);
  assert.equal(s.totaal, 0);
  assert.match(s.zin, /geen 100%/, 'de zin zegt met zoveel woorden dat leeg niet groen is');
});

test('2. zonder peildatum komt er geen uitslag', () => {
  const w = wereld(true);
  const r = w.k.gereedheid(w.fid, w.eid, {});
  assert.equal(r.status, 400);
  assert.match(r.error, /peildatum/);
  assert.equal(w.k.gereedheid(w.fid, w.eid, { op: 'morgen' }).status, 400);
});

test('3. een ingediend stuk telt nul; pas een afgetekend stuk telt', () => {
  const w = wereld(true);
  const c = w.alle()[0];
  assert.equal(w.stand().gezien, 0);

  w.dien(c.id);
  const na = w.stand();
  assert.equal(na.gezien, 0, 'ingediend is geen bewijs, alleen een belofte met een bijlage');
  assert.equal(na.controls.find(x => x.id === c.id).stand, 'ingediend');

  w.teken(c.id);
  assert.equal(w.stand().gezien, 1);
  assert.equal(w.stand().controls.find(x => x.id === c.id).stand, 'gezien');
});

test('4. wie indient, tekent niet zelf af', () => {
  const w = wereld(true);
  const c = w.alle()[0];
  w.dien(c.id, { door: 'Marta' });
  const zelf = w.teken(c.id, 'Marta');
  assert.equal(zelf.status, 409);
  assert.match(zelf.error, /tekent het niet zelf af/);
  assert.equal(w.teken(c.id, 'Pere').ok, true);
});

test('5. een verlopen stuk telt niet meer, en dat hangt aan de peildatum', () => {
  const w = wereld(true);
  const c = w.alle()[0];
  w.dien(c.id, { geldigTot: '2027-06-30' });
  w.teken(c.id);
  assert.equal(w.stand('2027-06-01').gezien, 1, 'op 1 juni is hij nog geldig');
  const na = w.stand('2027-07-01');
  assert.equal(na.gezien, 0, 'op 1 juli is hij verlopen');
  assert.equal(na.controls.find(x => x.id === c.id).stand, 'verlopen');
});

test('6. een open kritieke control zet alles op NIET GEREED', () => {
  const w = wereld(true);
  const alle = w.alle();
  const kritiek = alle.filter(c => c.kritiek);
  assert.ok(kritiek.length >= 2, 'de startlijst kent kritieke controls');

  /* Alles aftekenen behalve EEN kritieke: het percentage gaat ver boven de
     negentig, en de stand hoort dat niet te volgen. */
  for (const c of alle) {
    if (c.id === kritiek[0].id) continue;
    w.dien(c.id); w.teken(c.id);
  }
  const s = w.stand();
  assert.ok(s.deel > 90, 'het percentage is hoog: ' + s.deel);
  assert.equal(s.stand, 'niet-gereed');
  assert.equal(s.kritiekOpen, 1);
  assert.match(s.zin, /NIET GEREED/);
  assert.match(s.zin, new RegExp(kritiek[0].naam), 'en hij noemt WELKE');

  w.dien(kritiek[0].id); w.teken(kritiek[0].id);
  const groen = w.stand();
  assert.equal(groen.stand, 'gereed');
  assert.equal(groen.deel, 100);
});

test('7. een nieuw stuk wist de aftekening van het vorige', () => {
  const w = wereld(true);
  const c = w.alle()[0];
  w.dien(c.id); w.teken(c.id);
  assert.equal(w.stand().gezien, 1);
  w.dien(c.id, { soort: 'gewijzigd besluit' });
  assert.equal(w.stand().gezien, 0, 'wie iets vervangt, vervangt ook wat er over het oude was vastgesteld');
});

test('8. afzwakken van kritiek vraagt een reden en komt terug in de uitslag', () => {
  const w = wereld(true);
  const c = w.alle().find(x => x.kritiek);

  const zonder = w.k.controlZet(w.fid, w.eid, { id: c.id, naam: c.naam, groep: c.groep, eis: c.eis, kritiek: false });
  assert.equal(zonder.status, 400);
  assert.match(zonder.error, /reden/);

  const met = w.k.controlZet(w.fid, w.eid, { id: c.id, naam: c.naam, groep: c.groep, eis: c.eis,
    kritiek: false, reden: 'valt onder de vergunning van de gemeente', door: 'Marta' });
  assert.equal(met.ok, true);

  const s = w.stand();
  assert.equal(s.afgezwakt.length, 1);
  assert.equal(s.afgezwakt[0].control, c.naam);
  assert.match(s.zin, /afgezwakt/, 'de uitslag zwijgt er niet over');
});

test('9. de open punten staan op volgorde: kritiek eerst, verlopen voor ontbreekt', () => {
  const w = wereld(true);
  const alle = w.alle();
  const gewoon = alle.find(c => !c.kritiek);
  const krit = alle.find(c => c.kritiek);
  const krit2 = alle.filter(c => c.kritiek)[1];

  // een gewone control met een VERLOPEN stuk, en een kritieke die ontbreekt
  w.dien(gewoon.id, { geldigTot: '2027-06-01' }); w.teken(gewoon.id);
  w.dien(krit2.id, { geldigTot: '2027-06-01' }); w.teken(krit2.id);

  const open = w.stand('2027-07-01').open;
  assert.equal(open[0].kritiek, true, 'kritiek staat vooraan');
  const kritOpen = open.filter(o => o.kritiek);
  assert.equal(kritOpen[0].stand, 'verlopen',
    'binnen kritiek eerst het verlopen stuk: iemand DACHT dat dat geregeld was');
  assert.ok(open.some(o => o.id === krit.id && o.stand === 'ontbreekt'));
});

test('10. de startlijst is een begin en geen tweede lijst', () => {
  const w = wereld(true);
  const nog = w.k.controlsSeed(w.fid, w.eid);
  assert.equal(nog.status, 409, 'een tweede keer zaaien zou alles verdubbelen');

  const eigen = w.k.controlZet(w.fid, w.eid, { groep: 'veiligheid', naam: 'Eigen keuring',
    eis: 'het rapport', kritiek: true });
  assert.equal(eigen.ok, true, 'en de organisator zet er zelf bij: dit is geen wet');
  assert.equal(w.alle().length, 13);

  const raar = w.k.controlZet(w.fid, w.eid, { groep: 'onzin', naam: 'X', eis: 'y' });
  assert.equal(raar.status, 400, 'maar niet in een groep die niet bestaat');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Tien mutaties, alle tien RAAK.

    1. standVanControl() een ingediend stuk als 'gezien' laten tellen.
       -> toetsen 3 en 7 zakten. Dit is de belangrijkste: het verschil tussen
          "er ligt een stuk" en "iemand heeft ernaar gekeken" IS de hele
          bewijslaag. Zonder dat verschil telt een map met bijlagen als groen.

    2. De verloopdatum uit standVanControl() gehaald.
       -> toetsen 5 en 9 zakten. Dat 9 meezakt is zelf een bevinding: de
          volgorde van de open punten hangt aan dezelfde stand, dus een kapotte
          houdbaarheid maakt ook de rangschikking stil onjuist.

    3. De functiescheiding bij bewijsAftekenen() uitgezet.
       -> toets 4 zakte: dezelfde mens diende in en tekende af.

    4. In gereedheid() `!leeg &&` uit de gereed-berekening gehaald.
       -> toets 1 zakte: een editie zonder enkele control meldde GEREED. Dat is
          de gevaarlijkste vorm van groen die er is -- honderd procent van nul.

    5. De eis van een peildatum weggehaald.
       -> toets 2 zakte. Zonder peildatum bestaat "verlopen" niet, en dan is
          elke uitslag een gok (LAT-regel 3).

    6. gereed = !leeg, dus zonder naar de kritieke controls te kijken.
       -> toets 6 zakte: 91,7% en toch GEREED, met de evenementenvergunning open.

    7. De reden-eis bij het afzwakken van een kritieke control weggehaald.
       -> toets 8 zakte. Dit is de enige weg naar groen die geen bewijs vraagt;
          hij mag bestaan, maar niet stil.

    8. Bij een nieuw stuk de oude aftekening laten staan.
       -> toets 7 zakte: een gewijzigd besluit erfde de handtekening van het
          vorige.

    9. De sortering van de open punten weggehaald.
       -> toets 9 zakte.

   10. controlsSeed() twee keer laten zaaien.
       -> toets 10 zakte: alles verdubbelde, en daarmee ook het noemer van het
          percentage.
   ========================================================================== */
