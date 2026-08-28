/* MAGNAAT STELT ZIJN GELDPOMPVRAAG AAN RTG PAY.

   `MAGNAATLAB.md` par. 5.1 vraagt fase 2: laat de geldpompmeter zijn vraag
   stellen aan de RTG-keten in plaats van aan de spelbank. Die keten staat in
   `server/kern/spellen/magnaat/rtg-keten.js` -- in de Magnaat-wereld, want het
   is Magnaats vraag -- en loopt over de simulatiebank, de betaalnaad, kern/pay
   en de echte waardepoort.

   DIT BESTAND BEWAAKT VIJF DINGEN, en het vijfde is het belangrijkste:

     1. De keten DRAAIT, en elk pompscenario laat het totaal exact gelijk. Niet
        binnen een marge -- een overdracht is een overdracht.
     2. De sluitcontrole blijft kloppen: som exact nul, geen rode ledenrekening.
     3. De simulatiebank WEIGERT onderweg. Dat is geen ruis maar bewijs dat er
        een rail met scenario's onder ligt en geen altijd-ja. Zonder die regel
        zou deze toets ook groen blijven op een demo-provider, en dan meet hij
        niets van wat er nieuw is.
     4. ELK SCENARIO DOET WERKELIJK IETS. Een overdracht tussen spelers laat de
        som per definitie gelijk, dus punt 1 kan een scenario dat niets doet niet
        onderscheiden van een dat werkt. Dat is hier ECHT misgegaan; toets 3 pint
        daarom het aantal grootboekregels per scenario vast.
     5. HET SPEL LAADT kern/pay NIET. Dit is een proefstuk en geen koppeling:
        geen enkele speelbeurt hoort langs RTG Pay te komen. Zakt toets 7, dan
        is de simulatielaag aan de betaallaag vast komen te zitten, en dat is
        precies het soort verbinding dat je niet per ongeluk wilt maken.

   DE TWEE TEGENPROEVEN (toets 4 en 6) zijn nodig omdat "verschil is nul" ook de
   uitslag is van een meter die altijd nul zegt. De ene laat keur() een fout zien
   en eist dat hij klaagt; de andere laat de telling een verandering zien die er
   WEL is en eist dat zij meebeweegt.

   Draai los: RTG_SIMULATIEBANK=1 node --test test/magnaat-rtgketen.test.js */
'use strict';
/* VOOR de require van server/betaal: die leest de omgeving eenmalig bij het
   laden, en zonder deze vlag staat de rail fail-closed. */
process.env.RTG_SIMULATIEBANK = '1';
delete process.env.STRIPE_SECRET_KEY;
delete process.env.MOLLIE_API_KEY;
delete process.env.ADYEN_API_KEY;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const betaal = require('../server/betaal');
const maakKeten = require('../server/kern/spellen/magnaat/rtg-keten');

const WORTEL = path.join(__dirname, '..');
const keten = maakKeten({ betaal, crypto });

test('1. de keten draait op de simulatiebank en niet op iets anders', () => {
  assert.equal(betaal.AANBIEDER, 'simulatie',
    'de rail is de simulatiebank (nu: ' + betaal.AANBIEDER + ')');
  assert.equal(betaal.SIMULATIE_AAN, true);
});

test('2. geen enkel pompscenario maakt waarde uit het niets', async () => {
  const { rijen, klachten } = await keten.keur();
  assert.ok(rijen.length >= 5, 'alle scenario\'s zijn gedraaid, nu: ' + rijen.length);
  for (const r of rijen) {
    assert.equal(r.verschil, 0, r.sleutel + ': ' + r.naam + ' verandert het totaal met ' + r.verschil + ' cent');
    assert.equal(r.sluit.klopt, true, r.sleutel + ': de sluitcontrole klopt');
    assert.equal(r.sluit.som, 0, r.sleutel + ': de som van alle saldi is exact nul');
    assert.deepEqual(r.sluit.rood, [], r.sleutel + ': geen enkele ledenrekening staat rood');
  }
  assert.deepEqual(klachten, []);
});

test('3. elk scenario doet werkelijk wat het zegt', async () => {
  /* DE REGEL DIE DEZE HELE PROEF DRAAGT, en hij komt uit een fout van deze
     proef zelf. Een overdracht tussen spelers laat de som PER DEFINITIE gelijk,
     dus toets 2 kan een scenario dat niets doet niet onderscheiden van een dat
     werkt. De eerste versie riep pay.stuur met het verkeerde veld aan; elke tik
     kwam terug met een 404 en alles was groen over overdrachten die nooit
     plaatsvonden.

     Het aantal grootboekregels staat daarom als GETAL vast. `dubbelTikken` is
     de scherpste: twintig aangeboden tikken, veertig regels -- niet zestig, want
     de tweede aanbieding van dezelfde sleutel hoort geen tweede boeking te
     maken. Dat is idempotentie, gemeten en niet aangenomen. */
  const { rijen } = await keten.keur();
  const gemeten = Object.fromEntries(rijen.map(r => [r.sleutel, r.boekingen]));
  assert.deepEqual(gemeten, {
    heenEnWeer: 80, carrousel: 90, zelfBetalen: 0, splitsenEnSamenvoegen: 102, dubbelTikken: 40
  });
});

test('4. tegenproef: keur MELDT het als een scenario iets anders doet', async () => {
  /* Zonder deze toets is de klachtenlijst van keur() nooit gedraaid, en dan is
     hij precies de tak die stil kan verdwijnen. Twee takken, twee proeven. */
  const scenario = keten.SCENARIOS.heenEnWeer;

  // (a) het scenario levert een ander aantal grootboekregels op dan het zegt
  const echt = scenario.boekingen;
  scenario.boekingen = echt + 2;
  try {
    const { klachten } = await keten.keur();
    assert.equal(klachten.length, 1, 'precies een klacht');
    assert.match(klachten[0], /heenEnWeer/);
    assert.match(klachten[0], /grootboekregels/);
  } finally { scenario.boekingen = echt; }

  /* (b) het TOTAAL verandert. Dat kan met een pure overdracht niet gebeuren --
     precies waarom deze tak anders nooit draait. Hier laadt het scenario
     stiekem geld van BUITEN bij, en dan hoort keur() dat te melden. */
  const doe = scenario.doe;
  scenario.doe = async (pay) => {
    await doe(pay);
    for (let i = 0; i < 40; i++) {
      const r = await pay.laadOp({ codenaam: keten.SPELERS[0], centen: 77000, idem: 'stiekem-' + i });
      if (r && !r.error && (r.status == null || r.status < 400)) return;
    }
    throw new Error('de stiekeme oplading lukte niet; dan meet deze tegenproef niets');
  };
  try {
    const { klachten } = await keten.keur();
    const overTotaal = klachten.filter(k => /verandert het totaal/.test(k));
    assert.equal(overTotaal.length, 1, 'keur meldt dat het totaal is veranderd: ' + klachten.join(' | '));
    assert.match(overTotaal[0], /77000/);
  } finally { scenario.doe = doe; }

  /* (c) het GROOTBOEK staat scheef. Ook deze tak draait anders nooit, want in
     elk echt scenario klopt de sluitcontrole. Zonder deze proef zou een
     `sluit`-veld dat altijd `{ klopt: true }` teruggeeft ongemerkt doorkomen --
     een mutatie liet dat zien. */
  scenario.doe = async (pay, db) => {
    await doe(pay);
    db.data.paySaldi['lid:' + keten.SPELERS[0]] += 3;
  };
  try {
    const { klachten } = await keten.keur();
    const overSluit = klachten.filter(k => /sluitcontrole/.test(k));
    assert.equal(overSluit.length, 1, 'keur meldt dat het grootboek niet sluit: ' + klachten.join(' | '));
    assert.match(overSluit[0], /som 3/);
  } finally { scenario.doe = doe; }
});

test('4c. de sluitcontrole kan werkelijk zakken', async () => {
  /* WAAROM DIT ER STAAT. Toets 2 eist dat de sluitcontrole klopt, en dat doet
     hij -- in elk scenario, elke keer. Precies daarom bewijst die bewering
     niets: hij zou ook groen zijn als de controle altijd "klopt" teruggaf. Een
     mutatie die hem verving door een vaste `{ klopt: true }` liet alle acht
     toetsen staan.

     Hier wordt het grootboek MET DE HAND scheefgezet -- een cent bijgeschreven
     die nergens vandaan komt -- en dan hoort hij te zakken. Nu meet toets 2
     werkelijk iets. */
  const { db, pay } = keten.opstelling();
  let geladen = false;
  for (let i = 0; i < 40 && !geladen; i++) {
    const r = await pay.laadOp({ codenaam: keten.SPELERS[0], centen: 100000, idem: 'scheef-' + i });
    if (r && !r.error && (r.status == null || r.status < 400)) geladen = true;
  }
  assert.ok(geladen, 'er staat geld op de rekening');
  assert.equal(pay.sluitcontrole().klopt, true, 'en het grootboek klopt');

  db.data.paySaldi['lid:' + keten.SPELERS[0]] += 1;      // een cent uit het niets
  const scheef = pay.sluitcontrole();
  assert.equal(scheef.klopt, false, 'een cent uit het niets laat de sluitcontrole zakken');
  assert.equal(scheef.som, 1, 'en hij noemt precies hoeveel er te veel staat');

  db.data.paySaldi['lid:' + keten.SPELERS[1]] = -5;      // een ledenrekening in het rood
  assert.deepEqual(pay.sluitcontrole().rood, ['lid:' + keten.SPELERS[1]],
    'en een rode ledenrekening wordt bij naam genoemd');
});

test('4b. een geweigerde tik valt nooit stil weg', async () => {
  /* De vangnetregel in tik(). Vandaag wordt geen enkele tik in de scenario's
     geweigerd, dus zonder deze toets is die regel nooit gedraaid -- en een
     vangnet dat nooit is aangesproken, is een aanname. */
  const { pay } = keten.opstelling();
  await assert.rejects(
    () => keten.tik(pay, keten.SPELERS[0], 'Bestaat Niet 99', 1000, 'nep'),
    /werd geweigerd/,
    'een tik naar een onbekende codenaam gooit, in plaats van stil terug te komen');
  const stil = await keten.tik(pay, keten.SPELERS[0], 'Bestaat Niet 99', 1000, 'nep', true);
  assert.equal(stil.ok, undefined, 'en met magWeigeren komt hij als antwoord terug');
});

test('5. de simulatiebank weigert onderweg, en dat hoort', async () => {
  /* Zeven van de honderd sleutels geven `geweigerd` en vijf `traag`. Komt dit
     getal ooit op nul, dan draait deze toets niet meer op een rail die stuk kan
     -- en dan bewijst hij niets over wat er nieuw is. */
  const { rijen } = await keten.keur();
  const totaalGeweigerd = rijen.reduce((n, r) => n + r.geweigerd, 0);
  assert.ok(totaalGeweigerd > 0,
    'de bank heeft minstens een keer geweigerd tijdens de ronde (nu: ' + totaalGeweigerd + ')');
});

test('6. tegenproef: het instrument ziet een verandering die er WEL is', async () => {
  /* Zonder deze toets is "verschil is nul" ook de uitslag van een kapotte meter.
     Hier komt er geld van BUITEN bij -- een tweede oplading -- en dat hoort de
     telling gewoon te zien. */
  const { pay } = keten.opstelling();
  const speler = keten.SPELERS[0];
  let gelukt = false;
  for (let i = 0; i < 40 && !gelukt; i++) {
    const r = await pay.laadOp({ codenaam: speler, centen: 100000, idem: 'tegenproef-' + i });
    if (r && !r.error && (r.status == null || r.status < 400)) gelukt = true;
  }
  assert.ok(gelukt, 'de eerste oplading is gelukt');
  const na = keten.aanTafel(pay);
  assert.equal(na, 100000, 'de telling ziet wat er is opgeladen');

  let tweede = false;
  for (let i = 0; i < 40 && !tweede; i++) {
    const r = await pay.laadOp({ codenaam: speler, centen: 100000, idem: 'tegenproef-2-' + i });
    if (r && !r.error && (r.status == null || r.status < 400)) tweede = true;
  }
  assert.ok(tweede, 'de tweede oplading is gelukt');
  assert.equal(keten.aanTafel(pay), 200000, 'en de telling beweegt mee -- hij zegt niet altijd nul');
  assert.equal(pay.sluitcontrole().klopt, true, 'en het grootboek klopt nog steeds');
});

test('7. het SPEL laadt kern/pay niet: dit is een proefstuk, geen koppeling', () => {
  /* De grens die dit hele bouwsel draagt. rtg-keten.js is het proefstuk en mag
     kern/pay aanroepen; geen enkele andere module in de Magnaat-wereld mag dat,
     want dan komt een speelbeurt langs de echte betaallaag. */
  const map = path.join(WORTEL, 'server/kern/spellen/magnaat');
  const modules = [];
  const loop = (m) => {
    for (const naam of fs.readdirSync(m)) {
      const p = path.join(m, naam);
      if (fs.statSync(p).isDirectory()) loop(p);
      else if (naam.endsWith('.js')) modules.push(p);
    }
  };
  loop(map);
  assert.ok(modules.length > 30, 'de spelmodules zijn gevonden, nu: ' + modules.length);

  const fout = modules
    .filter(p => path.basename(p) !== 'rtg-keten.js')
    .filter(p => /require\(['"][^'"]*\/pay['"]\)/.test(fs.readFileSync(p, 'utf8')))
    .map(p => path.relative(WORTEL, p));
  assert.deepEqual(fout, [],
    'spelmodules die kern/pay laden: ' + fout.join(', ') + ' -- een speelbeurt hoort daar niet langs');

  const proefstuk = fs.readFileSync(path.join(map, 'rtg-keten.js'), 'utf8');
  assert.match(proefstuk, /require\(['"]\.\.\/\.\.\/pay['"]\)/,
    'en het proefstuk zelf roept kern/pay wel degelijk aan -- anders meet dit niets');
});
