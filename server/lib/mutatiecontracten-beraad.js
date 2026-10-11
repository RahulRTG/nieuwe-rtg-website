/* ============================================================================
   DE MUTATIECONTRACTEN VAN HET BERAAD (B3, kern/beraad/).

   EERST GEMETEN, DAN VERKLAARD. Elke route is in test/beraad-server.test.js
   toets 6 twee keer met hetzelfde lijf aangeroepen tegen een echte server.

   Twee soorten herhaling, en ze staan apart:
   - de DUPLICAATLAAG vangt een dubbeltik op openen en inbrengen
     (./idemsleutels-beraad.js): een beraad en een inbreng, niet twee;
   - de ROUTE ZELF herkent een herhaling bij voorstel, naar stemmen, stem,
     sluiten en gezien, en weigert hem met 409 bij heropenen. Die zes staan met
     opzet NIET in de duplicaatlaag (./idemsleutels-nooit-beraad.js): binnen het
     venster zou een afgespeeld antwoord een tussentijdse wijziging ongedaan
     maken -- voor, tegen, weer voor bleef dan op tegen staan.

   Alle routes hangen aan `auth` + `geenGast` en de poort in kern/beraad/index.js
   eist lidmaatschap van het genootschap. Dat is een IDENTITEIT plus een
   lidmaatschap, en de klasse is daarom AUTHENTICATED -- een zwaardere klasse
   opschrijven dan er staat, maakt het register een verlanglijst. */
'use strict';

const OP = '2026-10-11';
const AFGETEKEND = {
  door: 'Claude (Opus 5.5), op grond van test/beraad-server.test.js toets 6 en test/beraad.test.js; ' +
    'niet door een mens nagelezen',
  op: OP
};
const LID = { klasse: 'AUTHENTICATED', deur: 'auth' };

const leest = (pad, mutatieId, hoe) => ['POST /api/beraad/' + pad, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: LID,
  stand: 'NOT_APPLICABLE',
  bewijs: { gemeten: 'test/beraad-server.test.js toets 6 (' + OP + '): twee keer 200 met een byte voor byte gelijk antwoord. ' + hoe, op: OP },
  nagekeken: 'de handler roept alleen eigen.kijk() aan, dat een ontbrekende collectie niet aanmaakt',
  afgetekend: AFGETEKEND
}];

const schrijft = (pad, mutatieId, bewijs) => ['POST /api/beraad/' + pad, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: LID,
  stand: 'PROTECTED',
  bewijs: { gemeten: 'test/beraad-server.test.js toets 6 (' + OP + '): ' + bewijs, op: OP },
  afgetekend: AFGETEKEND
}];

const CONTRACTEN = Object.fromEntries([
  leest('mijn', 'beraad.mijn', 'De eigen beraden en de terugkoppeling op de sleutel uit de sessie.'),
  leest('lees', 'beraad.lees', 'Een beraad voor een lid van zijn genootschap; geen stemmenkaart, geen tussenstand.'),
  leest('hulp', 'beraad.hulp', 'Rahul: samenvatting, perspectieven of concept op een bevroren leesweergave; er wordt niets bewaard.'),
  schrijft('open', 'beraad.open',
    'een dubbeltik gaf via de duplicaatlaag hetzelfde beraad terug, en er stond er een in de lijst.'),
  schrijft('inbreng', 'beraad.inbreng',
    'een dubbeltik gaf een inbreng en niet twee. Intrekken nog eens geeft herhaling en verandert niets.'),
  schrijft('voorstel', 'beraad.voorstel',
    'dezelfde tekst nog eens gaf herhaling en bleef op versie 1; de stemmen bleven staan. Een andere tekst is met opzet een nieuwe versie.'),
  schrijft('naar-stemmen', 'beraad.naar-stemmen', 'de tweede gaf herhaling en de bevriezing bleef dezelfde.'),
  schrijft('stem', 'beraad.stem',
    'dezelfde keuze nog eens gaf herhaling; voor, tegen, weer voor binnen een paar seconden eindigde op voor.'),
  schrijft('sluit', 'beraad.sluit',
    'de tweede gaf herhaling met een byte voor byte gelijke eindstand, en de ontvanger kreeg een bericht en niet twee.'),
  schrijft('terugkoppeling-gezien', 'beraad.gezien', 'eerst 1 bewogen, daarna 0: een trede gaat nooit terug.'),
  schrijft('heropen', 'beraad.heropen',
    'de tweede gaf 409 zolang de nieuwe ronde loopt en er ontstond geen derde ronde. Een toestandscontrole.')
]);

module.exports = { CONTRACTEN };
