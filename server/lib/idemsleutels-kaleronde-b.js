/* ============================================================================
   IDEM-SLEUTELS -- DE KALE RONDE, DE ANDERE KANT.

   Deel van ./idemsleutels.js; ./idemsleutels-kaleronde.js draagt de routes uit
   dezelfde ronde die je juist WEL wilt dedupliceren. Dit zijn de routes die je
   met opzet NIET dedupliceert, en dat is de moeilijkere helft.

   Een laag die hier de tweede oproep opslikt, laat werk verdwijnen zonder dat
   iemand het merkt -- dezelfde fout als bij /api/muziek/maak in ./idemsleutels.js,
   maar dan een die je pas mist als je hem nodig had. Vandaar dat elke regel een
   REDEN draagt en niet alleen een vlag: de vlag is te typen, de reden vraagt dat
   je de handler hebt gelezen.

   Drie soorten staan hieronder, en ze verschillen echt:

     RONDES        een controle, een opruiming, een bijwerkronde. De tweede ronde
                   hoort met recht iets anders te vinden dan de eerste -- dat is
                   niet toevallig, dat is het BEWIJS dat de eerste werkte.
     INZAGE        een raadpleging die een journaalregel schrijft. Twee keer in
                   een leerlingdossier kijken is twee keer kijken, en het
                   inzagejournaal hoort dat allebei te dragen. Dedupliceren maakt
                   daar van een privacywaarborg een gemiddelde.
     MOMENTEN      een pols, een alarm, een locatiemelding, een vraag aan de AI.
                   Twee keer is twee keer, ook als de inhoud gelijk is.

   Dat laatste is niet theoretisch: /api/supplier/security is een alarmknop, en
   een laag die de tweede druk opslikt kan iemand in nood stil laten staan.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* ---- en de andere kant: een tweede aanroep IS een tweede handeling ----

     Deze kregen GEEN duplicaatregel, en dat is de moeilijkere helft van dit
     bestand. Een laag die hier de tweede oproep opslikt, laat werk verdwijnen
     zonder dat iemand het merkt -- dezelfde fout als bij /api/muziek/maak
     hierboven, maar dan een die je pas mist als je hem nodig had. */
  'POST /api/appstore/kantoor/hercontrole': { nietIdempotent: true,
    waarom: 'een hercontroleronde toetst de gekeurde apps opnieuw tegen wat er NU draait; twee keer ' +
      'draaien hoort twee uitslagen te geven, anders keurt de tweede ronde de eerste' },
  'POST /api/command/incident/weeg': { nietIdempotent: true,
    waarom: 'een weging is een momentopname van de incidenten van dat moment; twee keer wegen hoort ' +
      'twee oordelen te geven' },
  'POST /api/command/operator/plan': { nietIdempotent: true,
    waarom: 'een plan wordt opnieuw opgesteld uit de stand van dat moment; de tweede vraag is een ' +
      'tweede plan en niet hetzelfde antwoord' },
  'POST /api/supplier/command/operator/plan': { nietIdempotent: true,
    waarom: 'zelfde reden als de kantoorkant: een plan is een momentopname' },
  'POST /api/office/bank/regels/check': { nietIdempotent: true,
    waarom: 'de regelwacht draait zijn controles opnieuw; twee keer controleren hoort twee uitslagen ' +
      'te geven, anders kijkt de tweede ronde naar de eerste' },
  'POST /api/office/partner/regels/check': { nietIdempotent: true,
    waarom: 'zelfde reden als de bank-regelwacht' },
  'POST /api/office/rechtsvormwacht/check': { nietIdempotent: true,
    waarom: 'zelfde reden: een wacht die je twee keer laat kijken, hoort twee keer te kijken' },
  'POST /api/office/payroll/regels/haal': { nietIdempotent: true,
    waarom: 'een bijwerkronde haalt op wat er sinds de vorige ronde veranderd is; de tweede ronde ' +
      'vindt met recht iets anders dan de eerste' },
  'POST /api/office/onderzoeker/ontwikkel': { nietIdempotent: true,
    waarom: 'een ontwikkelronde zet de volgende stap; twee keer is twee stappen' },
  'POST /api/office/boardroom/verbeter': { nietIdempotent: true,
    waarom: 'de verbeterkamer stelt voor op grond van de stand van dat moment' },
  'POST /api/office/weefsel/reeks/veeg': { nietIdempotent: true,
    waarom: 'een opruimronde ruimt op wat er NU over de bewaartermijn is; de tweede ronde vindt met ' +
      'recht minder dan de eerste, en dat is geen dubbeltik maar het bewijs dat de eerste werkte' },
  'POST /api/office/zelfzorg/bescherm': { nietIdempotent: true,
    waarom: 'een beschermronde beoordeelt de stand van dat moment; twee rondes zijn twee oordelen' },
  'POST /api/office/zelfzorg/herstel': { nietIdempotent: true,
    waarom: 'een reparatieronde repareert wat er NU stuk is; de tweede ronde hoort minder te vinden' },
  'POST /api/office/zelfzorg/opruim': { nietIdempotent: true,
    waarom: 'zelfde reden als de weefsel-veeg: opruimen is geen toestand maar een handeling' },
  'POST /api/office/zelfzorg/upgrade': { nietIdempotent: true,
    waarom: 'een upgraderonde zet het schema een versie verder; de route meldt zelf "stond al klaar" ' +
      'als er niets te doen was, en dat antwoord hoort niet door een cache te worden vervangen' },
  'POST /api/techniek/controle/integriteit': { nietIdempotent: true,
    waarom: 'een integriteitscontrole vergelijkt de LIVE code met het releasebewijs; twee keer ' +
      'controleren hoort twee keer te kijken, anders bewijst de tweede ronde de eerste' },

  /* Inzage die een journaalregel schrijft -- en juist DAAR mag niet worden
     gededupliceerd. Twee keer in een leerlingdossier kijken is twee keer kijken,
     en het inzagejournaal hoort dat allebei te dragen. Een laag die de tweede
     raadpleging opslikt, maakt van een privacywaarborg een gemiddelde. */
  'POST /api/foundation/school/export': { nietIdempotent: true,
    waarom: 'elke export schrijft een regel in het schooljournaal; twee keer exporteren is twee keer ' +
      'inzage en hoort twee regels te geven' },
  'POST /api/foundation/school/incident/lijst': { nietIdempotent: true,
    waarom: 'het opvragen van de incidentenlijst wordt gelogd met een reden; dedupliceren zou een ' +
      'tweede raadpleging onzichtbaar maken' },
  'POST /api/foundation/school/ontruiming': { nietIdempotent: true,
    waarom: 'de ontruimingslijst draagt namen van kinderen en elke raadpleging wordt gelogd; twee ' +
      'keer opvragen hoort twee regels te geven' },
  'POST /api/supplier/zegel/check': { nietIdempotent: true,
    waarom: 'een ID- of leeftijdscheck is een gebeurtenis die in het activiteitenlog hoort; twee ' +
      'keer scannen is twee keer gecontroleerd' },

  /* Momenten en meldingen. */
  'POST /api/residentie/pols': { nietIdempotent: true,
    waarom: 'een pols is een momentopname van wie er in de residentie is' },
  'POST /api/residentie/emote': { nietIdempotent: true,
    waarom: 'twee keer zwaaien is twee keer zwaaien' },
  'POST /api/residentie/betreed': { nietIdempotent: true,
    waarom: 'een kamer betreden is een gebeurtenis die anderen zien; de tweede keer is een tweede keer' },
  'POST /api/foundation/gezin/locatie': { nietIdempotent: true,
    waarom: 'een locatiemelding is een moment; twee meldingen achter elkaar zijn twee momenten, ook ' +
      'als de coordinaten toevallig gelijk zijn' },
  'POST /api/supplier/security': { nietIdempotent: true,
    waarom: 'een alarm is een alarm. Twee keer drukken hoort twee keer te alarmeren -- een laag die ' +
      'de tweede opslikt, kan iemand in nood stil laten staan' },
  'POST /api/supplier/team/buzz': { nietIdempotent: true,
    waarom: 'een tweede buzz is een tweede keer roepen, en dat is meestal juist de bedoeling' },
  'POST /api/foundation/school/bijles/vraag': { nietIdempotent: true,
    waarom: 'dezelfde vraag twee keer stellen hoort twee antwoorden te geven; een leerling die het ' +
      'niet snapte, vraagt het opnieuw' },
  'POST /api/member/lifestyle/concierge/vraag': { nietIdempotent: true,
    waarom: 'zelfde reden: een tweede vraag is een tweede vraag' },
  'POST /api/kantoorpakket/maak': { nietIdempotent: true,
    waarom: 'zelfde route als /api/office/kantoorpakket/maak hierboven: de titel is optioneel en valt ' +
      'terug op "Nieuw document", dus twee lege oproepen zijn twee verse documenten' },
  'POST /api/werkplek/kantoorpakket/maak': { nietIdempotent: true,
    waarom: 'zelfde reden als de twee andere kantoorpakket-routes' },

  /* ---- en de laatste die het NIET zijn ---- */
  'POST /api/office/bank/draai': { nietIdempotent: true,
    waarom: 'de bankknop gaat een SLAG verder (of terug); twee keer drukken is twee slagen, en een ' +
      'laag die de tweede opslikt laat de stand achter waar hij niet hoort' },
  'POST /api/overheid/rijbewijs/verleng': { nietIdempotent: true,
    waarom: 'verlengen schuift de geldigheid op; twee keer verlengen is twee termijnen, niet dezelfde ' +
      'nog eens' },
  'POST /api/supplier/horeca/rahul/doe': { nietIdempotent: true,
    waarom: 'een handeling laten uitvoeren met een reden; twee keer vragen is twee keer doen, en welke ' +
      'handeling dat is staat in de body en niet in deze laag' },
  'POST /api/foundation/gezin/bericht': { nietIdempotent: true,
    waarom: 'twee keer hetzelfde sturen is twee berichten -- mensen herhalen zichzelf, en een laag die ' +
      'dat opslikt laat een bericht verdwijnen dat iemand bewust nog eens stuurde' },
  /* DRIE KOSTEN-ROUTES STONDEN HIER EN ZIJN ERAF, want ze waren dubbel en fout.
     Ze stonden al in ./idemsleutels-kosten.js als `leest` (de laatste won stil --
     zie ./idemsleutels-eenmaal.js), en de reden hier is achterhaald: besluit van
     de eigenaar, 30 augustus 2026, een tik van de kostenmeter is RUIS en geen
     werk. Anders wordt elke leesroute niet-idempotent zodra de meter hem raakt. */
};

module.exports = { SLEUTELS };
