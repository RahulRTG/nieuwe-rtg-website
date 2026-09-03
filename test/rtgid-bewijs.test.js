/* ============================================================================
   DE BEWIJSMAP: EEN VINKJE DE DEUR UIT, DE REDEN ALLEEN VOOR UZELF

   HDI.md par. 2 stelde een `bewijsmap` voor. Bij het nameten bleek er geen
   bewijsmap te ONTBREKEN -- kern/vakbewijs.js houdt de stukken al bij, met een
   aftekening door een mens en een geldigheid die bij elke vraag opnieuw wordt
   gerekend. Wat ontbrak is dat een LID er zelf niets mee kon: vakbewijs werd
   alleen gelezen door kern/persoonseis.js, voor de vraag of iemand ergens mag
   werken. kern/rtgid-bewijs.js is de brug, en dit bestand is waar hij kan zakken.

   ACHT ZINNEN:

     1. een dienst krijgt een VINKJE, en nooit het nummer;
     2. een dienst krijgt geen LIJST stukken -- alleen antwoord op wat hij vroeg;
     3. bij `false` gaat er GEEN datum en GEEN reden mee: het verschil tussen
        "nooit gehad" en "verlopen" verraadt dat iemand het ooit had;
     4. bij `true` gaat de einddatum WEL mee, want een dienst die iemand voor een
        half jaar inhuurt hoort te weten dat het bewijs over een maand verloopt;
     5. `null` is geen `false` -- zonder bron is het NIET NA TE GAAN, en een
        dienst die "nee" leest waar dat hoort te staan, weigert een mens op een
        storing (BESTUUR.md: `niet vast te stellen` is een eersteklas uitslag);
     6. het LID ziet wel de reden, in gewone taal, over zichzelf;
     7. de eisenlijst wordt AFGELEID uit kern/persoonseis-lijst.js en niet hier
        overgetypt (LAT.md regel 4);
     8. een eis die niet bestaat wordt geweigerd en niet stil genegeerd.

   MET EEN MUTATIE NAGETROKKEN (LAT.md regel 2):
     - het nummer meegeven in de claim: RAAK op 1;
     - alle eisen beantwoorden in plaats van de gevraagde: RAAK op 2;
     - de reden meegeven bij `false`: RAAK op 3;
     - de einddatum weglaten bij `true`: RAAK op 4;
     - `null` als `false` teruggeven zonder bron: RAAK op 5;
     - de reden weglaten in mijnBewijzen: RAAK op 6;
     - een eigen eisenlijst hardcoderen: RAAK op 7;
     - een onbekende eis toch beantwoorden: RAAK op 8.

   EEN MUTATIE ZAT ER EERST NAAST, EN DAT IS IETS ANDERS DAN EEN GAT. De tweede
   ("alle eisen beantwoorden") werd eerst op de NEE-tak gezet, terwijl toets 2
   een eis gebruikt die wel geldig is en dus door de JA-tak loopt. Hij bleef
   groen, en de verleiding is dan om de toets te verbreden. Dat zou hier fout
   zijn geweest: op de juiste tak gezet bijt hij meteen. Een mutatie die niets
   raakt, is eerst een vraag over de mutatie en pas daarna over de toets.

   ZONDER SERVER, met een nagebouwde vakbewijsbron. Dat kan omdat deze laag
   niets opslaat: hij leest een bron en projecteert. Zo is precies het enige dat
   hier toe doet -- WAT er de deur uit gaat -- te toetsen zonder database.

   Draai los: node --test test/rtgid-bewijs.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakBewijs = require('../server/kern/rtgid-bewijs');
const { SOORTEN } = require('../server/kern/persoonseis-lijst');

const LID = { id: 7, verified: 'verified' };

/* Een nagebouwde vakbewijsbron. `stukken` is per soort wat vakbewijsHeeft zou
   antwoorden -- dezelfde vorm als kern/vakbewijs.js teruggeeft, inclusief het
   NUMMER, want juist dat mag er niet uit komen. */
function bron(stukken) {
  return {
    sleutelLid: (id) => 'lid:' + id,
    vakbewijsHeeft: (sleutel, wat) => {
      if (sleutel !== 'lid:7') return { ok: false, reden: 'geen-persoon' };
      const s = stukken[wat];
      if (!s) return { ok: false, reden: 'ontbreekt' };
      if (s.reden) return { ok: false, reden: s.reden, tot: s.tot || null };
      return { ok: true, vakbewijs: { wat, tot: s.tot || null, nummer: 'BIG-99887766', afgetekend: true } };
    }
  };
}
const maak = (stukken) => maakBewijs({
  accountVanKey: () => LID,
  vakbewijsBron: () => (stukken === null ? null : bron(stukken))
});

test('1. een dienst krijgt een vinkje, en nooit het nummer', () => {
  const b = maak({ big: { tot: '2027-01-01' } });
  const r = b.voldoetAan('k', 'big');
  assert.equal(r.voldoet, true);
  const heel = JSON.stringify(r);
  assert.ok(!/BIG-99887766/.test(heel),
    'het registratienummer hoort de claim nooit te verlaten: het staat in een OPENBAAR register en ' +
    'voert een codenaam terug naar een echte naam');
  assert.ok(!/nummer/i.test(heel), 'ook het veld zelf hoort er niet in te zitten');
});

test('2. een dienst krijgt geen lijst stukken', () => {
  const b = maak({ big: { tot: '2027-01-01' }, vog: { tot: '2028-01-01' } });
  const r = b.voldoetAan('k', 'vog');
  assert.equal(r.soort, 'vog');
  assert.ok(!('big' in r), 'een vraag over de VOG hoort niets over de BIG-registratie terug te geven');
  const heel = JSON.stringify(r);
  assert.ok(!/big/.test(heel), 'twee diensten die elk netjes vragen, weten samen te veel zodra ze lijsten krijgen');
});

test('3. bij false gaat er geen datum en geen reden mee', () => {
  const b = maak({ vog: { reden: 'verlopen', tot: '2024-01-01' } });
  const r = b.voldoetAan('k', 'vog');
  assert.equal(r.voldoet, false);
  assert.equal(r.tot, null,
    'een einddatum bij een NEE verraadt dat deze mens het stuk ooit had');
  assert.equal(r.reden, null,
    'en de reden ook: "verlopen" is iets anders dan "nooit gehad", en dat verschil is niet van de dienst');
});

test('4. bij true gaat de einddatum wel mee', () => {
  const b = maak({ vog: { tot: '2027-06-30' } });
  const r = b.voldoetAan('k', 'vog');
  assert.equal(r.voldoet, true);
  assert.equal(r.tot, '2027-06-30',
    'een dienst die iemand voor een half jaar inhuurt hoort te weten dat het bewijs eerder verloopt');
});

test('5. null is geen false', () => {
  const zonder = maak(null);
  const r = zonder.voldoetAan('k', 'vog');
  assert.equal(r.voldoet, null,
    'zonder bron is het NIET NA TE GAAN; wie hier false teruggeeft, laat een dienst een mens weigeren op een storing');
  assert.equal(r.reden, 'geen-bron');
  assert.notEqual(r.voldoet, false, 'en null hoort nadrukkelijk niet gelijk te staan aan nee');

  // ook zonder account: niet na te gaan, geen nee
  const geenAccount = maakBewijs({ accountVanKey: () => null, vakbewijsBron: () => bron({}) });
  assert.equal(geenAccount.voldoetAan('k', 'vog').voldoet, null);
});

test('6. het lid ziet wel de reden, over zichzelf', () => {
  const b = maak({ vog: { reden: 'niet-gezien' }, big: { tot: '2027-01-01' } });
  const mijn = b.mijnBewijzen('k');
  assert.equal(mijn.bron, true);
  const vog = mijn.eisen.find(e => e.soort === 'vog');
  assert.equal(vog.voldoet, false);
  assert.match(vog.reden, /nog niet gezien/i,
    'over uzelf hoort er te staan WAAROM iets niet meetelt; anders kunt u er niets aan doen');
  assert.ok(vog.naam && vog.naam.length > 3, 'en de eis hoort een leesbare naam te dragen');

  const big = mijn.eisen.find(e => e.soort === 'big');
  assert.equal(big.voldoet, true);
  assert.equal(big.reden, null, 'bij een geldig stuk hoort geen reden te staan');

  // en ook op MIJN eigen scherm staat het nummer niet
  assert.ok(!/BIG-99887766/.test(JSON.stringify(mijn)),
    'het nummer woont in de identiteitskluis en wordt daar apart opgevraagd, met een reden en een auditregel');

  // zonder bron: eerlijk, en niet een lege lijst die als "u heeft niets" leest
  const zonder = maak(null).mijnBewijzen('k');
  assert.equal(zonder.bron, false);
  assert.match(zonder.uitleg, /niet dat u niets heeft/);
});

test('7. de eisenlijst wordt afgeleid en niet overgetypt', () => {
  assert.deepEqual(maakBewijs.EISEN, Object.keys(SOORTEN),
    'de eisen horen uit kern/persoonseis-lijst.js te komen; een tweede lijst loopt binnen een jaar uiteen');
  assert.ok(maakBewijs.EISEN.length >= 5, 'en er horen er meer dan een handvol te zijn');
});

test('8. een onbekende eis wordt geweigerd en niet stil genegeerd', () => {
  const b = maak({ vog: { tot: '2027-01-01' } });
  const r = b.voldoetAan('k', 'bestaatniet');
  assert.equal(r.voldoet, null, 'een eis die niet bestaat hoort geen ja en geen nee op te leveren');
  assert.equal(r.reden, 'onbekende-eis');

  // en het attribuut-voorvoegsel laat hem er niet in
  assert.equal(maakBewijs.isBewijsAttribuut('bewijs:vog'), true);
  assert.equal(maakBewijs.isBewijsAttribuut('bewijs:bestaatniet'), false,
    'een typefout in de eis hoort te worden geweigerd; anders is hij precies zo goed als geen eis');
  assert.equal(maakBewijs.isBewijsAttribuut('naam'), false, 'een gewoon attribuut is geen bewijs');
});
