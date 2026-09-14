/* DE DAGCHECK-IN VOOR DE VLOER -- het contract van drie schrijfwegen.

   De routes staan in server/routes/staff/gemoed.js (ONDERNEMEN.md par. 7): de
   tweede deur naar kern/gemoed.js, voor personeel dat geen RTG-lid is.

   DE STANDEN HIERONDER ZIJN GEMETEN EN NIET AANGENOMEN. Dat is de volgorde die
   MUTATIECONTRACT.md eist: het bewijs draagt een voorstel, een mens draagt het
   besluit -- maar een besluit zonder meting eronder is een gok met een datum.
   De meting is toets 7 van test/staffgemoed.test.js, die alle drie de gevallen
   met een echte server naloopt. Zakt die toets, dan klopt dit register niet meer
   en hoort HET te worden herzien, niet de toets.

   EEN ONDERSCHEID DAT HIER NIET WEGGEPOETST WORDT. `/weg` laat bij een tweede
   aanroep dezelfde STAND achter (de dag is weg en blijft weg), maar het antwoord
   is 404 en niet 200. Dat is een TOESTANDSCONTROLE en geen duplicaatlaag: wat
   vaststaat is dat er geen tweede effect kan ontstaan, niet dat een dubbeltik
   wordt herkend. Dezelfde formulering als in ./mutatiecontracten-vertegenwoordiging.js,
   en om dezelfde reden -- wie die twee samenvoegt, leest straks een
   duplicaatgarantie waar er geen is. */
'use strict';

const OP = '2026-09-14';

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
    bewijs: BEWIJS
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
    bewijs: BEWIJS
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
    waarom: 'de tweede aanroep is een TOESTANDSCONTROLE: de dag is al weg, dus er ontstaat geen tweede ' +
      'effect, maar het antwoord is 404 en niet 200. Er wordt geen dubbeltik HERKEND; er valt er geen ' +
      'te maken.',
    bewijs: BEWIJS
  }
};

module.exports = { CONTRACTEN, AFGETEKEND };
