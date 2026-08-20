/* ============================================================================
   FESTIVAL COMMERCE: VOORRAAD, BUNDELS, EN DE TWEE STAPPEN.

   WAAROM DIT BESTAAT

   Betalen duurt. Tussen "is er nog plek" en "hier is uw pas" zit een aanroep
   naar de betaallaag, en in dat gat kan een tweede koper dezelfde laatste plek
   krijgen. Allebei komen ze door de controle, allebei krijgen ze een pas, en
   het terrein is oververkocht. Deze toets legt vast dat de plek bij het
   RESERVEREN wordt verbruikt en niet pas bij het uitgeven.

   WAT ER WORDT VASTGELEGD

    1. Zonder voorraad is er geen grens, en met voorraad wel.
    2. Een reservering verbruikt de plek meteen -- ook zonder betaling.
    3. Een vervallen reservering geeft de plek terug, zonder opruimtaak.
    4. Loslaten geeft de plek meteen terug.
    5. Zonder betaling komt er geen pas.
    6. Een rondgemaakte verkoop geeft een pas met de rechten van het product.
    7. Een bundel verbruikt de voorraad van alles wat erin zit.
    8. Een bundel kan niet verkocht worden als EEN onderdeel vol is.
    9. Een bundelpas draagt de rechten van al zijn onderdelen.
   10. Een bundel die zichzelf bevat wordt geweigerd, en een lus in de data
       hangt niets op.
   11. Een verlopen reservering is niet meer rond te maken.
   12. Een RUIT is geen lus: twee onderdelen die hetzelfde product bevatten.
   13. Een lus OM DE HOEK (A bevat B, dan B bevat A) wordt ook geweigerd.
   14. Een lus die van buiten kwam, hangt het schrijven niet op.

   DE MUTATIES staan aan het slot.
   Puur, en elk moment wordt meegegeven: er wordt nergens op de wandklok gekeken.
   Draai los: node --test test/festival-verkoop.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');

const T0 = '2027-07-01T10:00:00.000Z';
const T_LATER = '2027-07-01T10:30:00.000Z';        // ruim na een venster van 15 minuten
const BETAALD = { methode: 'rtgpay', betaler: 'Kobalt', centen: 9500 };

function wereld() {
  const db = { data: {} };
  const k = maakFestival({ db, save() {}, crypto, schoon });
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  k.dagZet(fid, eid, { datum: '2027-07-02', open: '12:00', sluit: '02:00' });

  const prod = (d) => k.productZet(fid, eid, d);
  const res = (product, koper, moment) => k.reserveer(fid, eid,
    { product, koper: koper || 'Kobalt', moment: moment || T0 });
  const rond = (id, moment) => k.verkoopRond(fid, eid, { id, moment: moment || T0, betaald: BETAALD });
  const ruimte = (product, moment) => k.ruimte(fid, eid, product, moment || T0);
  return { k, fid, eid, prod, res, rond, ruimte };
}

const ENTREE = [{ soort: 'festival.entree' }];

test('1. zonder voorraad is er geen grens, en met voorraad wel', () => {
  const w = wereld();
  const vrij = w.prod({ naam: 'Los kaartje', prijs: 95, rechten: ENTREE }).product;
  assert.equal(w.ruimte(vrij.id).ruimte, null, 'null betekent ongelimiteerd');

  const krap = w.prod({ naam: 'Vroege vogel', prijs: 65, rechten: ENTREE, voorraad: 2 }).product;
  assert.equal(w.ruimte(krap.id).ruimte, 2);
});

test('2. een reservering verbruikt de plek meteen, ook zonder betaling', () => {
  const w = wereld();
  const p = w.prod({ naam: 'Vroege vogel', prijs: 65, rechten: ENTREE, voorraad: 2 }).product;

  const a = w.res(p.id, 'Kobalt');
  assert.equal(a.ok, true);
  assert.equal(a.verkoop.stand, 'gereserveerd');
  assert.equal(w.ruimte(p.id).ruimte, 1, 'de plek is weg voordat er een cent is betaald');

  w.res(p.id, 'Amber');
  assert.equal(w.ruimte(p.id).ruimte, 0);

  const vol = w.res(p.id, 'Ivo');
  assert.equal(vol.status, 409);
  assert.match(vol.error, /Uitverkocht/);
});

test('3. een vervallen reservering geeft de plek terug, zonder opruimtaak', () => {
  const w = wereld();
  const p = w.prod({ naam: 'Vroege vogel', prijs: 65, rechten: ENTREE, voorraad: 1 }).product;
  w.res(p.id, 'Kobalt');
  assert.equal(w.ruimte(p.id).ruimte, 0);
  /* Er wordt niets opgeruimd: dezelfde data, een later moment, en de plek is
     vrij. Een opruimtaak zou betekenen dat de voorraad pas klopt zodra die
     taak liep -- en dat is precies de tussenstand waarin er te veel weggaat. */
  assert.equal(w.ruimte(p.id, T_LATER).ruimte, 1);
});

test('4. loslaten geeft de plek meteen terug', () => {
  const w = wereld();
  const p = w.prod({ naam: 'Vroege vogel', prijs: 65, rechten: ENTREE, voorraad: 1 }).product;
  const a = w.res(p.id, 'Kobalt');
  assert.equal(w.ruimte(p.id).ruimte, 0);
  assert.equal(w.k.verkoopLos(w.fid, w.eid, { id: a.verkoop.id }).ok, true);
  assert.equal(w.ruimte(p.id).ruimte, 1);
});

test('5. zonder betaling komt er geen pas', () => {
  const w = wereld();
  const p = w.prod({ naam: 'Los kaartje', prijs: 95, rechten: ENTREE }).product;
  const a = w.res(p.id, 'Kobalt');
  const zonder = w.k.verkoopRond(w.fid, w.eid, { id: a.verkoop.id, moment: T0, betaald: {} });
  assert.equal(zonder.status, 400);
  assert.match(zonder.error, /Zonder betaling/);
  assert.equal(Object.keys(w.k.editieVind(w.fid, w.eid).passen).length, 0);
});

test('6. een rondgemaakte verkoop geeft een pas met de rechten van het product', () => {
  const w = wereld();
  const p = w.prod({ naam: 'Los kaartje', prijs: 95, rechten: ENTREE }).product;
  const a = w.res(p.id, 'Kobalt');
  const r = w.rond(a.verkoop.id);
  assert.equal(r.ok, true);
  assert.equal(r.verkoop.stand, 'betaald');
  assert.equal(r.pas.drager, 'Kobalt');
  assert.equal(r.pas.product, p.id, 'de pas draagt waar hij uit komt');
  assert.equal(r.pas.rechten.length, 1);
  assert.equal(r.verkoop.betaald.centen, 9500);
});

test('7. een bundel verbruikt de voorraad van alles wat erin zit', () => {
  const w = wereld();
  const entree = w.prod({ naam: 'Weekend', prijs: 180, rechten: ENTREE, voorraad: 10 }).product;
  const camping = w.prod({ naam: 'Camping', prijs: 60,
    rechten: [{ soort: 'camping.premium' }], voorraad: 3 }).product;
  const bundel = w.prod({ naam: 'Weekend + camping', prijs: 210, rechten: [],
    onderdelen: [entree.id, camping.id] }).product;

  assert.equal(w.ruimte(bundel.id).ruimte, 3, 'de krapste schakel bepaalt');
  const a = w.res(bundel.id, 'Kobalt');
  w.rond(a.verkoop.id);

  assert.equal(w.ruimte(camping.id).ruimte, 2, 'de bundel haalde een campingplek weg');
  assert.equal(w.ruimte(entree.id).ruimte, 9, 'en een entreeplek');
  assert.equal(w.ruimte(bundel.id).ruimte, 2);
});

test('8. een bundel kan niet verkocht worden als EEN onderdeel vol is', () => {
  const w = wereld();
  const entree = w.prod({ naam: 'Weekend', prijs: 180, rechten: ENTREE, voorraad: 10 }).product;
  const camping = w.prod({ naam: 'Camping', prijs: 60,
    rechten: [{ soort: 'camping.premium' }], voorraad: 1 }).product;
  const bundel = w.prod({ naam: 'Weekend + camping', prijs: 210, rechten: [],
    onderdelen: [entree.id, camping.id] }).product;

  // iemand koopt de laatste losse campingplek
  w.rond(w.res(camping.id, 'Amber').verkoop.id);

  const vol = w.res(bundel.id, 'Kobalt');
  assert.equal(vol.status, 409);
  assert.match(vol.error, /Camping/, 'en hij noemt WELKE schakel op is');
  assert.equal(w.ruimte(entree.id).ruimte, 10,
    'er is alleen een LOSSE camping verkocht, dus de entree is onaangeroerd -- '
    + 'dat de bundel toch weigert, komt puur door de krapste schakel');
});

test('9. een bundelpas draagt de rechten van al zijn onderdelen', () => {
  const w = wereld();
  const entree = w.prod({ naam: 'Weekend', prijs: 180, rechten: ENTREE }).product;
  const camping = w.prod({ naam: 'Camping', prijs: 60, rechten: [{ soort: 'camping.premium' }] }).product;
  const bundel = w.prod({ naam: 'Alles', prijs: 210, rechten: [{ soort: 'locker.groot' }],
    onderdelen: [entree.id, camping.id] }).product;

  const r = w.rond(w.res(bundel.id, 'Kobalt').verkoop.id);
  const soorten = r.pas.rechten.map(x => x.soort).sort();
  assert.deepEqual(soorten, ['camping.premium', 'festival.entree', 'locker.groot']);
});

test('10. een bundel die zichzelf bevat wordt geweigerd, en een lus hangt niets op', () => {
  const w = wereld();
  const a = w.prod({ naam: 'A', prijs: 10, rechten: ENTREE }).product;
  const b = w.prod({ naam: 'B', prijs: 10, rechten: [], onderdelen: [a.id] }).product;

  const zelf = w.k.productZet(w.fid, w.eid, { id: b.id, naam: 'B', prijs: 10,
    rechten: [], onderdelen: [b.id] });
  assert.equal(zelf.status, 400);
  assert.match(zelf.error, /zichzelf/);

  /* En een lus die NIET via productZet binnenkwam -- een herstelde back-up, een
     hand in db.json -- hangt niets op. Hij hoeft niet geweigerd te worden; hij
     hoort te eindigen met een verzameling die klopt. */
  const e = w.k.editieVind(w.fid, w.eid);
  e.producten[a.id].onderdelen = [b.id];          // met de hand een lus maken
  const r = w.ruimte(b.id);
  assert.equal(r.ok, true, 'een lus loopt dood in plaats van rond');

  /* Een bundel die TE DIEP genest wordt, valt bij het SCHRIJVEN af -- en niet
     pas bij het lezen, want dan is hij netjes aangenomen en daarna stuk. */
  let vorige = w.prod({ naam: 'Laag 0', prijs: 1, rechten: ENTREE }).product.id;
  let geweigerd = null;
  for (let i = 1; i < 12; i++) {
    const uit = w.prod({ naam: 'Laag ' + i, prijs: 1, rechten: [], onderdelen: [vorige] });
    if (uit.status) { geweigerd = uit; break; }
    vorige = uit.product.id;
  }
  assert.ok(geweigerd, 'ergens hoort het te stoppen');
  assert.match(geweigerd.error, /lagen diep/);
});

test('11. een verlopen reservering is niet meer rond te maken', () => {
  const w = wereld();
  const p = w.prod({ naam: 'Los kaartje', prijs: 95, rechten: ENTREE }).product;
  const a = w.res(p.id, 'Kobalt');
  const laat = w.rond(a.verkoop.id, T_LATER);
  assert.equal(laat.status, 409);
  assert.match(laat.error, /verlopen/);
  assert.equal(Object.keys(w.k.editieVind(w.fid, w.eid).passen).length, 0);
});

test('12. een ruit is geen lus: twee onderdelen die hetzelfde bevatten', () => {
  const w = wereld();
  /* Weekend zit in zowel het camping- als het VIP-pakket, en de grote bundel
     bevat ze allebei. Dat is een RUIT en geen lus: het hoort te verkopen, en
     het weekend hoort EEN keer te tellen -- je krijgt die plek immers een keer. */
  const weekend = w.prod({ naam: 'Weekend', prijs: 180, rechten: ENTREE, voorraad: 5 }).product;
  const camp = w.prod({ naam: 'Campingpakket', prijs: 240, rechten: [{ soort: 'camping.premium' }],
    onderdelen: [weekend.id] }).product;
  const vip = w.prod({ naam: 'VIP-pakket', prijs: 320, rechten: [{ soort: 'vip.dek' }],
    onderdelen: [weekend.id] }).product;
  const alles = w.prod({ naam: 'Alles', prijs: 480, rechten: [], onderdelen: [camp.id, vip.id] }).product;

  const r = w.ruimte(alles.id);
  assert.equal(r.ok, true, 'een ruit is geen lus en hoort geen 409 te geven');
  assert.equal(r.ruimte, 5);

  const uit = w.rond(w.res(alles.id, 'Kobalt').verkoop.id);
  assert.equal(uit.ok, true);
  assert.equal(w.ruimte(weekend.id).ruimte, 4, 'het weekend gaat er EEN keer af, niet twee');

  const soorten = uit.pas.rechten.map(x => x.soort).sort();
  assert.deepEqual(soorten, ['camping.premium', 'festival.entree', 'vip.dek'],
    'en de entree staat er ook maar een keer op');
});

test('13. een lus om de hoek wordt ook geweigerd', () => {
  const w = wereld();
  const a = w.prod({ naam: 'A', prijs: 10, rechten: ENTREE }).product;
  const b = w.prod({ naam: 'B', prijs: 10, rechten: [], onderdelen: [a.id] }).product;

  /* A gaat nu B bevatten. Dat is dezelfde lus als zichzelf bevatten, alleen een
     stap verderop -- en de controle op `o === d.id` ziet hem niet. */
  const lus = w.k.productZet(w.fid, w.eid, { id: a.id, naam: 'A', prijs: 10,
    rechten: ENTREE, onderdelen: [b.id] });
  assert.equal(lus.status, 400);
  assert.match(lus.error, /lus/);
});

test('14. een lus die van buiten kwam, hangt het schrijven niet op', () => {
  const w = wereld();
  const c = w.prod({ naam: 'C', prijs: 10, rechten: ENTREE }).product;
  const d = w.prod({ naam: 'D', prijs: 10, rechten: [], onderdelen: [c.id] }).product;
  /* Een herstelde back-up, een hand in db.json: C bevat D, D bevat C. */
  const e = w.k.editieVind(w.fid, w.eid);
  e.producten[c.id].onderdelen = [d.id];

  /* Een NIEUW product dat naar die lus wijst. Zonder grendel in ketenDiepte
     loopt het schrijven hier oneindig door in plaats van te weigeren. */
  const uit = w.prod({ naam: 'E', prijs: 10, rechten: [], onderdelen: [d.id] });
  assert.ok(uit.status, 'het wordt geweigerd in plaats van te hangen');
  assert.equal(uit.status, 400);
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   Dertien mutaties, alle dertien RAAK -- maar drie ervan pas NA een reparatie
   die ze zelf hebben aangewezen. Dat staat er met opzet bij.

    1. actief(): een reservering pas laten meetellen zodra er betaald is.
       -> negen toetsen zakten. Dit is de kern van het hele ontwerp: de plek
          wordt verbruikt bij het RESERVEREN, want tussen de controle en de pas
          zit een betaling waarin een tweede koper langskomt.

    2. Het `tot` van een reservering negeren, zodat hij nooit vervalt.
       -> toetsen 3 en 11 zakten: de plek kwam nooit meer vrij.

    3. verbruikt() alleen het product zelf laten tellen.
       -> toetsen 7 en 12 zakten: een bundel haalde geen plek van zijn
          onderdelen af, dus camping kon dubbel verkocht worden.

    4. ruimte() alleen naar het product zelf laten kijken.
       -> toetsen 7, 8 en 12 zakten: de krapste schakel bepaalde niets meer.

    5. Rondmaken zonder betaling toestaan.  -> toets 5 zakte.
    6. Een verlopen reservering toch rond laten maken. -> toets 11 zakte.
    7. productRechten() alleen de eigen rechten laten geven.
       -> toetsen 9 en 12 zakten: een bundelpas gaf geen toegang tot wat erin zat.
    8. Loslaten de stand niet laten zetten. -> toets 4 zakte.
    9. Een bundel zichzelf laten bevatten. -> toets 10 zakte.

   10. AFGESLAGEN, EN DAT WEES EEN ECHTE FOUT AAN. De cyclusgrendel in keten()
       stond als `if (uit.has(p.id)) return null`. De mutatie ving niets, en bij
       het uitzoeken bleek waarom: die regel was niet overbodig maar FOUT. Een
       RUIT -- een bundel met twee onderdelen die allebei hetzelfde product
       bevatten -- is geen lus, en werd zo wel geweigerd. Nu staat er `return
       uit`, en toets 12 legt vast dat het weekend er een keer af gaat en niet
       twee keer.

   11. De dieptegrens bij het schrijven weghalen (product.js).
       -> toetsen 10 en 14 zakten.

   12. De controle op een lus OM DE HOEK weghalen (A bevat B, dan B bevat A).
       -> toets 13 zakte. Ook deze controle bestond eerst niet: de mutatie op
          nummer 13 sloeg af, en bij het uitzoeken bleek dat productZet alleen
          `o === d.id` toetste. Een lus een stap verderop kwam er dus gewoon in.

   13. De dieptegrendel in ketenDiepte() weghalen.
       -> toets 14 zakte (het schrijven liep oneindig door). Ook deze mutatie
          sloeg de eerste keer af, omdat geen enkele toets die grendel bereikte:
          er was geen toets met een lus die NIET via productZet binnenkwam.

   Drie keer wees een afgeslagen mutatie dus iets echts aan -- twee keer een gat
   in de toetsen, en een keer een regel die eruitzag als een wacht en in
   werkelijkheid een legitiem geval kapotmaakte. Daar is de discipline voor.
   ========================================================================== */
