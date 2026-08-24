/* HET VLOOTBEELD: zeven beweringen, en ze gaan allemaal over de manier waarop
   een leverancierdashboard meer belooft dan het weet.

   1. ÉÉN HOOFDINCIDENT, GEEN N MELDINGEN. Eén externe storing bij achthonderd
      klanten is één incident; achthonderd tickets is achthonderd keer hetzelfde
      uitzoeken.
   2. HOEVEEL ORGANISATIES ER IETS VAN MERKTEN, STAAT ER NIET. Dat is niet
      gemeten, en het aantal dat er wel staat is wat er BESTAAT.
   3. ER STAAT GEEN BESCHIKBAARHEIDSCIJFER PER ORGANISATIE. kern/tenant/bewijs.js
      weigert dat cijfer al aan de klant; het intern wel gebruiken zou betekenen
      dat wij een getal hanteren dat wij extern onwaar noemen.
   4. DE AFDALING HOUDT OP, en zegt dat. Een lege diepte leest als "er is niets";
      dit zegt "hier mag ik niet zonder uitnodiging".
   5. WAT DIT BEELD NIET KAN ZIEN, STAAT ERIN, met een reden per post.
   6. EEN BRON DIE OMVALT MAAKT HET BEELD NIET LEEG. Hij meldt zich, met de
      foutmelding erbij.
   7. EEN LOPENDE BIJSTANDSSESSIE STAAT BIJ DE ORGANISATIE. Dat is het enige wat
      dit beeld over de binnenkant zegt, en het is een feit over RTG en niet over
      de klant.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `geraakteOrganisaties` vervangen door een kaal aantal (`orgs.length`)
     -> "het geraakte aantal is een ondergrens" ZAKT (RAAK). Dit veld stond tot
        24 augustus op `null` omdat de meting geen tenant droeg; sindsdien draagt
        server/meting-tenant.js een ondergrens, en de toets bewaakt nu dat het een
        ondergrens BLIJFT en geen kaal getal wordt.
   - NIET_TE_ZIEN leeggemaakt
     -> "wat dit beeld niet kan zien, staat erin" ZAKT (RAAK)
   - `dieper.mag` op true gezet
     -> "de afdaling houdt op" ZAKT (RAAK)
   - de veilig()-vangnet uit organisaties() gehaald
     -> "een bron die omvalt maakt het beeld niet leeg" ZAKT (RAAK)
   - de hoofdincidentlijst per organisatie uitvouwen
     -> "een hoofdincident, geen N meldingen" ZAKT (RAAK)
   - organisatie() een onbekende org weer als 503 laten melden
     -> "de afdaling houdt op" ZAKT (RAAK). Dat was een echte fout, gevonden door
        deze toets: `veilig()` geeft ook bij een LEGE waarde `nietTeLezen`, dus
        "die organisatie bestaat niet" en "het register is stuk" kwamen als
        hetzelfde antwoord terug -- en die twee vragen om iets heel anders van de
        lezer.

   Draai los: node --test test/vlootbeeld.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const { maakVlootbeeld } = require('../server/kern/command/vlootbeeld');

const ORGS = [
  { org: 'HOSHI', naam: 'Hoshi Group', modus: 'powered', actief: true, werkruimtes: 2, zaken: 1, groepen: 1, merk: false, bij: '2026-08-01T00:00:00.000Z' },
  { org: 'MARINA', naam: 'Marina BV', modus: 'private', actief: true, werkruimtes: 1, zaken: 0, groepen: 0, merk: true, bij: '2026-08-02T00:00:00.000Z' },
  { org: 'OUD', naam: 'Oud & Co', modus: 'powered', actief: false, werkruimtes: 0, zaken: 0, groepen: 0, merk: false, bij: '2026-07-01T00:00:00.000Z' }
];

function opstelling(o) {
  const opt = o || {};
  const tenant = {
    register: {
      lijst: opt.lijstStuk ? () => { throw new Error('het register is stuk'); } : () => ORGS,
      /* De LIJST telt (getallen), `haal` geeft de rijen zelf (codes). Dat is
         hoe kern/tenant/register.js het ook doet -- en de volgorde van deze
         Object.assign is niet vrijblijvend: andersom overschrijft het getal uit
         de lijst de codelijst, en dan valt dit om op `.slice`. */
      haal: (x) => {
        const t = ORGS.find(r => r.org === String(x));
        return t ? Object.assign({}, t,
          { werkruimtes: ['W-1', 'W-2'], zaken: ['LEV-9'], groepen: [{ groep: 'g' }] }) : null;
      }
    },
    levensloop: { stand: () => ({ toestand: 'in gebruik' }) },
    bewijs: { stand: () => ({ beweringen: [{ wat: 'SLA', mag: false, waarom: 'geen terugzetproef' }] }) }
  };
  const incident = { lijst: () => (opt.incidenten || []) };
  const bijstand = { lijst: (f) => (opt.sessies || []).filter(s => !f || !f.org || s.org === f.org) };
  const gezondheid = { stand: () => ({ oordeel: 'storing', tel: { storing: 1 },
    vermogens: [{ id: 'betalen', naam: 'Betalen', oordeel: 'storing' },
      { id: 'sporen', naam: 'De sporen', oordeel: 'in orde' }] }) };
  return maakVlootbeeld({ tenant, incident, bijstand, gezondheid });
}

const INC = [{ id: 'RTG-0001', vermogen: 'betalen', naam: 'Betalen', wat: 'Er is iets mis met betalen.',
  status: 'open', begonnen: '2026-08-24T10:00:00.000Z', eigenaar: null }];

test('1. een hoofdincident, geen N meldingen, en 2. het geraakte aantal staat er niet', () => {
  const v = opstelling({ incidenten: INC }).beeld();
  assert.equal(v.hoofdincidenten.length, 1, 'er staat niet precies één hoofdincident');
  assert.equal(v.tel.hoofdincidenten, 1);
  const h = v.hoofdincidenten[0];
  assert.equal(h.organisatiesInDeVloot, 3, 'het aantal organisaties in de vloot klopt niet');
  /* `geraakteOrganisaties` is een ONDERGRENS en nooit een kaal getal. Het veld
     heet `organisatiesMinstens`, draagt zijn eigen `let` mee, en zegt `gemeten:
     false` met een reden als er niets is toegewezen. Een kaal `aantal` hier zou
     op een vlootscherm binnen een week gelezen worden als het aantal klanten
     dat belde. */
  const g = h.geraakteOrganisaties;
  assert.ok(g && typeof g === 'object', 'het geraakte aantal is geen object met zijn grens erbij');
  assert.equal(g.aantal, undefined, 'er staat een kaal "aantal" waar een ondergrens hoort');
  assert.equal(typeof g.gemeten, 'boolean');
  if (g.gemeten) {
    assert.equal(typeof g.organisatiesMinstens, 'number');
    assert.match(g.let, /ONDERGRENS/, g.let);
  } else {
    assert.ok(g.waarom && g.waarom.length > 20, 'niet gemeten zonder reden: ' + JSON.stringify(g));
  }
  assert.match(h.let, /ÉÉN incident en geen 3 meldingen/);
  assert.match(h.let, /ONDERGRENS en geen aantal/);
});

test('3. er staat geen beschikbaarheidscijfer per organisatie', () => {
  const v = opstelling({ incidenten: INC }).beeld();
  const tekst = JSON.stringify(v);
  assert.ok(!/beschikbaarheidPerOrg|uptimePerOrg|"beschikbaarheid":\s*\d/.test(tekst),
    'er staat een beschikbaarheidsgetal per organisatie in het beeld');
  const namen = v.nietTeZien.map(n => n.wat).join(' ');
  assert.match(namen, /beschikbaarheidscijfer per organisatie/,
    'het ontbreken van dat cijfer wordt niet uitgelegd');
  /* En het PLATFORM-oordeel staat er wel: dat gaat over ons en niet over hen. */
  assert.equal(v.platform.oordeel, 'storing');
  assert.deepEqual(v.platform.stuk.map(x => x.id), ['betalen']);
});

test('4. de afdaling houdt op, en zegt dat', () => {
  const o = opstelling({}).organisatie('HOSHI');
  assert.equal(o.org, 'HOSHI');
  assert.deepEqual(o.werkruimtes, ['W-1', 'W-2'], 'de werkruimtecodes horen structuur te zijn');
  assert.equal(o.dieper.mag, false, 'het vlootbeeld kijkt dieper dan de uitnodiging');
  assert.match(o.dieper.waarom, /bijstandssessie/);
  assert.match(o.dieper.waarom, /geen stand waarin RTG zichzelf die toegang geeft/);
  assert.ok(o.dieper.hoe && o.dieper.hoe.length > 30, 'er staat niet bij hoe je dan wel verder komt');
  assert.equal(opstelling({}).organisatie('BESTAATNIET').status, 404);
});

test('5. wat dit beeld niet kan zien, staat erin', () => {
  const v = opstelling({}).beeld();
  const o = opstelling({}).organisatie('HOSHI');
  for (const d of [v, o]) {
    assert.ok(d.nietTeZien.length >= 3, 'de lijst met wat er niet te zien is ontbreekt');
    for (const n of d.nietTeZien) assert.ok(n.waarom && n.waarom.length > 40, n.wat + ' heeft geen reden');
  }
});

test('6. een bron die omvalt maakt het beeld niet leeg', () => {
  const v = opstelling({ lijstStuk: true, incidenten: INC }).beeld();
  assert.equal(v.tel.organisaties, 0);
  assert.match(v.organisatieFout, /het register is stuk/, 'de reden staat er niet bij');
  /* En de rest van het beeld staat er gewoon: één stukke bron maakt geen leeg
     scherm, want dan is er niets meer te zien op precies de dag dat het telt. */
  assert.equal(v.platform.oordeel, 'storing');
  assert.equal(v.hoofdincidenten.length, 1);
  assert.ok(v.nietTeZien.length >= 3);
});

test('7. een lopende bijstandssessie staat bij de organisatie', () => {
  const sessie = { id: 'BIJ-AB12', org: 'MARINA', status: 'bezig', niveau: 'herstellen',
    medewerker: 'Amira', tot: '2026-08-24T13:00:00.000Z' };
  const v = opstelling({ sessies: [sessie] }).beeld();
  assert.equal(v.tel.metBijstand, 1);
  const marina = v.organisaties.find(o => o.org === 'MARINA');
  assert.equal(marina.bijstand.id, 'BIJ-AB12');
  assert.equal(v.organisaties.find(o => o.org === 'HOSHI').bijstand, null);
  /* En op het organisatiescherm staan de sessies van DIE organisatie. */
  const o = opstelling({ sessies: [sessie] }).organisatie('MARINA');
  assert.equal(o.sessies.length, 1);
  assert.equal(opstelling({ sessies: [sessie] }).organisatie('HOSHI').sessies.length, 0);
});
