/* ============================================================================
   MUTATIECONTRACTEN -- DE VEERTIEN ROUTES VAN DE BESCHERMZAAK.

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm en de
   regels. Tien routes staan achter de kantoordeur (routes/rtfos/uitvoering.js,
   inclusief de brug naar de meldcode) en VIER staan zonder poort
   (routes/rtfos/voordeur.js); de klasse eronder is server/kern/beschermzaak/.

   WAAROM DIT REGISTER HIER EERST KWAM EN DE ROUTES DAARNA. MUTATIECONTRACT.md:
   "de volgorde is een grens en geen gewoonte". Deze veertien zijn nieuw, en een
   nieuwe schrijfroute zonder contract laat de bouw zakken.

   ALLE VEERTIEN ZIJN GEMETEN, NIET GERADEN. Er is een ronde gedraaid tegen een
   draaiende server waarin elke route TWEE keer werd aangeroepen met hetzelfde
   lijf, en waarin het gevolg is nagekeken in de opslag (aantal zaken, lengte
   van de overdrachtenlijst, aantal auditregels). Wat daaruit kwam staat per
   route in `bewijs.gemeten`, en het is drie keer iets anders:

     - vier routes doen bij een tweede aanroep AANTOONBAAR een tweede handeling
       (open, lees, overdracht, meldcode). Dat hoort zo, en waarom staat erbij.
     - vijf routes laten na twee aanroepen dezelfde stand achter (veiligheid,
       stand, toestemming, toestemming-weg, sluit).
     - drie routes veranderen niets (zaken, deur/steden, deur/stand).

   EN EEN VIERDE VORM, die alleen aan de voordeur voorkomt: deur/intrekken geeft
   bij een tweede oproep 200 met "dit was al ingetrokken" in plaats van een fout.
   Dat is ECHTE idempotentie en geen toestandscontrole, en het is een keuze over
   de mens: wie twijfelt en nog een keer drukt, hoort geen foutmelding te krijgen
   op het moment dat hij het al zwaar heeft.

   EN DE PRECISIE DIE MUTATIECONTRACT.md PAR. 5o EIST. Bij drie van die vijf
   (stand, toestemming-weg, sluit) komt de tweede aanroep terug met een 400 uit
   een TOESTANDSCONTROLE: "van minimaal naar minimaal kan niet", "er staat geen
   toestemming om in te trekken", "deze zaak is al gesloten". Dat is met opzet
   niet hetzelfde als een duplicaatlaag, en het staat daarom in het bewijs met
   zoveel woorden. Wie hier later een sleutellaag overheen legt, mag deze regels
   NIET lezen als "dat is al geregeld": wat vaststaat is dat de keten geen tweede
   effect toelaat, niet dat een dubbeltik ergens wordt herkend.
   ========================================================================== */
'use strict';

const { AFGETEKEND, OP } = require('./mutatiecontracten-beschermzaak-op');
const TOEGANG = { klasse: 'AUTHENTICATED' };


/* Een route die bij herhaling een tweede handeling doet, en waarom dat hoort. */
const tweedeHandeling = (route, mutatieId, waarom, gemeten, toegang) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'nietHerhaalbaar' },
  toegang: toegang || TOEGANG,
  stand: 'INTENTIONALLY_NON_IDEMPOTENT',
  waarom,
  bewijs: { gemeten, op: OP },
  afgetekend: AFGETEKEND
}];

/* Een route die na twee aanroepen dezelfde stand achterlaat. `hoe` zegt WAARDOOR
   -- een toewijzing of de keten -- want dat verschil is precies wat par. 5o
   verbiedt weg te poetsen. */
const zelfdeStand = (route, mutatieId, hoe) => [route, {
  mutatieId, herkomst: 'mens',
  semantiek: { klasse: 'idempotent' },
  toegang: TOEGANG,
  stand: 'PROTECTED',
  bewijs: {
    gemeten: 'dubbeltik-ronde: dezelfde aanroep twee keer liet dezelfde stand achter. ' + hoe,
    op: OP
  },
  afgetekend: AFGETEKEND
}];

/* De vier van de voordeur staan in ./mutatiecontracten-beschermzaak-deur.js.
   Ze zijn afgesplitst op de 10 KB van keuringsregel 13, en niet omdat ze minder
   wegen: ze zijn de enige van deze klasse zonder poort. */
const DEUR = require('./mutatiecontracten-beschermzaak-deur').CONTRACTEN;

const CONTRACTEN = Object.assign({}, DEUR, Object.fromEntries([
  tweedeHandeling('POST /api/rtfos/bescherming/open', 'rtfos.bescherming.open',
    'Twee meldingen over dezelfde mens zijn twee zorgen, en samenvoegen is hier gevaarlijker dan ' +
    'een dubbele zaak: wie ze samenvoegt, laat de tweede melding verdwijnen in het dossier van de ' +
    'eerste en leest hem misschien nooit. Dezelfde regel als bij de meldcode ("een nieuwe zorg is ' +
    'een nieuw dossier", kern/rtfos/meldcode.js). Een dubbele zaak valt op en is te sluiten; een ' +
    'verdwenen melding niet.',
    'twee keer hetzelfde lijf gaf TWEE zaken met verschillende codenamen (aantal +2)'),

  tweedeHandeling('POST /api/rtfos/bescherming/lees', 'rtfos.bescherming.lees',
    'Elke blik is een aparte blik. Deze route bestaat alleen om vast te leggen DAT iemand in een ' +
    'beschermzaak heeft gekeken; een tweede keer kijken dat geen tweede regel achterlaat, maakt ' +
    'het hele spoor waardeloos. Precies dezelfde reden als bij het openen van contactgegevens in ' +
    'kern/rtfos/casus-dossier.js.',
    'twee keer lezen gaf TWEE auditregels beschermzaak.gelezen'),

  tweedeHandeling('POST /api/rtfos/bescherming/overdracht', 'rtfos.bescherming.overdracht',
    'Een tweede overdracht aan dezelfde ontvanger is een tweede gebeurtenis: er is opnieuw iets ' +
    'over deze mens verteld, en hij heeft er recht op dat dat er staat. Samenvouwen zou de ' +
    'overdrachtenlijst laten liegen over hoe vaak zijn situatie is gedeeld.',
    'twee keer overdragen gaf twee regels in overdrachten (1 -> 2)'),

  zelfdeStand('POST /api/rtfos/bescherming/veiligheid', 'rtfos.bescherming.veiligheid',
    'De route ZET het antwoord (een toewijzing, geen toevoeging), dus de tweede oproep overschrijft ' +
    'hetzelfde antwoord en de stand van de zaak bleef gelijk.'),

  zelfdeStand('POST /api/rtfos/bescherming/toestemming', 'rtfos.bescherming.toestemming',
    'De route ZET de toestemming (een toewijzing), en de gemeten ontvanger was na twee oproepen ' +
    'dezelfde.'),

  zelfdeStand('POST /api/rtfos/bescherming/stand', 'rtfos.bescherming.stand',
    'De tweede oproep kwam terug met 400 uit de KETEN ("van minimaal kan niet naar minimaal"). ' +
    'Dat is een toestandscontrole en geen duplicaatlaag -- zie MUTATIECONTRACT.md par. 5o. Wat ' +
    'vaststaat is dat er geen tweede effect kan ontstaan, niet dat een dubbeltik wordt herkend.'),

  zelfdeStand('POST /api/rtfos/bescherming/toestemming-weg', 'rtfos.bescherming.toestemmingWeg',
    'De tweede oproep kwam terug met 400 ("er staat geen toestemming om in te trekken"). Ook hier: ' +
    'een toestandscontrole, geen duplicaatlaag (MUTATIECONTRACT.md par. 5o).'),

  zelfdeStand('POST /api/rtfos/bescherming/sluit', 'rtfos.bescherming.sluit',
    'De tweede oproep kwam terug met 400 ("deze zaak is al gesloten"), en de bewaartermijn van de ' +
    'eerste sluiting bleef staan. Een toestandscontrole, geen duplicaatlaag (par. 5o).'),

  tweedeHandeling('POST /api/rtfos/bescherming/meldcode', 'rtfos.bescherming.meldcode',
    'Dezelfde reden als bij /bescherming/open en bij de meldcode zelf: een nieuwe zorg is een nieuw ' +
    'dossier. Twee keer omzetten geeft twee meldcode-dossiers, en dat is hinderlijk maar veilig -- ' +
    'ze samenvouwen zou betekenen dat een tweede, latere zorg over dezelfde mens verdwijnt in het ' +
    'dossier van de eerste. De zaak onthoudt beide ids, dus de dubbeling is zichtbaar en te sluiten.',
    'dubbeltik-ronde: twee keer omzetten gaf TWEE meldcode-dossiers met verschillende ids (aantal ' +
    '+2), en de beschermzaak droeg ze allebei in haar meldcodes-lijst'),

  ['POST /api/rtfos/bescherming/zaken', {
    mutatieId: 'rtfos.bescherming.zaken', herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: TOEGANG,
    stand: 'NOT_APPLICABLE',
    nagekeken: 'Claude (Opus 5), 2026-09-02: de handler (lijst() in kern/beschermzaak/index.js) ' +
      'roept geen save() en geen audit() aan -- hij leest S().beschermzaken, filtert en geeft ' +
      'lijstbeeld() terug. De gemeten ronde bevestigde dat: twee oproepen, hetzelfde aantal, geen ' +
      'nieuwe regel in de opslag.',
    bewijs: {
      gemeten: 'dubbeltik-ronde: twee keer opvragen gaf hetzelfde aantal en liet geen spoor na',
      op: OP
    },
    afgetekend: AFGETEKEND
  }]
]));

module.exports = { CONTRACTEN, AFGETEKEND, OP };
