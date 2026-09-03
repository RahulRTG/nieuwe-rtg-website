/* ============================================================================
   DE PRIJS VAN EEN ONGEMETEN TOETSBESTAND, EN DE STABILITEIT VAN DE PLANNER.

   scripts/lib/delen.js verdeelt de scherven op gemeten duur. Wat een bestand
   kost dat NIET in TOETSDUUR.json staat, is een besluit -- en dat besluit is
   hier twee keer fout geweest (het maximum, daarna de p99 over alles). Zie de
   kop van scripts/lib/duurprijs.js voor beide en voor de metingen eronder.

   Dit bestand toetst de regel zelf, en niet of de verdeling balanceert; dat
   laatste staat in test/delen.test.js en hoort daar te blijven.

   WAT HIER MET OPZET NIET IN STAAT: een bewering van de vorm "een nieuw
   bestand mag hooguit X% van de bestaande bestanden verplaatsen". Die klinkt
   als de invariant die je wilt en hij is niet te halen: op het echte register
   van 1268 bestanden verplaatst een PERFECT gemeten bestand van 100ms er al
   294 (23%), want de greedy leidt elke plaatsing opnieuw af. Een drempel
   daaronder is dus onhaalbaar en een drempel erboven zegt niets. Wat er wel in
   staat is de RICHTING (toets 5) en het contract (toets 4): meten koopt
   stabiliteit, en een ongemeten bestand betaalt zijn prijs in looptijd en niet
   in de plaatsing van anderen.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   staan per toets bij de toets.

   Draai los: node --test test/duurprijs.test.js
   ========================================================================== */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { prijzen, klasseVan, KLASSE_MINIMUM } = require('../scripts/lib/duurprijs');
const { indeling, zetDuren } = require('../scripts/lib/delen');

/* Een kaart bouwen met per klasse een eigen, herkenbare spreiding. Geen toeval:
   dezelfde invoer moet altijd hetzelfde antwoord geven, ook op een andere
   machine. */
function kaart(aantalUnit, msUnit, aantalE2e, msE2e) {
  const k = new Map();
  for (let i = 0; i < aantalUnit; i++) k.set('u' + String(i).padStart(4, '0') + '.test.js', msUnit(i));
  for (let i = 0; i < aantalE2e; i++) k.set('e' + String(i).padStart(4, '0') + '.e2e.js', msE2e(i));
  return k;
}

test('1. een ongemeten schermtoets wordt geprijsd op schermtoetsen, niet op unit-toetsen', () => {
  /* DE KERN VAN DEZE RONDE. In de modus `dekking` staan 1268 unit-metingen en
     NUL schermtoetsen; in `onbekend` heeft de e2e-klasse een staart die twee
     keer zo hoog ligt. Een ongemeten schermtoets werd op de p99 over ALLES
     geprijsd, en dat is een verzameling waar hij niet in hoort.

     Hier staan de twee klassen daarom ver uit elkaar: unit rond de 1000ms,
     schermtoetsen rond de 100.000ms. De p99 over alles wordt gedomineerd door
     de schermtoetsen; de p99 van unit is duizend keer lager.

     MUTATIE: in duurprijs.js `prijs.has(k) ? prijs.get(k) : algemeen` vervangen
     door `algemeen` -> deze toets ZAKT (RAAK). */
  const k = kaart(150, (i) => 900 + i, 150, (i) => 90000 + i * 100);
  const { prijsVoor, algemeen } = prijzen(k);

  const unit = prijsVoor('nieuw.test.js');
  const scherm = prijsVoor('nieuw.e2e.js');

  assert.ok(unit < 2000, 'een ongemeten unit-toets hoort op de unit-staart te zitten, kreeg ' + unit);
  assert.ok(scherm > 100000, 'een ongemeten schermtoets hoort op de e2e-staart te zitten, kreeg ' + scherm);
  assert.ok(scherm > unit * 10, 'de twee klassen horen niet op dezelfde prijs uit te komen');
  /* En de p99 over alles zit bij de schermtoetsen: dat is precies waarom de
     unit-toets er niet op geprijsd mag worden. */
  assert.ok(algemeen > 50000, 'de algemene p99 wordt hier gedomineerd door de e2e-klasse');
  assert.notEqual(unit, algemeen, 'de unit-prijs is de algemene p99 en dus niet klassegebonden');
});

test('2. een klasse met te weinig metingen zet zijn eigen prijs niet, en zegt waarom', () => {
  /* Onder de honderd metingen IS de p99 het maximum -- reken na: de index is
     ceil(n * 0,99) - 1, dus bij n = 50 is dat 49, het hoogste element. Een
     klasse met vijf schermtoetsen waarvan er een uitschiet, zou elke ongemeten
     schermtoets op die uitschieter prijzen. Dat is de fout van 1 september
     terug, alleen binnen een kleinere verzameling.

     MUTATIE: `rij.length >= KLASSE_MINIMUM` vervangen door `rij.length > 0`
     -> deze toets ZAKT (RAAK): de prijs wordt dan 5.000.000. */
  const k = kaart(200, () => 1000, 5, (i) => (i === 0 ? 5000000 : 1000));
  const { prijsVoor, algemeen, prijs, grond } = prijzen(k);

  assert.equal(prijsVoor('nieuw.e2e.js'), algemeen,
    'een klasse van vijf hoort terug te vallen op de algemene p99');
  assert.ok(!prijs.has('e2e'), 'en hoort geen eigen prijs te krijgen');
  assert.equal(grond.get('e2e').grond, 'algemeen', 'de terugval hoort in de uitslag te staan');
  assert.equal(grond.get('e2e').metingen, 5);
  assert.match(grond.get('e2e').waarom, /p99 het maximum/,
    'en de reden hoort erbij te staan, niet alleen de uitkomst');
  /* De unit-klasse haalt de drempel wel, en draagt dus wel zijn eigen grond. */
  assert.equal(grond.get('unit').grond, 'eigen-klasse');
  assert.ok(KLASSE_MINIMUM >= 100, 'onder de honderd is de p99 het maximum; zie de kop');
});

test('3. ongemeten is nooit goedkoop: de prijs ligt boven de mediaan van zijn klasse', () => {
  /* De hoofdregel van KEURING.md: onzekerheid mag nooit snelheid afdwingen. De
     prijs is twee keer verlaagd (maximum -> p99 over alles -> p99 per klasse)
     en bij zo'n reeks is de volgende stap altijd verleidelijk. Deze bewering
     zet de bodem: onder de mediaan van de eigen klasse is het geen straf meer
     maar een gok naar beneden.

     MUTATIE: in duurprijs.js de p99 vervangen door de mediaan
     (`Math.ceil(rij.length * 0.5)`) -> deze toets ZAKT (RAAK). */
  const k = kaart(300, (i) => 1000 + i * 10, 150, (i) => 50000 + i * 10);
  const { prijsVoor, prijs } = prijzen(k);

  const unitRij = [...k].filter(([n]) => n.endsWith('.test.js')).map(([, v]) => v).sort((a, b) => a - b);
  const e2eRij = [...k].filter(([n]) => n.endsWith('.e2e.js')).map(([, v]) => v).sort((a, b) => a - b);
  const mediaan = (r) => r[Math.floor(r.length / 2)];

  assert.ok(prijsVoor('nieuw.test.js') > mediaan(unitRij),
    'een ongemeten unit-toets hoort boven de mediaan van zijn klasse te liggen');
  assert.ok(prijsVoor('nieuw.e2e.js') > mediaan(e2eRij),
    'en een ongemeten schermtoets ook');
  /* En hij ligt ook niet boven het maximum: dat was fout nummer een. */
  assert.ok(prijs.get('unit') <= unitRij[unitRij.length - 1], 'de prijs is geen uitschieter');
  assert.ok(prijs.get('e2e') <= e2eRij[e2eRij.length - 1]);
});

test('4. een ongemeten bestand betaalt in looptijd, niet in de plaatsing van anderen', () => {
  /* HET CONTRACT. Een ongemeten bestand hoort precies zo te worden geplaatst
     als een GEMETEN bestand met dezelfde prijs -- niet vooraan, niet in de
     leegste bak, geen eigen regel. Zodra iemand daar een uitzondering voor
     maakt ("nieuwe bestanden eerst"), betaalt niet dat bestand de rekening maar
     iedereen eromheen, en dat is exact de schade die deze ronde opleverde.

     MUTATIE: in delen.js de sorteersleutel voor ongemeten bestanden op
     Infinity zetten -> deze toets ZAKT (RAAK). */
  const k = kaart(200, (i) => 1000 + (i % 37) * 100, 0, () => 0);
  const namen = [...k.keys()].sort();
  const { prijsVoor } = prijzen(k);
  const prijs = prijsVoor('zz-nieuw.test.js');

  zetDuren(Object.fromEntries(k), 'geldig');
  const metOngemeten = indeling([...namen, 'zz-nieuw.test.js'].sort(), 4);

  const k2 = new Map(k); k2.set('zz-nieuw.test.js', prijs);
  zetDuren(Object.fromEntries(k2), 'geldig');
  const metGemeten = indeling([...namen, 'zz-nieuw.test.js'].sort(), 4);
  zetDuren(null);

  assert.deepEqual(metOngemeten, metGemeten,
    'een ongemeten bestand hoort dezelfde verdeling te geven als een gemeten bestand met zijn prijs');
});

test('5. meten koopt stabiliteit: een gemeten bestand verplaatst er minder dan een ongemeten', () => {
  /* DE RICHTING, en niet een drempel. Op het echte register verplaatst een
     perfect gemeten bestand van 100ms er al 23% -- die bodem hoort bij de
     greedy en niet bij de prijs. Wat wel moet gelden is dat MEER weten nooit
     slechter uitpakt: een bestand waarvan de duur bekend is, hoort de bestaande
     verdeling minder om te gooien dan hetzelfde bestand ongemeten.

     Zakt deze bewering, dan is de prijs zo laag geworden dat ongemeten niet
     meer als duur telt -- of zo hoog dat hij weer een uitschieter is.

     MUTATIE: in duurprijs.js `algemeen` teruggeven als prijs voor elke klasse
     (dus de oude regel) -> deze toets blijft staan, want de oude regel gokte
     hier ook naar boven. Hij zakt WEL op `prijsVoor = () => 1`
     -> "een gemeten bestand verplaatst er niet meer dan een ongemeten" ZAKT. */
  const k = kaart(400, (i) => 1000 + (i % 53) * 200, 0, () => 0);
  const namen = [...k.keys()].sort();

  const waar = (bakken) => {
    const m = new Map();
    bakken.forEach((b, i) => b.forEach((n) => m.set(n, i)));
    return m;
  };
  const verschoven = (a, b) => namen.reduce((n, x) => n + (a.get(x) === b.get(x) ? 0 : 1), 0);

  zetDuren(Object.fromEntries(k), 'geldig');
  const voor = waar(indeling(namen, 4));

  const metPrijs = (ms) => {
    const k2 = new Map(k);
    if (ms !== null) k2.set('zz-nieuw.test.js', ms);
    zetDuren(Object.fromEntries(k2), 'geldig');
    return waar(indeling([...namen, 'zz-nieuw.test.js'].sort(), 4));
  };

  const gemeten = verschoven(voor, metPrijs(100));
  const ongemeten = verschoven(voor, metPrijs(null));
  zetDuren(null);

  assert.ok(gemeten < ongemeten,
    'een gemeten bestand van 100ms verplaatste er ' + gemeten + ', een ongemeten ' + ongemeten +
    '; meten hoort de verdeling juist rustiger te maken');

  /* HIER STOND `gemeten > 0`, EN DAT WAS EEN AANNAME DIE NIET KLOPTE. De
     gedachte was dat de greedy elke plaatsing opnieuw afleidt en dus altijd
     iets verplaatst. Op deze regelmatige kaart verplaatst een gemeten bestand
     van 100ms er NUL: de gewichten vallen samen, dus de volgorde ligt vast en
     een licht bestand komt achteraan zonder iemand te raken.

     Op het ECHTE register verplaatst datzelfde bestand er 294 van 1268 (23%).
     De bodem hoort dus bij de spreiding van de echte metingen -- bijna-gelijke
     duren, waardoor "de minst belaste bak" telkens omslaat -- en niet bij het
     algoritme. Dat verschil is het meten waard geweest: het zegt dat de bodem
     weggaat door de metingen gelijkmatiger te maken noch door de prijs aan te
     passen, maar alleen door een verdeling die bestaande bestanden laat staan. */
});

test('7. de terugvalladder gaat omhoog van sport 1 naar 3, en nooit naar een lagere prijs', () => {
  /* DE LADDER. Sport 1 is de eigen klasse in de eigen modus; sport 2 is dezelfde
     klasse in een ANDERE modus, maar alleen als die HOGER uitkomt; sport 3 is de
     algemene p99 van de eigen modus.

     Sport 2 bestaat voor een geval dat hier echt voorkomt: in de modus `dekking`
     staan duizenden unit-metingen en NUL schermtoetsen. Zonder die sport wordt
     een ongemeten schermtoets daar geprijsd op de unit-p99.

     EN DE KLEM IS HET HELE PUNT: een andere modus is een ander kostenmodel, dus
     hij mag waarschuwen en niet geruststellen. Zegt hij LAGER, dan blijft de
     algemene p99 staan.

     MUTATIE: `ver.ms > algemeen` vervangen door `ver` -> de tweede helft van
     deze toets ZAKT (RAAK): de goedkope andere modus wint dan. */
  const eigen = kaart(300, () => 1000, 0, () => 0);          // alleen unit, p99 = 1000

  const duurderElders = kaart(0, () => 0, 150, () => 90000); // e2e elders: duur
  const opUit = prijzen(eigen, { andere: [{ modus: 'elders', kaart: duurderElders }] });
  assert.equal(opUit.prijsVoor('nieuw.e2e.js'), 90000,
    'een klasse die hier niet bestaat, hoort de hogere prijs van elders te krijgen');
  assert.equal(opUit.bronVoor('nieuw.e2e.js').sport, 2);
  assert.equal(opUit.bronVoor('nieuw.e2e.js').modus, 'elders');
  assert.equal(opUit.bronVoor('nieuw.test.js').sport, 1, 'de eigen klasse blijft sport 1');

  const goedkoperElders = kaart(0, () => 0, 150, () => 5);   // e2e elders: spotgoedkoop
  const omlaag = prijzen(eigen, { andere: [{ modus: 'elders', kaart: goedkoperElders }] });
  assert.equal(omlaag.prijsVoor('nieuw.e2e.js'), omlaag.algemeen,
    'een goedkopere andere modus mag de prijs NIET verlagen');
  assert.equal(omlaag.bronVoor('nieuw.e2e.js').sport, 3);
  assert.match(omlaag.bronVoor('nieuw.e2e.js').waarom, /niet hoger/,
    'en de uitslag hoort te zeggen dat elders wel keek maar niet hoger zei');
});

test('8. een andere modus met te weinig metingen telt niet mee als sport 2', () => {
  /* Dezelfde drempel geldt op elke sport. Anders zou een modus met drie
     schermtoetsen waarvan er een uitschiet, alsnog de prijs zetten -- via een
     omweg, en dat is de uitschieterfout terug.

     MUTATIE: in duurprijs.js de regel `if (rij.length < KLASSE_MINIMUM) continue;`
     in de elders-lus weghalen -> deze toets ZAKT (RAAK). */
  const eigen = kaart(300, () => 1000, 0, () => 0);
  const dunElders = kaart(0, () => 0, 3, (i) => (i === 0 ? 900000 : 10));
  const p = prijzen(eigen, { andere: [{ modus: 'elders', kaart: dunElders }] });

  assert.equal(p.prijsVoor('nieuw.e2e.js'), p.algemeen,
    'drie metingen elders horen de prijs niet te zetten');
  assert.equal(p.bronVoor('nieuw.e2e.js').sport, 3);
});

test('6. de klasse komt van de bestandsnaam, en alles wat geen van beide is heet overig', () => {
  assert.equal(klasseVan('a.e2e.js'), 'e2e');
  assert.equal(klasseVan('a.test.js'), 'unit');
  assert.equal(klasseVan('scherm.html'), 'overig');
  assert.equal(klasseVan(''), 'overig');
  assert.equal(klasseVan(null), 'overig');

  /* HIER STOND EEN BEWERING DIE NIET KON ZAKKEN. Ze legde vast dat
     `x.test.js.e2e.js` als `e2e` telt "omdat de volgorde in klasseVan()
     beslist" -- en dat is niet zo: de twee achtervoegsels sluiten elkaar uit,
     dus met endsWith kan die naam nooit `unit` worden. De mutatie die dat had
     moeten aantonen (de twee regels omdraaien) liet alle zes de toetsen staan.
     scripts/tandeloos.js telt precies dit soort beweringen, en terecht.

     Wat de klasse WEL kan breken is een ander achtervoegsel, en dat is de
     bewering die hier hoort: elk toetsbestand in test/ valt in een van de twee
     klassen en geen enkele op `overig`. Zakt die, dan is er een soort
     toetsbestand bijgekomen waar deze prijs niets over zegt -- en dan hoort
     iemand daar een klasse voor te maken in plaats van hem stil op de algemene
     p99 te laten landen. */
  const echte = require('node:fs').readdirSync(require('node:path').join(__dirname))
    .filter((f) => f.endsWith('.test.js') || f.endsWith('.e2e.js'));
  assert.ok(echte.length > 1000, 'de testmap hoort hier echt gelezen te worden (' + echte.length + ')');
  assert.deepEqual(echte.filter((f) => klasseVan(f) === 'overig'), [],
    'elk toetsbestand hoort in een klasse te vallen die zijn eigen prijs kan zetten');
});
