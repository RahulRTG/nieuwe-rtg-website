/* DE CRASHPROEF -- wat hier bewaakt wordt, en waarom juist dit.

   scripts/crashproef.js doet een dure meting: hij laat per geldroute het proces
   sterven op een crashgrens en kijkt wat er van de uitkomst overblijft. De
   meting zelf staat hier NIET -- die vraagt negentig serverstarts en hoort in
   een register, niet in een toets die bij elke commit draait.

   Wat hier wel staat is de VERTAALSLAG van meting naar oordeel, en dat is de
   plek waar deze proef stuk kan gaan zonder dat iemand het merkt:

     1. `ongemeten` dat als `niet idempotent` wordt gelezen. Die fout is hier
        gemaakt: de eerste versie stuurde alles wat niet `beschermd` heet naar
        PROVEN_PARTIAL met de reden "deze route hoort bij een tweede oproep werk
        te doen". Dat is `onbekend` lezen als `nee`, en het zou /api/pay/saldo
        -- een route waarvan factuurproef.js de idempotentie HEEFT bewezen --
        eeuwig op half bewijs hebben gehouden.
     2. een grens die wordt beproefd zonder injectiepunt. Dan draait de proef
        wel maar meet hij niets, en dat leest als dekking.
     3. `in-de-opslag` die stilletjes terugkomt in de lijst. crashgrenzen.js
        heeft gemeten dat die grens op een transactionele opslag geen eigen
        moment heeft; hem toch draaien meet sterf-na-commit nog een keer.

   Draai los: node --test test/crashproef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const cp = require('../scripts/crashproef.js');
const verraad = require('../server/lib/verraad.js');
const tax = require('../scripts/lib/crashtaxonomie.js');

test('elke grens die deze proef draait, heeft een injectiepunt dat ECHT is ingebouwd', () => {
  for (const g of cp.GRENZEN) {
    const v = verraad.CATALOGUS.find(x => x.naam === g.modus);
    assert.ok(v, g.modus + ' staat niet in de verraadscatalogus');
    assert.ok(v.waar, g.modus + ' is ontworpen maar niet ingebouwd -- een proef die hem toch ' +
      'draait, meet niets en levert een dekkingscijfer op dat er niet is');
  }
});

test('de grenzen komen uit de gesloten taxonomie en zijn niet verzonnen', () => {
  const bekend = Object.keys(tax.GRENZEN);
  for (const g of cp.GRENZEN) assert.ok(bekend.includes(g.grens), g.grens + ' kent de taxonomie niet');
});

/* `in-de-opslag` is een GEMETEN afwezigheid en geen vergeten regel. Zonder deze
   toets kan hij terugglijden in de lijst en dan meet de proef sterf-na-commit
   twee keer onder twee namen -- precies wat crashgrenzen.js is gaan uitsluiten. */
test('`in-de-opslag` wordt NIET gedraaid: hij heeft op deze opslag geen eigen moment', () => {
  assert.ok(!cp.GRENZEN.some(g => g.grens === 'in-de-opslag'),
    'die grens hoort hier niet bij: de opslag commit heel of rolt heel terug, ' +
    'dus een injectie ertussen is een tweede sterf-na-commit met een andere naam');
  const v = verraad.CATALOGUS.find(x => x.naam === 'sterf-in-de-opslag');
  assert.equal(v && v.waar, null, 'en de catalogus hoort hem als niet-ingebouwd te tonen');
});

test('elke grens draagt een uitgeschreven belofte -- anders is de uitslag niet te lezen', () => {
  for (const g of cp.GRENZEN) assert.ok(g.belofte && g.belofte.length > 30,
    g.grens + ' zegt niet welke belofte hier op het spel staat');
});

/* DE KERN VAN DIT BESTAND: de drie uitkomsten van de na-commit-grens.

   De regel wordt AANGEROEPEN en niet overgeschreven. Een toets die de logica
   naast de bron nog eens opschrijft, blijft groen als de bron verandert -- dat
   is precies hoe achttien groene toetsen eerder een kapotte functie hebben
   gedekt: de fixture hield zich aan de vorm die de code aannam in plaats van
   aan de echte. Vandaar dat scripts/crashproef.js `weegHerhaling` exporteert. */
const oordeel = (bijgekomen, verklaring) => cp.weegHerhaling(bijgekomen, verklaring).stand;

test('de weegregel wordt uit de bron gehaald en niet hier overgeschreven', () => {
  assert.equal(typeof cp.weegHerhaling, 'function',
    'zonder deze export zou dit bestand een kopie van de regel toetsen in plaats van de regel');
  for (const inv of [[0, 'beschermd'], [3, 'beschermd'], [3, 'ongemeten']]) {
    const w = cp.weegHerhaling(inv[0], inv[1]);
    assert.ok(w.reden && w.reden.length > 30, 'elke uitkomst draagt een uitgeschreven reden');
  }
});

test('een herhaling die NIETS toevoegt is bewezen, met of zonder verklaring', () => {
  assert.equal(oordeel(0, { zelfdeVerzoek: true }), 'PROVEN');
  assert.equal(oordeel(0, null), 'PROVEN',
    'de goede afloop heeft geen verklaring nodig: legt de herhaling niets bovenop, dan is de ' +
    'belofte gehouden. En dat is toestandsbescherming, want de idem-poort is na een herstart uit ' +
    'beeld -- haar venster is vijf seconden en een herstart duurt langer');
});

/* DE AUTORITEIT IS DE VERKLARING, NIET DE METING. `beschermd` in IDEMPROEF.json
   is gemeten met een EXPLICIETE sleutel, en de kale variant leunt op een venster
   van vijf seconden -- allebei onreproduceerbaar na een crash met een herstart.
   Twee routes stonden daardoor ten onrechte op FAILED, waaronder
   /api/office/bank/draai: "de knop een slag verder" HOORT twee keer te draaien. */
test('een herhaling die WEL werk deed, hangt aan de VERKLARING en niet aan een meting', () => {
  assert.equal(oordeel(3, { zelfdeVerzoek: true }), 'FAILED',
    'is verklaard dat een gelijk verzoek een herhaling is, dan is een tweede effect een defect');
  assert.equal(oordeel(3, { velden: ['naam'] }), 'FAILED', 'de veldvorm telt net zo goed');
  assert.equal(oordeel(3, null), 'NIET_BEPROEFD',
    'zonder verklaring is een tweede effect niet te beoordelen -- misschien is het de bedoeling');
  assert.notEqual(oordeel(3, null), 'FAILED',
    'een route zonder verklaring beschuldigen is dezelfde fout als `ongemeten` lezen als `nee`');
});

test('de weegregel noemt het venster van vijf seconden, want dat is waarom de poort hier niet helpt', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..',
    'scripts', 'crashproef.js'), 'utf8');
  assert.match(bron, /VENSTER_MS|vijf seconden|5 seconden|5s/,
    'zonder dat gegeven leest een FAILED hier als "de route is stuk" in plaats van als ' +
    '"bescherming uit de poort overleeft een herstart niet"');
});

/* EEN STAND DIE NOOIT EERLIJK KAN WORDEN TOEGEKEND, HOORT NIET TE BESTAAN.

   De eerste volledige ronde gaf 16 keer `BLINDE_INJECTIE`: de modus stond
   scherp, de route gaf 200 en het proces leefde door. Dat las als zestien
   defecten en het waren er nul -- acht routes (pas/bevries en broers) schrijven
   met de gewone write-behind save(), na te lezen in server/kern/bank/passen.js,
   en raken `bijeen()` noch `saveDuurzaam()`.

   Het woord is daarom weg, en niet hernoemd-en-bewaard. Van BUITEN is een echte
   blinde injectie namelijk niet te onderscheiden van een route die het
   injectiepunt niet raakt: allebei geven ze 200. Een stand die je nooit eerlijk
   kunt toekennen, is dekking die er niet is.

   Wat ervoor in de plaats kwam zegt alleen wat er gemeten IS, en het is geen
   geruststelling: deze route loopt niet langs de bundel, dus wat hem bedreigt
   is een VERLOREN schrijfactie -- een andere modus, die deze proef niet draait. */
test('`BLINDE_INJECTIE` bestaat niet meer als uitslag, en dat is een besluit', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..',
    'scripts', 'crashproef.js'), 'utf8');
  const toegekend = /stand: 'BLINDE_INJECTIE'|\? 'BLINDE_INJECTIE'/.test(bron);
  assert.ok(!toegekend, 'geen enkele tak mag deze stand nog toekennen: van buiten is hij niet ' +
    'te onderscheiden van een route die het injectiepunt simpelweg niet raakt');
  assert.match(bron, /GEEN_DUURZAME_WEG/, 'de stand die hem vervangt hoort er wel te zijn');
});

test('GEEN_DUURZAME_WEG wijst naar de modus die hem WEL zou raken', () => {
  const bron = require('fs').readFileSync(require('path').join(__dirname, '..',
    'scripts', 'crashproef.js'), 'utf8');
  assert.match(bron, /schrijf-verloren/,
    'een route zonder duurzame weg is niet veilig maar anders bedreigd, en de uitslag ' +
    'hoort te zeggen welke modus dat wel meet -- anders leest hij als een vrijspraak');
});

/* ============================================================================
   HET OVERLEVINGSCONTRACT -- vier beweringen, en de strengste wint.

   "Het proces stierf en kwam terug" is geen crashbewijs: een route kan netjes
   sterven, netjes herstarten, en ondertussen de helft van zijn uitkomst hebben
   laten staan. De vier beweringen hieronder worden APART gewogen en nooit
   opgeteld, en de regel wordt AANGEROEPEN en niet overgeschreven. */
test('de vier beweringen staan apart en de strengste bepaalt de stand', () => {
  assert.deepEqual(Object.keys(cp.CLAIMS).sort(),
    ['geenDubbel', 'geenHalf', 'geenVals', 'toestand'].sort());
  const schoon = cp.weegContract({ verwachtLeeg: true, geraakt: 0, aantalCollecties: 5,
    status: 0, gestorven: true, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(schoon.stand, 'PROVEN');
  assert.equal(Object.keys(schoon.claims).length, 4, 'alle vier worden gewogen, ook de gehaalde');
});

/* HET HALVE RESULTAAT IS DE HELE REDEN DAT DIT CONTRACT BESTAAT. Een route mag
   netjes weigeren terwijl drie van de vijf collecties al zijn aangepast. */
test('een half resultaat zakt op toestand EN op geenHalf, en niet op een van de twee', () => {
  const half = cp.weegContract({ verwachtLeeg: true, geraakt: 2, aantalCollecties: 5,
    status: 0, gestorven: true, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(half.stand, 'FAILED');
  assert.equal(half.claims.toestand.stand, 'FAILED');
  assert.equal(half.claims.geenHalf.stand, 'FAILED');
  assert.match(half.claims.geenHalf.reden, /2 van de 5/);
});

/* "HALF" BESTAAT NIET BIJ EEN COLLECTIE, en dan is dit geen bewijs maar een
   tautologie. Een tautologie die als PROVEN meetelt, tilt het dekkingscijfer op
   zonder dat er iets is aangetoond -- vandaar NIET_BEPROEFD met de reden. */
test('bij een enkele collectie is `geenHalf` NIET_BEPROEFD en niet stilzwijgend bewezen', () => {
  const een = cp.weegContract({ verwachtLeeg: true, geraakt: 0, aantalCollecties: 1,
    status: 0, gestorven: true, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(een.claims.geenHalf.stand, 'NIET_BEPROEFD');
  assert.ok(een.claims.geenHalf.reden.length > 20, 'met de reden erbij');
  assert.equal(een.stand, 'NIET_BEPROEFD', 'en de strengste stand trekt de hele rij mee omlaag');
});

/* DE GRENS NA DE COMMIT BELOOFT HET TEGENOVERGESTELDE van die ervoor: daar hoort
   de uitkomst er JUIST te staan. Een lege uitkomst betekent dan dat de commit de
   herstart niet heeft overleefd. */
test('na de commit is een LEGE uitkomst een gebroken belofte, geen schone lei', () => {
  const leeg = cp.weegContract({ verwachtLeeg: false, geraakt: 0, aantalCollecties: 5,
    status: 0, gestorven: true, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(leeg.claims.toestand.stand, 'FAILED');
  assert.match(leeg.claims.toestand.reden, /overleefde de herstart niet/);
});

/* VALS SUCCES EN VALS FALEN. Een crash geeft GEEN antwoord, en dat is eerlijk:
   de aanroeper weet dat hij het niet weet. Vals wordt het als er wel een
   antwoord kwam dat niet klopt met wat er is blijven staan. */
test('geen antwoord is eerlijk; een antwoord dat niet klopt met de opslag is vals', () => {
  const stil = cp.weegContract({ verwachtLeeg: true, geraakt: 0, aantalCollecties: 2,
    status: 0, gestorven: true, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(stil.claims.geenVals.stand, 'PROVEN');

  const valsSucces = cp.weegContract({ verwachtLeeg: false, geraakt: 0, aantalCollecties: 2,
    status: 200, gestorven: false, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(valsSucces.claims.geenVals.stand, 'FAILED');
  assert.match(valsSucces.claims.geenVals.reden, /vals succes/);

  const valsFalen = cp.weegContract({ verwachtLeeg: false, geraakt: 3, aantalCollecties: 3,
    status: 500, gestorven: false, herhaalStatus: 200, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(valsFalen.claims.geenVals.stand, 'FAILED');
  assert.match(valsFalen.claims.geenVals.reden, /vals falen/);
});

/* CRASHVEILIGHEID ZONDER RETRY-PROEF IS MAAR DE HELFT VAN CRASHVEILIGHEID. */
test('zonder uitgevoerde herhaling is `geenDubbel` NIET_BEPROEFD', () => {
  const zonder = cp.weegContract({ verwachtLeeg: true, geraakt: 0, aantalCollecties: 2,
    status: 0, gestorven: true, herhaalStatus: null, bijgekomen: 0, verklaring: { zelfdeVerzoek: true } });
  assert.equal(zonder.claims.geenDubbel.stand, 'NIET_BEPROEFD');
  assert.equal(zonder.stand, 'NIET_BEPROEFD',
    'en dat trekt de hele rij omlaag: half bewijs is geen bewijs');
});

/* ============================================================================
   DRIE ONAFHANKELIJKE FEITEN, EN PAS DAARNA EEN CONCLUSIE.

   De eerste indeling keek naar EEN ding -- heeft idemwereld.js een lijf voor dit
   pad -- en gebruikte dat NEGATIEVE signaal over de proef als uitspraak over de
   route. Dat ging meteen mis op /api/supplier/oog/overzicht: die leest de body
   niet (`res.json(oogOverzicht(req.supplier))`) en gaf 503. Een lijf schrijven
   zou daar nooit iets deblokkeren -- het was een METERfout, geen routeprobleem.

   De regel weegt nu status en leestBody los van elkaar, en wordt AANGEROEPEN
   en niet overgeschreven. */
test('een route die de body niet leest, kan nooit op de body stranden', () => {
  const geen = cp.weegBlokkade({ status: 400, leestBody: false });
  assert.notEqual(geen.blokkeertOp, 'LIJF',
    'dit is de fout van 13 september: geen bodyfixture gelezen als "het lijf ontbreekt"');
  assert.equal(geen.blokkeertOp, 'ONBEPAALD', 'zonder body-lezing is de oorzaak niet bekend');
  const wel = cp.weegBlokkade({ status: 400, leestBody: true });
  assert.equal(wel.blokkeertOp, 'LIJF');
});

test('een 503 is de DIENST die weigert, geen ontbrekende fixture', () => {
  const f = cp.weegBlokkade({ status: 503, leestBody: false });
  assert.equal(f.bereiktTot, 'DIENSTPOORT');
  assert.equal(f.blokkeertOp, 'FEATURE');
  assert.match(f.reden, /schakelaar|afhankelijkheid/,
    'de reden moet zeggen dat een lijf of fixture hier niets oplost -- anders breidt iemand ' +
    'de proefwereld uit om een getal groen te krijgen');
});

test('de trede zegt hoe VER de proef kwam, los van de blokkade', () => {
  assert.equal(cp.tredeVan(0), 'CRASHGRENS', 'gestorven = de injectie is geraakt');
  assert.equal(cp.tredeVan(200), 'HANDLER_VOLTOOID');
  assert.equal(cp.tredeVan(403), 'ROLPOORT');
  assert.equal(cp.tredeVan(409), 'DOMEINVOORWAARDE');
  assert.equal(cp.tredeVan(418), 'ONBEPAALD', 'een status die nergens in past wordt niet geraden');
  for (const t of Object.keys(cp.TREDEN)) assert.ok(cp.TREDEN[t].length > 20,
    'elke trede legt uit wat hij betekent: ' + t);
});

test('een bereikte crashgrens of een voltooide handler is GEEN blokkade', () => {
  assert.equal(cp.weegBlokkade({ status: 0, leestBody: true }).blokkeertOp, null);
  assert.equal(cp.weegBlokkade({ status: 200, leestBody: true }).blokkeertOp, null);
});

/* `leestBody` komt uit de BRON en niet uit een aanname. Deze toets draait tegen
   de echte bestanden, want een fixture zou zich houden aan de vorm die de code
   aanneemt in plaats van aan die van het register. */
test('leestBody wordt uit de bron gelezen, met de vindplaats erbij', () => {
  const zonder = cp.leestBodyVan('POST', '/api/supplier/oog/overzicht');
  assert.equal(zonder.leest, false);
  assert.match(zonder.grond, /oog\.js/, 'met het bestand erbij, zodat iemand het kan nakijken');
  const met = cp.leestBodyVan('POST', '/api/supplier/facturen/maak');
  assert.equal(met.leest, true);
  assert.match(met.grond, /req\.body/);
  const weg = cp.leestBodyVan('POST', '/api/bestaat/echt/niet');
  assert.equal(weg.leest, null, 'onbekend is null en niet false -- anders leest "niet gevonden" ' +
    'als "leest de body niet"');
});

/* ELKE BLOKKADESOORT HEEFT EEN STAND, en FEATURE heeft met opzet GEEN tand.
   Een 503 is geen schuld van de proef; er een tand op zetten verleidt iemand de
   proefwereld uit te breiden terwijl er niets aan de fixture mankeert. */
test('elke blokkadesoort heeft precies een stand', () => {
  for (const soort of ['LIJF', 'WERELD', 'FEATURE', 'ROL', 'ONBEPAALD'])
    assert.ok(cp.STAND_VAN_BLOKKADE[soort], soort + ' heeft geen stand');
  assert.equal(cp.STAND_VAN_BLOKKADE.FEATURE, 'BLOCKED_FEATURE');
});

/* DE ZELFIJKING. Een toets die je niet hebt zien zakken is geen toets: de regel
   hierboven MOET op verschillende invoer verschillend uitvallen. Geeft hij
   overal hetzelfde, dan rekent dit bestand niets na. */
test('zelfijking: de drie uitkomsten zijn werkelijk drie', () => {
  const alle = new Set([oordeel(0, null), oordeel(3, { zelfdeVerzoek: true }), oordeel(3, null)]);
  assert.equal(alle.size, 3, 'de regel valt niet uiteen in drie uitkomsten en weegt dus niets');
});
