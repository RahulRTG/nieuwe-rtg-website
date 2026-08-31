/* ============================================================================
   MUTATIECONTRACTEN -- DE ROUTES DIE MET OPZET EEN TWEEDE HANDELING DOEN.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels.

   HUN BEDOELING KOMT UIT IDEMBESLUIT.json, en die is ouder dan dit register.
   Daar staat per route waarom een herhaling mag: een code-maker HOORT elke keer
   iets nieuws te geven, een teller hoort op te hogen, en bij een `creatie` is
   besloten dat een tweede item hinderlijk is maar geen geld raakt. Dat zijn
   besluiten van een mens, met de reden erbij -- precies wat deze stand eist.

   WAT ERBIJ MOEST KOMEN IS HET BEWIJS. `INTENTIONALLY_NON_IDEMPOTENT` vraagt een
   reden EN een meting, want "het hoort zo" en "het gebeurt ook zo" zijn twee
   beweringen. Voor deze tweeendertig zijn ze allebei waar: de kale ronde zonder
   enige sleutel mat dat de herhaling het werk werkelijk opnieuw deed.

   DE ANDERE KANT VAN DIE EIS, en die is hier zichtbaar: van de 127 besluiten in
   IDEMBESLUIT.json halen er maar tweeendertig deze lijst. Vier en veertig zijn
   `berekening` of `instelling` -- die horen bij een andere stand en wachten op
   iemand die de handler naleest -- en vierendertig zijn (nog) niet gemeten. Een
   besluit zonder meting is hier geen contract, hoe goed het besluit ook is.
   ========================================================================== */
'use strict';

/* DE AFTEKENING, EN ZIJ IS EERLIJK OVER WAT ZE IS. Deze contracten zijn opgesteld
   door Claude op grond van een MEETING plus een bestaand besluit -- niet door een
   mens die ze een voor een heeft gelezen. Dat verschil hoort in het register te
   staan en niet gladgestreken te worden: "gemeten en voorgesteld" is iets anders
   dan "door een mens beoordeeld", en dat onderscheid houdt de rest van dit
   register overeind.

   Wie er een naleest en er zijn naam onder wil zetten, vervangt hem hier. */
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gemeten kale ronde plus het bestaande besluit; ' +
    'niet door een mens nagelezen',
  op: '2026-08-30'
};


/* DE REDEN STAAT AL IN IDEMBESLUIT.json, DUS HIER NIET NOG EENS.

   Tweeendertig keer een reden overtypen is niet alleen lang -- het is twee
   plekken die uiteen gaan lopen. Wie daar een besluit bijstelt, verandert hier
   niets, en dan draagt dit register een reden die niemand meer meent.

   Deze functie leest de reden bij het opbouwen op uit het register zelf. Staat
   een route daar niet meer in, dan valt hij hier hard om -- en dat hoort: een
   contract zonder reden is geen contract. */
const fs = require('fs');
const path = require('path');

const BESLUITEN = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'IDEMBESLUIT.json'), 'utf8'));
  } catch (e) { return { routes: {}, klassen: {} }; }
})();

const BEWIJS = {
  gemeten: 'kale ronde zonder sleutel: de herhaling deed het werk OPNIEUW -- precies wat deze klasse ' +
    'zegt dat er hoort te gebeuren',
  op: '2026-08-29'
};

const tweedeHandeling = (pad, mutatieId, klasse) => {
  /* DE ROUTE MOET IN IDEMBESLUIT.json STAAN, en dat is de kern van de eis: het
     is de handeling waarmee een mens deze route in een klasse zette. Verdwijnt
     hij daar, dan valt de grond onder dit contract weg en hoort de bouw om te
     vallen -- niet stil terug te vallen op een algemene klassetekst. Die eerste
     opzet deed dat wel, en de mutatieproef liet er niets van zakken. */
  const besluit = (BESLUITEN.routes || {})[pad];
  if (!besluit) {
    throw new Error('mutatiecontracten-tweedehandeling: ' + pad + ' staat niet (meer) in ' +
      'IDEMBESLUIT.json. Dat register IS de plek waar een mens deze route in een klasse zette; ' +
      'zonder die regel is dit contract een bewering zonder grond.');
  }
  /* EIGEN REDEN OF KLASSEREDEN, EN DAT VERSCHIL BLIJFT STAAN. Zeven van de
     tweeendertig dragen een reden die over DEZE route gaat; de andere
     vijfentwintig staan in een klasse waarvan de reden voor de hele klasse
     geldt. Dat tweede is een besluit -- iemand heeft deze route daar bewust in
     gezet -- maar het is een zwakkere grond dan de eerste, en het contract zegt
     dat er dan bij. */
  const eigen = besluit.reden;
  const reden = eigen || (BESLUITEN.klassen || {})[klasse];
  if (!reden) {
    throw new Error('mutatiecontracten-tweedehandeling: geen reden voor ' + pad + ' en geen ' +
      'beschrijving voor klasse "' + klasse + '" in IDEMBESLUIT.json.');
  }
  return ['POST ' + pad, {
    mutatieId, herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: reden + (eigen ? ' (eigen reden bij deze route in IDEMBESLUIT.json, klasse "' + klasse + '")'
      : ' (de reden van de KLASSE "' + klasse + '" in IDEMBESLUIT.json; deze route heeft daar geen eigen ' +
        'reden, dus de grond is de indeling en niet een uitspraak over juist deze handeling)'),
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  }];
};

const CONTRACTEN = Object.fromEntries([
  tweedeHandeling('/api/command/zaak/open', 'command.zaak.open', 'creatie'),
  tweedeHandeling('/api/concern/opname/maak', 'concern.opname.maak', 'creatie'),
  tweedeHandeling('/api/live/start', 'live.start', 'creatie'),
  tweedeHandeling('/api/mediaos/samen/start', 'mediaos.samen.start', 'creatie'),
  tweedeHandeling('/api/meet/maak', 'meet.maak', 'creatie'),
  tweedeHandeling('/api/member/pin/live', 'member.pin.live', 'code-maker'),
  tweedeHandeling('/api/muziek/maak', 'muziek.maak', 'creatie'),
  tweedeHandeling('/api/office/architect/project', 'office.architect.project', 'creatie'),
  tweedeHandeling('/api/office/atelier/collectie', 'office.atelier.collectie', 'creatie'),
  tweedeHandeling('/api/office/kantoorpakket/maak', 'office.kantoorpakket.maak', 'creatie'),
  tweedeHandeling('/api/office/redactie/artikel/maak', 'office.redactie.artikel.maak', 'creatie'),
  tweedeHandeling('/api/office/studio/collectie', 'office.studio.collectie', 'creatie'),
  tweedeHandeling('/api/office/studio/maak', 'office.studio.maak', 'creatie'),
  tweedeHandeling('/api/office/weefsel/werk/maak', 'office.weefsel.werk.maak', 'creatie'),
  tweedeHandeling('/api/office/werkplaats/maak', 'office.werkplaats.maak', 'creatie'),
  tweedeHandeling('/api/onderneming/nieuw', 'onderneming.nieuw', 'creatie'),
  tweedeHandeling('/api/pay/kascode', 'pay.kascode', 'code-maker'),
  tweedeHandeling('/api/pay/tikcode', 'pay.tikcode', 'code-maker'),
  tweedeHandeling('/api/salon/plaats', 'salon.plaats', 'creatie'),
  tweedeHandeling('/api/samen/maak', 'samen.maak', 'creatie'),
  tweedeHandeling('/api/supplier/agenda/toevoegen', 'supplier.agenda.toevoegen', 'creatie'),
  tweedeHandeling('/api/supplier/horeca/bon/maak', 'supplier.horeca.bon.maak', 'creatie'),
  tweedeHandeling('/api/supplier/horeca/rekening/open', 'supplier.horeca.rekening.open', 'creatie'),
  tweedeHandeling('/api/supplier/horeca/simulatie/maak', 'supplier.horeca.simulatie.maak', 'creatie'),
  tweedeHandeling('/api/supplier/kantoorpakket/maak', 'supplier.kantoorpakket.maak', 'creatie'),
  tweedeHandeling('/api/wallet/voeg', 'wallet.voeg', 'creatie'),
  tweedeHandeling('/api/drm/report', 'drm.report', 'creatie'),
  tweedeHandeling('/api/bank/rekening/open', 'bank.rekening.open', 'creatie'),
  tweedeHandeling('/api/bijles/vraag', 'bijles.vraag', 'creatie'),
  tweedeHandeling('/api/member/leren/schrijf-bewaar', 'member.leren.schrijf-bewaar', 'creatie'),
  tweedeHandeling('/api/office/kamer/taak', 'office.kamer.taak', 'creatie'),
  tweedeHandeling('/api/wereld/profiel/van', 'wereld.profiel.van', 'teller'),
]);

module.exports = { CONTRACTEN };
