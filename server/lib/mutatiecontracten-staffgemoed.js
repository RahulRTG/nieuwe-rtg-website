/* DE DAGCHECK-IN VOOR DE VLOER -- het contract van drie schrijfwegen.

   De routes staan in server/routes/staff/gemoed.js (ONDERNEMEN.md par. 7): de
   tweede deur naar kern/gemoed.js, voor personeel dat geen RTG-lid is.

   DE STANDEN HIERONDER ZIJN GEMETEN EN NIET AANGENOMEN. Dat is de volgorde die
   MUTATIECONTRACT.md eist: het bewijs draagt een voorstel, een mens draagt het
   besluit -- maar een besluit zonder meting eronder is een gok met een datum.
   De meting is toets 7 van test/staffgemoed.test.js, die alle drie de gevallen
   met een echte server naloopt. Zakt die toets, dan klopt dit register niet meer
   en hoort HET te worden herzien, niet de toets.

   EEN ONDERSCHEID DAT HIER NIET WEGGEPOETST WORDT -- EN DAT SINDS 15 SEPTEMBER
   2026 ANDERS LIGT VOOR `/weg`.

   Tot die dag gaf een tweede aanroep van `/weg` dezelfde STAND (de dag is weg en
   blijft weg) maar een ANDER antwoord: 404 in plaats van 200. Dat was een
   toestandscontrole en geen duplicaatlaag, en dat stond hier met zoveel woorden.

   Sinds ./idemsleutels-ondernemerslus.js draagt de route een verklaarde sleutel,
   en daarmee geeft de poort binnen het venster het EERSTE antwoord terug. Er
   wordt nu dus wel degelijk een dubbeltik herkend. Die zin is daarom hieronder
   vervangen in plaats van blijven staan: een register dat een garantie ontkent
   die inmiddels bestaat, is net zo onwaar als een register dat er een belooft
   die er niet is.

   Voor `/zet` verandert er niets aan de STAND -- een dag heeft hooguit een regel
   en die wordt overschreven -- maar de sleutel noemt daar met opzet OOK de
   notitie. Waarom dat nodig was (vrije tekst valt buiten de afdruk, dus een
   bijgewerkte notitie zou zijn opgeslokt) staat in de kop van dat bestand. */
'use strict';

const OP = '2026-09-14';

/* DE AFTEKENING STOND HIER WEL EN HING NERGENS AAN, en dat is een fout die het
   register zelf heeft gevonden: `AFGETEKEND` werd gedefinieerd, geexporteerd en
   in een tekst verwerkt, maar geen van de drie rijen droeg het VELD. Drie toetsen
   in test/mutatiecontract.test.js zakten daarop, en een ervan viel om op een
   TypeError in plaats van op zijn eigen melding -- die leest als een stuk toets
   en niet als een leeg veld. Wie hier een rij bijzet, zet `afgetekend` erbij:
   een aftekening die alleen in een constante bestaat, tekent niets af.

*/
/* DE AFTEKENING IS EERLIJK OVER WAT ZE IS. Opgesteld door Claude op grond van de
   dubbeltik-meting in toets 7, die in dezelfde sessie is gedraaid -- niet door
   een mens die de drie handlers regel voor regel heeft nagelezen. Wie dat wel
   doet, vervangt deze regel door zijn naam. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gedraaide dubbeltik-meting in test/staffgemoed.test.js toets 7; ' +
    'niet door een mens nagelezen',
  op: OP
};

/* De deur is supplierAuth PLUS de eis van een persoonlijke login. Dat tweede is
   geen bevoegdheid uit kern/bevoegdheid/lijst.js maar een eigenschap van de
   sessie (`req.actor.staffId`), dus de klasse blijft AUTHENTICATED: elke
   ingelogde MEDEWERKER mag hier, en het bedrijfsaccount is geen medewerker. */
const TOEGANG = { klasse: 'AUTHENTICATED', deur: 'supplierAuth' };

const BEWIJS = {
  gemeten: 'test/staffgemoed.test.js toets 7: twee identieke aanroepen tegen een echte server, ' +
    'met de opslagstand ervoor en erna vergeleken',
  op: OP
};

const CONTRACTEN = {
  /* LEZEN. `gemoedVan()` roept `recent()` aan, dat via kijk() leest en geen lege
     rij achterlaat -- zie de kop van kern/eigencollectie.js. Gemeten: de reeks
     is voor en na het lezen gelijk. */
  'POST /api/staff/gemoed': {
    mutatieId: 'gemoed.lezen.staff',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: TOEGANG,
    stand: 'NOT_APPLICABLE',
    nagekeken: AFGETEKEND.door + ' -- ' + AFGETEKEND.op,
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },

  /* SCHRIJVEN. Een dag heeft hooguit een regel: bestaat hij al, dan wordt hij
     OVERSCHREVEN in plaats van aangevuld (kern/gemoed.js, `bestaat` in
     gemoedZet). Twee identieke aanroepen laten dus exact een dag achter met
     dezelfde inhoud -- gemeten, niet afgeleid uit het lezen van die regel. */
  'POST /api/staff/gemoed/zet': {
    mutatieId: 'gemoed.zetten.staff',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: TOEGANG,
    stand: 'PROTECTED',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },

  /* WISSEN. Zie de kop: de stand is na twee keer dezelfde, het antwoord niet.
     `waarom` staat erbij hoewel de stand PROTECTED is, want zonder die zin leest
     dit contract als een duplicaatgarantie. */
  'POST /api/staff/gemoed/weg': {
    mutatieId: 'gemoed.wissen.staff',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: TOEGANG,
    stand: 'PROTECTED',
    waarom: 'de dag is na een tweede aanroep nog steeds weg, dus er ontstaat geen tweede effect. Sinds ' +
      'de verklaarde sleutel in ./idemsleutels-ondernemerslus.js wordt een dubbeltik binnen het venster ' +
      'ook HERKEND: de poort geeft dan het eerste antwoord (200 met de gewiste dag) in plaats van de ' +
      '404 die de handler zelf zou geven. Buiten het venster is het weer 404, en dat is het venster en ' +
      'geen inconsistentie.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN, AFGETEKEND };
