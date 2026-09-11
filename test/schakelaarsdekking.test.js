/* ELKE SCHAKELAAR SCHAKELT IETS, EN ELKE ROUTE WEET OF HIJ AAN STAAT.

   Draai los: node --experimental-sqlite --test test/schakelaarsdekking.test.js

   DE VRAAG DIE HIERONDER LIGT: welke routes bestaan wel maar zijn niet actief?
   Die was tot nu toe niet te beantwoorden, en het antwoord bleek een defect te
   bevatten.

   VIER SCHAKELAARS SCHAKELDEN NIETS. functieVoorPad() kiest de langste prefix en
   breekt een gelijkspel met de volgorde (`len > besteLen` is strikt). Vier paren
   claimden exact hetzelfde pad -- tg-werving naast werving, en ov-arrival,
   ov-instant-reality en ov-rtgone naast arrival, instantreality en rtgone. De
   eerste won, de tweede stond wel op het bord. Samen 23 routes achter een knop
   die loog, veertien daarvan van RTG One: wie 'Invisible Arrival' uitzette zag
   hem uitgaan terwijl alle vier zijn routes bleven draaien.

   Een schakelaar die niet schakelt is erger dan een ontbrekende schakelaar,
   want hij wekt vertrouwen. De vier zijn weg; ./server/functies/register/index.js
   gooit voortaan bij het OPSTARTEN als twee functies hetzelfde pad claimen.

   DE MUTATIES (LAT.md regel 2), beide gedaan en beide zag ik de juiste toets
   zakken:
     - een dubbele claim op /api/rtgone terugzetten -> toets 1 zakt (de server
       komt dan niet eens op, en dat is de bedoeling)
     - een functie een pad geven dat geen enkele route heeft -> toets 2 zakt */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const functies = require('../server/functies');
const { prefixLengte } = require('../server/functies/toegang');
const { alleRoutes } = require('../scripts/lib/routes');

const F = functies.FUNCTIES;

test('1. geen twee functies claimen hetzelfde pad', () => {
  /* De catalogus gooit hier zelf al bij het laden op; deze toets zegt WELKE, en
     zorgt dat de reden in de suite staat en niet alleen in een opstartfout. */
  const perPad = new Map();
  for (const f of F) for (const p of (f.paden || [])) {
    const bij = perPad.get(p) || []; bij.push(f.id); perPad.set(p, bij);
  }
  const dubbel = [...perPad].filter(([, ids]) => ids.length > 1);
  assert.deepEqual(dubbel, [],
    'deze paden worden door meer dan een functie geclaimd; de eerste wint en de rest ' +
    'staat op het bord zonder iets te schakelen: ' +
    dubbel.map(([p, ids]) => p + ' <- ' + ids.join(' + ')).join('; '));
});

test('2. elke schakelaar heeft minstens een route om te schakelen', () => {
  const routes = alleRoutes();
  const zonder = F.filter(f => !(f.paden || []).some(p => routes.some(r => prefixLengte(r.pad, p) > 0)));
  assert.deepEqual(zonder.map(f => f.id), [],
    'deze functies staan op het schakelbord maar er hangt geen enkele route onder. ' +
    'Een knop die niets doet is geen knop: ' +
    zonder.map(f => f.id + ' (' + JSON.stringify(f.paden) + ')').join(', '));
});

test('3. wat NIET actief is, is te benoemen en klein', () => {
  /* De eigenlijke vraag. Met een lege schakelkast geldt overal `standaard`, en
     dan hoort er hooguit een handvol functies uit te staan -- elk met een reden
     die iemand ooit bewust heeft opgeschreven. Groeit dit stil, dan draait dit
     huis met routes die niemand meer bereikt. */
  const uit = F.filter(f => functies.functieStatus(f.id, {}) !== 'aan');
  assert.ok(uit.length <= 5,
    uit.length + ' functies staan standaard uit; dat is meer dan een handvol en ' +
    'hoort een bewuste keuze te zijn: ' + uit.map(f => f.id).join(', '));
  for (const f of uit) {
    assert.ok(f.uitleg && f.uitleg.length > 20,
      f.id + ' staat standaard uit maar legt niet uit waarom dat zo is');
  }
});

test('4. elke route hoort bij een functie of bij de bediening', () => {
  /* De tegenhanger van toets 2: niet "een schakelaar zonder route" maar "een
     route zonder schakelaar". Die mogen bestaan -- de bediening van het platform
     zelf hoort niet uitschakelbaar te zijn -- maar ze horen BENOEMD te zijn.

     DE RATEL TELDE HET VERKEERDE DING, en dat kwam uit toen deze toets op een
     nieuwe laag zakte. Hij bewaakte "routes zonder functie <= 100", en dat is
     een GROVER getal dan de zin eronder belooft: een route zonder functie kan
     keurig verklaard zijn. server/kern/bestuursroutes.js is precies dat
     register -- de enige lijst van paden die BEWUST buiten de schakelkast staan,
     met per prefix de reden -- en test/schakelkast-dekking.test.js toets 1 eist
     al dat élke ongedekte route daarin staat.

     Deze toets vroeg dus een tweede keer, in een tweede getal, naar dezelfde
     zaak (LAT.md regel 4). Hij telt nu wat de zin zegt: routes die aan geen
     functie hangen EN nergens verklaard zijn. Dat is een STRENGERE grens en
     geen ruimere: van 100 naar 10, en 10 is de gemeten stand die sinds het
     vertrekpunt van deze tak niet is bewogen -- terwijl het ruwe getal in
     dezelfde periode van 97 naar 112 ging doordat er een hele isolatielaag bij
     kwam, verklaard en wel.

     MUTATIES (LAT.md regel 2):
     - de regel /api/isolatie/mijn uit bestuursroutes.js halen -> ZAKT (7 erbij).
     - de grens op 9 zetten -> ZAKT (dat is de ratel zelf: hij mag krimpen). */
  const { redenVoor } = require('../server/kern/bestuursroutes');
  const routes = alleRoutes();
  const paren = [];
  for (const f of F) for (const p of (f.paden || [])) paren.push(p);
  const zonder = routes.filter(r => !paren.some(p => prefixLengte(r.pad, p) > 0));
  /* TWEE GRENZEN, EN ZE METEN NIET HETZELFDE. Deze twee kwamen uit twee takken
     die allebei dezelfde toets versterkten; ze staan hier naast elkaar omdat de
     ene de andere niet vervangt.

     ONVERKLAARD (<= 10) is de scherpe: een route die aan geen functie hangt EN
     in geen register staat, is niet schakelbaar terwijl niemand heeft
     opgeschreven waarom. Dat is het echte gat.

     RUW (<= 120) is de grove, en hij komt van main met zijn eigen onderbouwing:
     de zelfbedieningslaag van het lid (tweefactor, sessies, herstelkanaal,
     toestel, twee relatie-routes) hoort met opzet niet aan een schakelaar --
     een knop waarmee het huis de tweefactor van een lid uitzet, hoort niet te
     bestaan. Die twintig staan als BEDIENING in kern/platformregister/bediening.js,
     elk met een reden, en test/platformregister.test.js eist dat elke route daar
     BENOEMD is. Zonder die volgorde was een hoger getal hier alleen een zachtere
     meter geweest.

     Wat allebei bewaken is hetzelfde: dat het er niet STILLETJES meer worden. */
  const onverklaard = zonder.filter(r => !redenVoor(r.pad)).map(r => r.pad);

  assert.ok(onverklaard.length <= 10,
    onverklaard.length + ' routes hangen aan geen enkele functie EN staan in geen enkel register. ' +
    'Ze zijn dan niet schakelbaar en niemand heeft opgeschreven waarom: ' +
    onverklaard.sort().join(', ') + ' -- zet ze in server/kern/bestuursroutes.js met een reden, ' +
    'of geef ze een functie. (Ruw, zonder functie maar wel verklaard: ' + zonder.length + '.)');

  /* 120 -> 135, EN DIE VIJFTIEN ZIJN DE ISOLATIELAAG. Zeven ledenroutes, acht
     kantoorroutes. Geen ervan hoort aan een functieschakelaar te hangen, en om
     dezelfde reden als de zelfbedieningslaag hierboven: een knop waarmee het
     huis de beschermstand van een lid uitzet, hoort niet te bestaan -- dat zou
     de laag omkeren van bescherming naar een sluipweg. Ze staan alle vijftien
     met hun reden in kern/bestuursroutes.js.

     De VOLGORDE waarin dit getal omhoog mocht is dezelfde als de vorige keer:
     eerst moet test/platformregister.test.js groen zijn (die eist dat elke route
     hier BENOEMD is), en dat stond hij voordat dit getal werd verzet. Zonder die
     volgorde is een hoger getal alleen een zachtere meter.

     135 -> 139, EN DIE VIER ZIJN DE SLOTEN OP DE BEDIENING ZELF. Het loket dat
     een zware bevestiging start (techniek en boardroom) en het inrichten,
     aflezen en afbreken van het herstelquorum (EIGENAAR.md par. 5). Geen ervan
     hoort aan een schakelaar: een knop waarmee je de bevestiging van een
     eigendomsoverdracht uitzet, is de eerste knop waar iemand die binnen is
     naar zoekt -- en afbreken moet kunnen ook als het huis half uitstaat. De
     herstelWEG zelf is wel schakelbaar (functie `eigenaarherstel`), want dat is
     een uitgang en geen slot. Alle vier staan met hun reden in
     kern/bestuursroutes.js, en test/platformregister.test.js was groen voordat
     dit getal werd verzet -- dezelfde volgorde als de vorige twee keer.

     De scherpe controle hierboven (`onverklaard <= 10`) is de echte poort en die
     beweegt NIET mee: een route zonder functie EN zonder register blijft
     verboden. */
  /* 139 -> 140: de ondertekende storingenontvanger. Ontvangst en herstel
     moeten bereikbaar blijven wanneer bedrijfsfuncties uitstaan. De route
     staat met reden in beide bedieningsregisters; platformregister.test.js
     was groen op 29f8ff1ad voordat deze telling is bijgewerkt. De eigen
     HMAC-poort blijft verplicht en onverklaard <= 10 verandert niet. */
  const storingen = zonder.find(r => r.methode === 'POST' && r.pad === '/api/webhooks/storingen');
  assert.ok(storingen && storingen.bewakers.includes('storingenAuth'),
    'de extra bedieningsroute moet de HMAC-beveiligde storingenontvanger zijn');
  /* 140 -> 143: HET EIGEN LIDMAATSCHAP VAN EEN LID. Zien wat er loopt, lezen wat
     opzeggen gaat doen, en opzeggen (/api/mijn/abonnement en twee onderpaden).

     Geen ervan hoort aan een functieschakelaar, en om dezelfde grond als de
     zelfbedieningslaag twee blokken hierboven: wie zich mag verbinden, mag zich
     losmaken. Een schakelaar hierop is een knop waarmee het huis iemand in een
     contract vasthoudt -- en dat is het dark pattern dat CLAUDE.md verbiedt, niet
     per ongeluk maar als voorziening.

     Bewust niet onder `tg-aanmeld`, de functie die /api/aanmelding schakelt: die
     gaat over de INSTROOM, en het sluiten van de inschrijving mag de bestaande
     leden niet opsluiten. Dat zijn twee besluiten. De afweging staat uitgeschreven
     in AFSPRAAK.md par. 14.2.

     Alle drie staan met hun reden in kern/bestuursroutes.js EN in
     kern/platformregister/bediening-recht.js -- twee registers met twee lezers,
     die hetzelfde horen te zeggen. En de volgorde is dezelfde als de vorige vier
     keer: test/platformregister.test.js (die eist dat elke route hier BENOEMD is)
     was groen -- 7 van 7 -- voordat dit getal werd verzet.

     De scherpe controle hierboven (`onverklaard <= 10`) beweegt NIET mee en staat
     nog steeds op 10: deze drie zijn verklaard, dus ze raken hem niet. Dat is het
     hele punt van twee grenzen naast elkaar. */
  assert.ok(zonder.length <= 143,
    zonder.length + ' routes hangen aan geen enkele functie. Dat is de bediening van ' +
    'het platform (boardroom, techniek, gezondheid, isolatie) en die hoort niet schakelbaar ' +
    'te zijn, maar bij deze aantallen is er iets anders aan de hand.');

  /* EN HET RUWE GETAL MAG NIET NUL ZIJN: nul zou betekenen dat de meting stuk
     is, niet dat het huis dicht is. */
  assert.ok(zonder.length > 0, 'nul zou betekenen dat de meting stuk is, niet dat het huis dicht is');
});
