/* RTG MOVE (server/kern/move/) -- de naad tussen twee reisonderdelen.

   Getoetst als PURE motor: ./naad, ./haalbaar en ./gevolg krijgen hun rekenaars
   ingespoten, dus er komt geen server en geen browser aan te pas. Dat is precies
   waarom ze zo geschreven zijn -- de compositie (./index.js) leest de kern laat
   en is daarmee een bedradingsvraag, geen rekenvraag.

   DE SCHERPSTE TOETSEN HIER ZIJN 3, 6 EN 9. Drie keer dezelfde faalvorm, en het
   is de faalvorm die dit huis het duurst heeft betaald: iets dat niet gemeten
   is, dat er groen uitziet. Een naad zonder plek mag geen RUIM worden (3), een
   reis waarvan geen enkele overgang te bepalen is mag geen oordeel krijgen (6),
   en een gevolgregel die niet te bepalen is mag geen "geen gevolg" heten (9).

   Draai los: node --test test/move.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const { naad, UITKOMST, tijdstip } = require('../server/kern/move/naad');
const { haalbaar } = require('../server/kern/move/haalbaar');
const { gevolg } = require('../server/kern/move/gevolg');

const P = (lat, lng, label) => ({ lat, lng, label: label || '' });
/* Een vaste rekenaar: vijftien minuten voor elke rit. Zo meet de toets de
   BESLISSING en niet de routemotor -- die heeft zijn eigen toetsen. */
const vast = (min) => () => ({ minuten: min, modus: 'auto', bron: 'toets' });
const verM = (m) => () => m;
const T = (dag, uur) => tijdstip(dag, uur);

test('1. tijdstip: een dag zonder uur levert geen tijdstip', () => {
  assert.equal(T('2026-09-10', '14:30'), Date.parse('2026-09-10T14:30:00Z'));
  assert.equal(T('2026-09-10', null), null, 'zonder uur geen tijdstip');
  assert.equal(T('2026-09-10', 'later'), null, 'onzin is geen uur');
  assert.equal(T(null, '14:30'), null, 'zonder dag geen tijdstip');
});

test('2. de naad rekent de marge en noemt de drempel een huiskeuze', () => {
  const r = naad({
    van: { plek: P(38.91, 1.43), klaarAt: T('2026-09-10', '18:00') },
    naar: { plek: P(38.95, 1.50), nodigAt: T('2026-09-10', '19:00') },
    reisTijd: vast(15), afstandM: verM(6000)
  });
  assert.equal(r.uitkomst, UITKOMST.RUIM);
  assert.equal(r.beschikbaarMin, 60);
  assert.equal(r.nodigMin, 15);
  assert.equal(r.margeMin, 45);
  /* Een drempel die zich voordoet als meting is erger dan geen drempel. */
  assert.equal(r.drempel.grond, 'huiskeuze');
  assert.ok(r.nietGewogen.includes('dienstregeling'), 'zegt wat er niet in zit');
});

test('3. een naad zonder plek of tijd wordt NOOIT ruim', () => {
  const zonderPlek = naad({
    van: { plek: null, klaarAt: T('2026-09-10', '18:00') },
    naar: { plek: P(38.95, 1.50), nodigAt: T('2026-09-10', '19:00') },
    reisTijd: vast(15)
  });
  assert.equal(zonderPlek.uitkomst, UITKOMST.NIET_TE_BEPALEN);
  assert.deepEqual(zonderPlek.mist, ['plek-van']);
  const zonderTijd = naad({
    van: { plek: P(38.91, 1.43), klaarAt: null },
    naar: { plek: P(38.95, 1.50), nodigAt: T('2026-09-10', '19:00') },
    reisTijd: vast(15)
  });
  assert.equal(zonderTijd.uitkomst, UITKOMST.NIET_TE_BEPALEN);
  assert.deepEqual(zonderTijd.mist, ['tijd-van']);
  /* En een rekenaar die NEE zegt (navigatie weigert in Nederland zonder NWB)
     levert onbekend en geen ruime marge. */
  const geenRoute = naad({
    van: { plek: P(52.37, 4.89), klaarAt: T('2026-09-10', '18:00') },
    naar: { plek: P(52.09, 5.12), nodigAt: T('2026-09-10', '23:00') },
    reisTijd: () => null
  });
  assert.equal(geenRoute.uitkomst, UITKOMST.NIET_TE_BEPALEN);
  assert.deepEqual(geenRoute.mist, ['reistijd']);
});

test('4. krap en onhaalbaar liggen op de drempel, en negatief is onhaalbaar', () => {
  const basis = (nodigUur, rit) => naad({
    van: { plek: P(38.91, 1.43), klaarAt: T('2026-09-10', '18:00') },
    naar: { plek: P(38.95, 1.50), nodigAt: T('2026-09-10', nodigUur) },
    reisTijd: vast(rit), afstandM: verM(6000)
  }).uitkomst;
  assert.equal(basis('19:00', 45), UITKOMST.KRAP, '15 min marge is krap');
  assert.equal(basis('19:00', 30), UITKOMST.RUIM, '30 min marge haalt de drempel');
  assert.equal(basis('18:30', 45), UITKOMST.ONHAALBAAR, 'meer nodig dan beschikbaar');
});

test('5. dezelfde plek is geen krappe overstap', () => {
  const r = naad({
    van: { plek: P(38.91, 1.43), klaarAt: T('2026-09-10', '18:55') },
    naar: { plek: P(38.9101, 1.4301), nodigAt: T('2026-09-10', '19:00') },
    reisTijd: vast(15), afstandM: verM(20)
  });
  assert.equal(r.uitkomst, UITKOMST.GEEN_BEWEGING,
    'een restaurant in hetzelfde hotel is geen overstap van vijf minuten');
});

/* --------------------------------- de reis -------------------------------- */

const reisje = () => [
  { titel: 'Vlucht', soort: 'vlucht', kenmerk: 'V1', plek: P(38.87, 1.37),
    nodigAt: T('2026-09-10', '17:00'), klaarAt: T('2026-09-10', '18:10') },
  { titel: 'Hotel', soort: 'verblijf', kenmerk: 'H1', plek: P(38.91, 1.43),
    nodigAt: T('2026-09-10', '18:55'), klaarAt: T('2026-09-10', '19:05') },
  { titel: 'Sal de Mar', soort: 'horeca', kenmerk: 'R1', plek: P(38.95, 1.50),
    nodigAt: T('2026-09-10', '19:00'), klaarAt: null }
];

test('6. de reis erft de STRENGSTE naad, en zonder bepaalde naad geen oordeel', () => {
  const r = haalbaar({ onderdelen: reisje(), reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(r.naden.length, 2, 'drie onderdelen geven twee overgangen');
  /* Vlucht klaar 18:10 -> hotel nodig 18:55 = 45 beschikbaar, 15 nodig: RUIM.
     Hotel klaar 19:05 -> restaurant nodig 19:00 = negatief: ONHAALBAAR.
     De reis is dus onhaalbaar en niet "gemiddeld in orde". */
  assert.equal(r.oordeel, UITKOMST.ONHAALBAAR);
  assert.equal(r.oorzaak.nr, 2, 'de naad die het oordeel veroorzaakt staat erbij');
  assert.equal(r.dekking, 100);

  const blind = haalbaar({ onderdelen: reisje().map(o => ({ ...o, plek: null })),
    reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(blind.oordeel, null, 'geen bepaalde naad = geen oordeel, ook niet groen');
  assert.equal(blind.dekking, 0);
  assert.match(blind.waarom, /niets te zeggen|niet/i);
});

test('7. onbepaalde naden worden apart geteld en maskeren geen oordeel', () => {
  const half = reisje();
  half[2] = { ...half[2], plek: null };               // laatste bestemming onbekend
  const r = haalbaar({ onderdelen: half, reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(r.oordeel, UITKOMST.RUIM, 'de bepaalde naad is ruim');
  assert.equal(r.telling.nietTeBepalen, 1, 'en de onbepaalde staat er los bij');
  assert.equal(r.dekking, 50, 'de dekking zegt dat het over de helft gaat');
});

test('7b. een door elkaar aangeleverde reis geeft dezelfde uitkomst als een gesorteerde', () => {
  /* DIT IS DE TOETS OP EEN ECHTE BUG, en niet op een voorstelbare. De eerste
     volle ronde over twee betaalde boekingen (10:00 en 11:15) gaf
     `beschikbaarMin: -135` en een netjes onderbouwd ONHAALBAAR -- RTG rekende
     een overgang terug in de tijd, want reiswereld.komend() sorteert op zijn
     eigen rangorde en niet chronologisch. Het antwoord zag compleet uit, met
     een echte reistijd en bron erbij. */
  const op = reisje();
  const doorElkaar = [op[2], op[0], op[1]];
  const a = haalbaar({ onderdelen: op, reisTijd: vast(15), afstandM: verM(6000) });
  const b = haalbaar({ onderdelen: doorElkaar, reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(b.oordeel, a.oordeel, 'de volgorde van aanlevering mag het oordeel niet bepalen');
  assert.deepEqual(b.naden.map(n => n.beschikbaarMin), a.naden.map(n => n.beschikbaarMin));
  assert.deepEqual(b.naden.map(n => n.van.titel), a.naden.map(n => n.van.titel),
    'de overgangen lopen in beide gevallen langs dezelfde onderdelen');
  /* WAT HIER MET OPZET NIET STAAT: een eis dat `beschikbaarMin` nooit negatief
     is. Die assertie stond er even en was zelf fout -- negatief is precies HOE
     "u kunt niet op tijd weg" zich uit (het hotel houdt u tot 19:05 terwijl u
     om 19:00 aan tafel moet), en dat is de legitieme ONHAALBAAR uit toets 6.
     Een toets die dat verbiedt, verklaart een echte uitkomst tot bug. */
});

test('7c. een onderdeel zonder tijd doet niet mee, maar verdwijnt ook niet stil', () => {
  const rij = reisje().concat([{ titel: 'Hotelbon', soort: 'verblijf', kenmerk: 'B1',
    plek: P(38.9, 1.4), nodigAt: null, klaarAt: null }]);
  const r = haalbaar({ onderdelen: rij, reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(r.telling.zonderTijd, 1, 'het onderdeel zonder tijd wordt geteld');
  assert.equal(r.naden.length, 2, 'en doet niet mee aan de overgangen');
});

test('8. minder dan twee onderdelen heeft geen overgang', () => {
  const r = haalbaar({ onderdelen: [reisje()[0]], reisTijd: vast(15) });
  assert.equal(r.oordeel, null);
  assert.equal(r.naden.length, 0);
  assert.match(r.waarom, /geen overgang/i);
});

/* -------------------------------- het gevolg ------------------------------- */

test('9. een vertraging raakt alleen wat erdoor breekt, en zegt het per onderdeel', () => {
  /* Een reis die zonder vertraging helemaal klopt. */
  const rij = [
    { titel: 'Vlucht', soort: 'vlucht', kenmerk: 'V1', plek: P(38.87, 1.37),
      nodigAt: T('2026-09-10', '17:00'), klaarAt: T('2026-09-10', '18:10') },
    { titel: 'Hotel', soort: 'verblijf', kenmerk: 'H1', plek: P(38.91, 1.43),
      nodigAt: T('2026-09-10', '19:30'), klaarAt: T('2026-09-10', '19:40') },
    { titel: 'Sal de Mar', soort: 'horeca', kenmerk: 'R1', plek: P(38.95, 1.50),
      nodigAt: T('2026-09-10', '21:00'), klaarAt: null }
  ];
  const schoon = haalbaar({ onderdelen: rij, reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(schoon.oordeel, UITKOMST.RUIM, 'de ijklijn klopt');

  const g = gevolg({ onderdelen: rij, kenmerk: 'V1', minuten: 65,
    reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(g.status, 200);
  assert.equal(g.oordeelVoor, UITKOMST.RUIM);
  /* NAGEREKEND EN NIET AANGENOMEN, en de eerste versie van deze toets had het
     mis: vlucht klaar 18:10 + 65 = 19:15, hotel nodig 19:30, dus 15 minuten
     beschikbaar en 15 nodig -- marge exact NUL. Dat is KRAP en niet onhaalbaar.
     Het verschil doet ertoe: onhaalbaar zegt "dit gaat niet", krap zegt "dit
     kan net, zonder één tegenvaller". Wie die twee door elkaar haalt, laat
     RTG een reservering verzetten die nog had gekund. Tien minuten later
     schuift hij wel over de grens, en dat staat er nu naast. */
  assert.equal(g.oordeelNa, UITKOMST.KRAP, 'na 65 minuten is de marge exact nul: krap');
  const harder = gevolg({ onderdelen: rij, kenmerk: 'V1', minuten: 75,
    reisTijd: vast(15), afstandM: verM(6000) });
  assert.equal(harder.oordeelNa, UITKOMST.ONHAALBAAR, 'na 75 minuten haalt het hotel het niet');
  assert.equal(g.regels.length, 2, 'per overgang een uitspraak');
  /* PER ONDERDEEL EEN UITSPRAAK, ook waar niets verandert: een lijst met alleen
     de problemen laat de reiziger raden of de rest wel goed ging. */
  const hotel = g.regels.find(r => r.titel === 'Hotel');
  const eten = g.regels.find(r => r.titel === 'Sal de Mar');
  assert.equal(hotel.geraakt, true);
  assert.equal(eten.geraakt, false);
  assert.match(eten.uitleg, /geen gevolg/i, 'wat niet geraakt is, zegt dat ook');
  /* HET VOORSTEL WORDT KLAARGEZET EN NOOIT UITGEVOERD. */
  assert.equal(hotel.voorstel.uitgevoerd, false);
  assert.equal(hotel.voorstel.bevestigt, 'een mens');
  assert.ok(hotel.voorstel.domein, 'en het zegt welk domein het moet doen');
  assert.ok(g.nietGewogen.length, 'en wat deze uitspraak niet dekt');
});

test('10. wat niet te bepalen is, wordt geen "geen gevolg"', () => {
  const rij = reisje().map((o, i) => i === 2 ? { ...o, plek: null } : o);
  const g = gevolg({ onderdelen: rij, kenmerk: 'V1', minuten: 65,
    reisTijd: vast(15), afstandM: verM(6000) });
  const laatste = g.regels[g.regels.length - 1];
  assert.equal(laatste.na, UITKOMST.NIET_TE_BEPALEN);
  assert.equal(laatste.geraakt, false, 'onbekend is geen geraakt');
  assert.match(laatste.uitleg, /niet te bepalen/i, 'en het heet ook niet "geen gevolg"');
  assert.equal(laatste.voorstel, null, 'over onbekend wordt niets klaargezet');
});

test('10b. de gevolgregel hangt aan het JUISTE onderdeel, ook door elkaar aangeleverd', () => {
  /* Gevonden op een volle ronde: `gevolg` las het onderdeel uit `rij[i + 1]`
     terwijl ./haalbaar chronologisch sorteert. De regel kreeg dan de naam van
     een ander onderdeel eronder -- een voorstel aan het verkeerde adres, en het
     ziet er volkomen geloofwaardig uit. */
  const op = reisje();
  const g1 = gevolg({ onderdelen: op, kenmerk: 'V1', minuten: 65, reisTijd: vast(15), afstandM: verM(6000) });
  const g2 = gevolg({ onderdelen: [op[2], op[0], op[1]], kenmerk: 'V1', minuten: 65,
    reisTijd: vast(15), afstandM: verM(6000) });
  assert.deepEqual(g2.regels.map(r => r.titel), g1.regels.map(r => r.titel),
    'de aanleveringsvolgorde mag niet bepalen welke naam onder een gevolg staat');
  /* En de titel hoort bij het onderdeel waar je NAARTOE gaat, want dat is wat
     de vertraging raakt. */
  assert.equal(g1.regels[0].titel, 'Hotel');
  assert.equal(g1.regels[1].titel, 'Sal de Mar');
});

test('10c. een echte boeking (soort "afspraak") krijgt wel een voorstel', () => {
  /* Een volle ronde met twee betaalde boekingen gaf `voorstel: null`, want de
     soort die een echte boeking oplevert -- `afspraak` -- stond niet in WIE.
     Juist het meest voorkomende geval had dus geen weg. */
  const rij = [
    { titel: 'Training', soort: 'afspraak', kenmerk: 'A1', plek: P(38.97, 1.41),
      nodigAt: T('2026-09-11', '10:00'), klaarAt: T('2026-09-11', '11:00') },
    { titel: 'Massage', soort: 'afspraak', kenmerk: 'A2', plek: P(38.98, 1.53),
      nodigAt: T('2026-09-11', '11:15'), klaarAt: null }
  ];
  const g = gevolg({ onderdelen: rij, kenmerk: 'A1', minuten: 30, reisTijd: vast(14), afstandM: verM(9000) });
  assert.equal(g.oordeelNa, UITKOMST.ONHAALBAAR);
  assert.ok(g.regels[0].voorstel, 'een afspraak hoort een domein te hebben dat hem kan verzetten');
  assert.equal(g.regels[0].voorstel.uitgevoerd, false);
  assert.equal(g.regels[0].zonderWeg, null);
});

test('11. een verschuiving vraagt een onderdeel en een aantal minuten', () => {
  const rij = reisje();
  assert.equal(gevolg({ onderdelen: rij, kenmerk: '', minuten: 65, reisTijd: vast(15) }).status, 400);
  assert.equal(gevolg({ onderdelen: rij, kenmerk: 'V1', minuten: 0, reisTijd: vast(15) }).status, 400);
  assert.equal(gevolg({ onderdelen: rij, kenmerk: 'BESTAAT-NIET', minuten: 65, reisTijd: vast(15) }).status, 404);
});

test('12. Move bezit niets: geen van de drie modules schrijft of leest opslag', () => {
  /* De grens die deze laag klein houdt, en die in de code moet staan en niet in
     een document: net als kern/reiswereld.js heeft Move geen eigen collectie.
     Zou hij die krijgen, dan is er een tweede reisadministratie. */
  const fs = require('fs'), path = require('path');
  for (const f of ['naad.js', 'haalbaar.js', 'gevolg.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'move', f), 'utf8');
    assert.doesNotMatch(bron, /db\.data|require\('fs'\)|save\(/,
      f + ' raakt opslag aan; dan is Move een administratie in plaats van een projectie');
  }
});
