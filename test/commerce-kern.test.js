/* DE COMMERCE-KERN -- vermogens, koopbaar, afrekening.

   WAT HIER WORDT VASTGEHOUDEN. Deze laag bestaat omdat COMMERCE.json een
   voorstel weersprak: een Koopbaar-protocol met acht verplichte werkwoorden
   bestaat niet in deze code (0 van 99 domeinen voert ze alle acht uit). De
   vervanging is een VERKLARING van vermogens. Die vervanging is alleen iets
   waard zolang drie dingen blijven kloppen, en dat zijn de drie zwaarste toetsen
   hieronder:

     4. `bevestig` hangt NIET aan `prijs`. Dat deed hij in de eerste opzet, en
        de meting sloeg het eruit: 25 domeinen bevestigen zonder prijs. Een tafel
        en een bezichtiging kosten niets. Zet iemand die afhankelijkheid terug,
        dan verdwijnt de tafel uit de mand en niemand ziet waarom.
     8. de prijs komt NOOIT uit de browser, en een meegestuurd bedrag wordt
        GEMELD in plaats van stil genegeerd.
    10. er komt geen gezamenlijke bevestiging uit. Dat is de grens uit
        kern/mall/bestellingen.js: achter die regels zitten verschillende
        partijen met verschillende bevestigingen.

   Draai los: node --test test/commerce-kern.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const V = require('../server/kern/commerce/vermogens');
const K = require('../server/kern/commerce/koopbaar');
const maakAfrekening = require('../server/kern/commerce/afrekening');
const tarief = require('../server/kern/fiscaal/tarief');
const { TYPEN } = require('../server/kern/mall/aanbodvorm');

/* Een afrekening met twee verzonnen zaken: een Nederlandse kledingwinkel
   (standaardtarief) en een Spaans restaurant (verlaagd tarief, ander land). Die
   twee moeten verschillende btw opleveren -- anders leest deze toets een tabel
   die niet meebeweegt met kern/fiscaal. */
const ZAKEN = {
  MODE: { code: 'MODE', type: 'retail', settings: { land: 'NL' } },
  REST: { code: 'REST', type: 'restaurant', settings: { land: 'NL' } },
  IBZ: { code: 'IBZ', type: 'restaurant', settings: { land: 'ES' } }
};
const rekenaar = maakAfrekening({
  tariefVan: tarief.tariefVan, basisCat: tarief.basisCat,
  zaakVan: (c) => ZAKEN[c] || null, capsVan: () => []
});

/* DE PRIJSVORM IS DIE VAN kern/mall/aanbod.js REGEL 118 en niet een eigen
   verzinsel: { bedrag (EURO'S), eenheid, valuta, vanaf (VLAG) }. Deze toets
   gebruikte eerst `{ centen: 1000 }` -- een vorm die daar niet bestaat -- en
   dekte daarmee precies de twee fouten af die de laag werkelijk had: euro's
   gelezen als centen, en de vlag `vanaf` gelezen als bedrag. Een fixture die
   afwijkt van de bron toetst de fixture. */
const eur = (bedrag, vanaf) => ({ bedrag, eenheid: 'per stuk', valuta: 'EUR', vanaf: !!vanaf });
const rij = (o) => Object.assign({
  id: 'x1', bron: 'proef', type: 'product', titel: 'Ding',
  aanbieder: { soort: 'zaak', code: 'MODE', naam: 'Atelier' },
  prijs: eur(10), beschikbaar: { voorraad: 5 }, bezorgt: true
}, o);
const koopbaar = (o) => K.vanAanbod(rij(o));

test('1. verklaar voegt vereiste vermogens toe, ook over twee stappen', () => {
  const r = V.verklaar(['retour']);
  assert.ok(r.heeft.includes('bevestig'), 'retour vereist bevestig');
  assert.ok(r.heeft.includes('toon'), 'toon staat er altijd bij');
  assert.deepEqual(r.geweigerd, []);
});

test('2. zonder haalt weg wat op een weggevallen vermogen leunde', () => {
  const vol = V.verklaar(['prijs', 'beschikbaarheid', 'bevestig', 'lever', 'annuleer', 'retour']).heeft;
  const na = V.zonder(vol, ['bevestig']);
  for (const id of ['lever', 'annuleer', 'retour']) {
    assert.ok(!na.heeft.includes(id), id + ' hangt aan bevestig en hoort mee te vallen');
  }
  assert.ok(na.heeft.includes('prijs'), 'prijs hangt nergens aan en blijft staan');
  assert.ok(na.weg.some(w => w.vermogen === 'lever' && w.door === 'bevestig'), 'met de aanleiding erbij');
});

test('3. een onbekend vermogen verdwijnt niet stil maar met een reden', () => {
  const r = V.verklaar(['prijs', 'verhuur']);
  assert.ok(!r.heeft.includes('verhuur'));
  assert.equal(r.geweigerd.length, 1);
  assert.match(r.geweigerd[0].reden, /bestaat niet/);
  // en een naam die met opzet niet bestaat, krijgt ZIJN eigen reden
  const ruil = V.verklaar(['ruil']);
  assert.match(ruil.geweigerd[0].reden, /retour en een nieuwe koop/);
});

test('4. bevestig hangt NIET aan prijs -- 25 domeinen bevestigen zonder bedrag', () => {
  const r = V.verklaar(['bevestig']);
  assert.ok(!r.heeft.includes('prijs'),
    'COMMERCE.json: 25 domeinen bevestigen zonder prijs; een tafel kost niets');
  // en de vier die WEL overbleven, staan er nog
  assert.ok(V.verklaar(['reserveer']).heeft.includes('beschikbaarheid'));
  for (const v of ['lever', 'annuleer', 'retour']) {
    assert.ok(V.verklaar([v]).heeft.includes('bevestig'), v + ' vereist bevestig');
  }
});

test('5. elk aanbodtype uit aanbodvorm.js heeft hier een regel', () => {
  assert.deepEqual(K.typenZonderRegel(), [],
    'een nieuw type in aanbodvorm.js hoort een vermogensregel te krijgen');
  assert.equal(Object.keys(K.TYPE_VERMOGENS).length, Object.keys(TYPEN).length);
});

test('6. het type belooft, de rij maakt waar', () => {
  const heel = koopbaar({});
  assert.ok(heel.vermogens.includes('bevestig') && heel.vermogens.includes('retour'));

  // een PRODUCT belooft "Kopen": zonder bedrag valt de koopknop weg
  const zonderPrijs = koopbaar({ prijs: null });
  assert.ok(!zonderPrijs.vermogens.includes('bevestig'));
  assert.match(zonderPrijs.ontbreekt.find(o => o.vermogen === 'bevestig').reden, /Kopen/);

  // een BOEKING belooft "Reserveren": zonder bedrag blijft de bevestiging staan
  const tafel = koopbaar({ type: 'boeking', prijs: null, bezorgt: false });
  assert.ok(tafel.vermogens.includes('bevestig'), 'een tafel bevestig je zonder te betalen');
  assert.ok(tafel.vermogens.includes('reserveer'));
});

test('7. geen bezorging is geen levering, en de reden staat erbij', () => {
  const k = koopbaar({ bezorgt: false });
  assert.ok(!k.vermogens.includes('lever'));
  assert.ok(k.vermogens.includes('bevestig'), 'niet kunnen bezorgen is geen reden om niet te kunnen kopen');
  assert.match(k.ontbreekt.find(o => o.vermogen === 'lever').reden, /bezorging of afhaal/);
  // een ticket levert zichzelf
  assert.ok(koopbaar({ type: 'ticket', bezorgt: false }).vermogens.includes('lever'));
});

test('8. de prijs komt nooit uit de browser, en dat wordt gemeld', () => {
  const kat = { a: koopbaar({ id: 'a', prijs: eur(10) }) };
  const r = rekenaar.reken([{ koopbaarId: 'a', aantal: 2, centen: 1 }], (id) => kat[id] || null);
  assert.equal(r.afrekeningen[0].totaalCenten, 2000, 'het bedrag van de server telt, niet dat van de client');
  assert.match(r.genegeerd, /niet gebruikt/,
    'stil negeren laat een integrator in de waan (LAT-regel 5)');
});

test('9. de btw komt uit kern/fiscaal en verschilt per zaak en per land', () => {
  const bij = (code, type) => {
    const kat = { a: K.vanAanbod(rij({ id: 'a', type, aanbieder: { soort: 'zaak', code, naam: code }, prijs: eur(100) })) };
    return rekenaar.reken([{ koopbaarId: 'a', aantal: 1 }], (id) => kat[id] || null).afrekeningen[0];
  };
  const kleding = bij('MODE', 'product');
  const etenNL = bij('REST', 'eten');
  const etenES = bij('IBZ', 'eten');
  assert.equal(kleding.btw.tariefProcent, 21, 'een jas is geen eten');
  assert.equal(etenNL.btw.tariefProcent, 9);
  assert.notEqual(etenES.btw.tariefProcent, etenNL.btw.tariefProcent,
    'dezelfde maaltijd op Ibiza valt onder een ander tarief -- zie de kop van kern/fiscaal/tarief.js');
  // inclusief, niet erbovenop
  assert.equal(kleding.totaalCenten, 10000);
  assert.equal(kleding.btw.btwCenten + kleding.btw.nettoCenten, 10000);
});

test('10. een mand over twee verkopers levert twee afrekeningen en GEEN samenknop', () => {
  const kat = {
    jas: K.vanAanbod(rij({ id: 'jas', titel: 'Jas', aanbieder: { soort: 'zaak', code: 'MODE', naam: 'Atelier' } })),
    wijn: K.vanAanbod(rij({ id: 'wijn', titel: 'Wijn', type: 'eten', aanbieder: { soort: 'zaak', code: 'REST', naam: 'Sal' } }))
  };
  const r = rekenaar.reken([{ koopbaarId: 'jas', aantal: 1 }, { koopbaarId: 'wijn', aantal: 1 }], (id) => kat[id] || null);
  assert.equal(r.afrekeningen.length, 2);
  assert.equal(r.samenBevestigen, false,
    'kern/mall/bestellingen.js weigert "betaal alles" met reden; die grens blijft');
  assert.match(r.samenReden, /RTG bevestigt niets namens hen/);
  assert.equal(r.toonTotaalCenten, 2000, 'een optelsom om te TONEN mag wel');
});

test('11. een gratis bevestiging is een regel van nul, geen weigering', () => {
  const kat = { t: koopbaar({ id: 't', titel: 'Tafel', type: 'boeking', prijs: null, bezorgt: false }) };
  const r = rekenaar.reken([{ koopbaarId: 't', aantal: 1 }], (id) => kat[id] || null);
  assert.equal(r.geweigerd.length, 0, 'anders valt de tafel alsnog uit de mand, een laag lager');
  assert.equal(r.afrekeningen[0].regels[0].gratis, true);
  assert.equal(r.afrekeningen[0].totaalCenten, 0);
});

test('12. wat niet bevestigd kan worden, valt eruit MET de reden', () => {
  const kat = { m: koopbaar({ id: 'm', titel: 'Advertentie', type: 'marktplaats', prijs: null, bezorgt: false }) };
  const r = rekenaar.reken([{ koopbaarId: 'm', aantal: 1 }, { koopbaarId: 'weg', aantal: 1 }], (id) => kat[id] || null);
  assert.equal(r.afrekeningen.length, 0);
  assert.equal(r.geweigerd.length, 2);
  assert.ok(r.geweigerd.every(g => g.reden && g.reden.length > 10), 'elke weigering draagt een leesbare reden');
});

test('13. te weinig voorraad blokkeert de afrekening, maar stilte niet', () => {
  const kat = {
    op: koopbaar({ id: 'op', titel: 'Laatste', beschikbaar: { voorraad: 1 } }),
    stil: koopbaar({ id: 'stil', titel: 'Ongemeten', beschikbaar: null, open: true })
  };
  const r = rekenaar.reken([{ koopbaarId: 'op', aantal: 3 }], (id) => kat[id] || null);
  assert.equal(r.afrekeningen[0].bevestigbaar, false);
  assert.match(r.afrekeningen[0].blokkades[0].reden, /nog 1 van/);

  const s = rekenaar.reken([{ koopbaarId: 'stil', aantal: 3 }], (id) => kat[id] || null);
  assert.equal(s.afrekeningen[0].bevestigbaar, true,
    'een bron die niets meet, zegt niet "op" -- dat is de spiegelfout van stilte als beschikbaar lezen');
});

test('14. bedrag staat in EURO\'S en wordt niet als centen gelezen', () => {
  /* De fout die pas bovenkwam op echte seed-data: een reis van 2200 euro werd
     2200 centen, dus 22,00 op het scherm. Honderd keer te weinig, en niets aan
     de uitkomst zag er kapot uit. kern/mall/aanbod.js regel 118 is de bron. */
  assert.equal(K.vastBedragCenten({ bedrag: 2200, valuta: 'EUR', vanaf: false }), 220000);
  assert.equal(K.vastBedragCenten({ bedrag: 0, valuta: 'EUR', vanaf: false }), 0, 'nul is gratis, niet onbekend');

  const kat = { a: koopbaar({ id: 'a', prijs: eur(2200) }) };
  const r = rekenaar.reken([{ koopbaarId: 'a', aantal: 1 }], (id) => kat[id] || null);
  assert.equal(r.afrekeningen[0].totaalCenten, 220000, 'tweeduizendtweehonderd euro, niet tweeentwintig');
});

test('15. op een VANAF-prijs wordt niet afgerekend', () => {
  /* `vanaf` is een vlag en geen bedrag -- hij stond in de kandidatenlijst, dus
     Number(true) gaf 1 cent. En inhoudelijk: "vanaf 2200 per persoon" is een
     indicatie voor een reis waarvan de prijs van de datum afhangt. Wie daarop
     afrekent, incasseert een bedrag dat niemand heeft afgesproken. */
  assert.equal(K.vastBedragCenten({ bedrag: 2200, valuta: 'EUR', vanaf: true }), null);

  const k = koopbaar({ id: 'v', type: 'reis', prijs: eur(2200, true), bezorgt: false });
  assert.ok(!k.vermogens.includes('prijs'), 'een indicatie is geen prijs-vermogen');
  assert.ok(!k.vermogens.includes('bevestig'), 'en dus geen koopknop bij een type dat "Kopen" belooft');
  assert.match(k.ontbreekt.find(o => o.vermogen === 'prijs').reden, /vanaf-prijs/,
    'de ondernemer hoort te horen welke van de twee het is');
  // maar hij mag wel getoond worden, met de indicatie erbij
  assert.ok(k.vermogens.includes('toon'));
  assert.equal(k.prijs.bedrag, 2200);
});

test('16. waarom iets niet te koop staat, kent twee heel verschillende antwoorden', () => {
  /* Voor een ondernemer is dit het verschil tussen "er is iets te doen" en "er
     is niets aan de hand". Beide als "niet te koop" tonen kost een half uur
     zoeken naar een instelling die niet bestaat. */
  const offerte = koopbaar({ type: 'offerte', prijs: null, bezorgt: false, beschikbaar: null, open: null });
  assert.match(K.waaromNietTeKoop(offerte), /Offerte aanvragen/);
  assert.match(K.waaromNietTeKoop(offerte), /niets aan mis/);
  // en niet "een op aanvraag": het label is een kop, geen zelfstandig naamwoord
  assert.ok(!/is een op aanvraag/i.test(K.waaromNietTeKoop(offerte)));

  const stuk = koopbaar({ prijs: null });   // product dat "Kopen" belooft en geen bedrag heeft
  assert.match(K.waaromNietTeKoop(stuk), /Zet een prijs/, 'hier is wel iets te doen');

  assert.equal(K.waaromNietTeKoop(koopbaar({})), null, 'wat wel te koop staat, heeft geen reden');
});
