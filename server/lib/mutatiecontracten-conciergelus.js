/* ============================================================================
   MUTATIECONTRACT -- de concierge-lus (kern/bureau/lus*.js, CONCIERGE.md).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm.
   Zestien routes: vijf aan de kant van het lid, tien aan de kant van het
   kantoor en een voor de zaak die een onderdeel levert.

   ================== HOE HET GEMETEN IS ==================

   test/conciergelus-dubbel.test.js roept elke schrijfroute twee keer aan met
   hetzelfde lijf, tegen een wegwerpserver, en vergelijkt daarna de case:
   stand, soort, aantal mogelijkheden, onderdelen en tijdlijnregels, de
   verrassing, de klaargezette berichten en de eigenaar. Na de tweede aanroep
   moet dat exact zijn wat het na de eerste was.

   Twee vormen van "beschermd", en ze zijn niet hetzelfde:
     - de tweede aanroep doet NIETS en krijgt 200 (neem, verrassing, weigering,
       aanbod, onderdeel, bevestig, vertraging, kapot, en intake met dezelfde
       sleutel): de route herkent de herhaling zelf;
     - de tweede aanroep wordt GEWEIGERD op de toestand (kies 409, beslis 400,
       verstuur 409). Dat is een toestandscontrole en geen idempotentie
       (MUTATIECONTRACT.md par. 5), maar de stand na twee aanroepen is die na een,
       en dat is wat PROTECTED hier belooft.

   Een route is met opzet een tweede handeling: een tweede toelichting is een
   tweede bericht van het lid, en die telt als zodanig (de toets bewijst +2).
   ========================================================================== */
'use strict';

const OP = '2026-09-30';
const AFGETEKEND = {
  door: 'Claude, op grond van test/conciergelus-dubbel.test.js en de handlers in kern/bureau/lus*.js; ' +
    'niet door een mens nagelezen',
  op: OP
};
const TOETS = 'test/conciergelus-dubbel.test.js';

const lid = (objectVeld) => ({ klasse: 'OBJECT_SCOPED', objectVeld,
  uitleg: 'de case uit `' + objectVeld + '`, en alleen een case van dit lid; een case van een ander lid geeft 404' });
const kantoor = { klasse: 'AUTHENTICATED', uitleg: 'de kantoordeur (officeAuth); het lid volgt uit `key`' };

const BESCHERMD = (route, mutatieId, toegang, hoe) => ({
  [route]: {
    mutatieId,
    semantiek: { klasse: 'idempotent' },
    toegang,
    stand: 'PROTECTED',
    herkomst: 'mens',
    afgetekend: AFGETEKEND,
    bewijs: { gemeten: TOETS + ': de tweede aanroep liet de case ongewijzigd. ' + hoe, op: OP }
  }
});

const LEEST = (route, mutatieId, toegang, wat) => ({
  [route]: {
    mutatieId,
    semantiek: { klasse: 'idempotent' },
    toegang,
    stand: 'NOT_APPLICABLE',
    herkomst: 'mens',
    afgetekend: AFGETEKEND,
    bewijs: { gemeten: TOETS + ': de lus leest na elke stap deze route en de stand bleef gelijk tussen twee lezingen', op: OP },
    nagekeken: 'Claude las de handler en alles wat hij aanroept: ' + wat + '. Geen schrijfvorm, geen bestand, geen uitgaand bericht.'
  }
});

const CONTRACTEN = Object.assign({},
  BESCHERMD('POST /api/member/bureau/lus/intake', 'bureau.lus.intake', { klasse: 'AUTHENTICATED' },
    'Dezelfde `sleutel` geeft dezelfde case terug (herhaald: true); zonder sleutel van 16 tekens weigert de route.'),
  LEEST('POST /api/member/bureau/lus/zaak', 'bureau.lus.lid', lid('id'),
    'vind() plus lus-regels.gastBericht/aanbodStand/tijdlijn, allemaal rekenen'),
  {
    'POST /api/member/bureau/lus/toelichting': {
      mutatieId: 'bureau.lus.toelichting',
      semantiek: { klasse: 'nietHerhaalbaar' },
      toegang: lid('id'),
      stand: 'INTENTIONALLY_NON_IDEMPOTENT',
      herkomst: 'mens',
      afgetekend: AFGETEKEND,
      bewijs: { gemeten: TOETS + ': twee toelichtingen gaven twee tijdlijnregels (+2)', op: OP },
      waarom: 'Een toelichting is een bericht van het lid. Twee keer hetzelfde zeggen is twee keer iets zeggen, ' +
        'en tijdens herstel telt het mee in opnieuwVerteld -- precies de maat die het moet laten zien.'
    }
  },
  BESCHERMD('POST /api/member/bureau/lus/verrassing', 'bureau.lus.verrassing', lid('id'),
    'Staat de verrassing al zo, dan geen tweede regel.'),
  BESCHERMD('POST /api/member/bureau/lus/beslis', 'bureau.lus.beslis', lid('id'),
    'De tweede krijgt 400: er ligt geen voorstel meer; een toestandscontrole.'),

  LEEST('POST /api/office/bureau/lus', 'bureau.lus.kantoor', kantoor,
    'vind() plus lus-regels.aanbodStand/tijdlijn/afsluitbaar, allemaal rekenen'),
  BESCHERMD('POST /api/office/bureau/lus/neem', 'bureau.lus.neem', kantoor,
    'Dezelfde eigenaar nog eens geeft geen tweede regel.'),
  BESCHERMD('POST /api/office/bureau/lus/weigering', 'bureau.lus.weigering', kantoor,
    'Dezelfde reden staat er al; de soort is al bijzonder.'),
  BESCHERMD('POST /api/office/bureau/lus/aanbod', 'bureau.lus.aanbod', kantoor,
    'Een vastgehouden aanbod met hetzelfde wat, dezelfde tijd en dezelfde zaak wordt teruggegeven in plaats van verdubbeld.'),
  BESCHERMD('POST /api/office/bureau/lus/kies', 'bureau.lus.kies', kantoor,
    'De tweede krijgt 409: er ligt al een voorstel bij het lid, of het aanbod is gekozen.'),
  BESCHERMD('POST /api/office/bureau/lus/onderdeel', 'bureau.lus.onderdeel', kantoor,
    'Een actief onderdeel met hetzelfde wat, dezelfde tijd en dezelfde zaak wordt teruggegeven.'),
  BESCHERMD('POST /api/office/bureau/lus/bevestig', 'bureau.lus.bevestig', kantoor,
    'Al bevestigd: geen tweede regel.'),
  BESCHERMD('POST /api/office/bureau/lus/vertraging', 'bureau.lus.vertraging', kantoor,
    'Dezelfde vertraging met berichten die al klaarstaan geeft dezelfde klaargezette set terug.'),
  BESCHERMD('POST /api/office/bureau/lus/verstuur', 'bureau.lus.verstuur', kantoor,
    'De tweede krijgt 409: de klaargezette berichten zijn al weg; er gaat geen tweede bericht naar een zaak.'),
  BESCHERMD('POST /api/office/bureau/lus/kapot', 'bureau.lus.kapot', kantoor,
    'Al omgevallen: geen tweede regel.'),

  LEEST('POST /api/supplier/concierge/opdrachten', 'bureau.lus.zaak', { klasse: 'AUTHENTICATED',
    uitleg: 'de zaakcode komt uit de sessie (supplierAuth), nooit uit het lijf' },
  'lusVoorZaak() over levens.alleLezend() en lus-regels.deelnemerBeeld, een positieve lijst velden')
);

module.exports = { CONTRACTEN };
