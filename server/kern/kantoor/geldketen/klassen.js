/* DE HANDELINGSKLASSEN EN DE KETENS -- de strenge definitie van "volledig".

   AFGESPLITST VAN ../geldketen.js toen dat bestand over de 10 KB ging, en de naad
   is echt: dit is een REGISTER (data met een reden per regel, geen logica) en de
   baan ernaast is een machine. Het staat hier apart om dezelfde reden als
   kern/livinglab/kader.js: juist een tabel die elders wordt nagerekend, mag niet
   op twee plekken staan.

   HIER RUST `VOLLEDIGE_KETENS` OP (MACHINEDEKKING.json). scripts/machinedekking.js
   LEEST dit bestand en kopieert het niet: een meter die zelf mag bepalen wanneer
   hij tevreden is, meet zijn eigen tevredenheid.
*/
'use strict';

/* ---------------------------------------------------------------------------
   DE HANDELINGSKLASSEN -- welke assen zijn VERPLICHT, en waarom die en niet meer.

   Dit is de strenge definitie waar `VOLLEDIGE_KETENS` in MACHINEDEKKING.json op
   rust, en zij staat hier en niet in de meter: een meter die zelf mag bepalen
   wanneer hij tevreden is, meet zijn eigen tevredenheid.

   TWEE KLASSEN, EN HET VERSCHIL IS GEEN NUANCE. Het scheelt precies een as, en
   die as is `atomair`:

     geld-eenmalig   EEN geldbeweging. Half lukken bestaat niet, dus alles-of-niets
                     is de juiste garantie en `atomair` is verplicht.
     geld-reeks      N ONAFHANKELIJKE geldbewegingen (een incassoronde int bij
                     honderd leden van honderd eigen rekeningen). Hier is
                     alles-of-niets de VERKEERDE garantie: dat een lid te weinig
                     saldo heeft, mag de inning bij de andere negenennegentig niet
                     tegenhouden. Verplicht is dan wat er wel hoort: elke post
                     draagt zijn eigen sleutel en de ronde is HERVATBAAR.

   Wie die twee samenvoegt, krijgt of een onhaalbare eis of een lege belofte. Dat
   onderscheid is de reden dat dit register bestaat en niet een lijst van dertien
   vinkjes.
   ------------------------------------------------------------------------- */
/* EN `uitvoering` STAAT ER OMDAT HIJ ER NIET STOND, en dat gat is met een mutatie
   gevonden. De e2e-proef liet de uitvoering buiten de keten om lopen (de ronde
   rechtstreeks aanroepen in plaats van via voornemen.voerUit) en GEEN ENKELE toets
   zakte: het geld bewoog, het dossier zag er rond uit, want de vijftien verplichte
   assen gingen allemaal over het KLAARZETTEN. Een keten die alleen zijn
   voorbereiding eist, bewijst niets over de handeling zelf -- precies de faalvorm
   die deze hele laag moet uitsluiten. Vandaar een zestiende as die zegt: de
   uitvoering IS door de baan gegaan (vingerafdruk nagekeken, bewijstoken ingeleverd,
   veiligheidskern langs). */
const KLASSEN = Object.freeze({
  'geld-eenmalig': Object.freeze({
    wat: 'een handeling die EEN geldbeweging doet',
    verplicht: Object.freeze(['mensbewijs', 'assurance', 'mandaat', 'streefstand', 'voornemen',
      'autoriteit', 'tegenfeit', 'bewijsDraagt', 'frictie', 'tweedeMens', 'idempotentie',
      'atomair', 'envelop', 'bewijsketen', 'gevolg', 'uitvoering']),
    waaromNiet: Object.freeze({
      hervatbaar: 'bij EEN geldbeweging is er niets om op te pakken: hij gaat heel door of ' +
        'helemaal niet, en dat is precies wat `atomair` hier verplicht stelt. Hervatbaarheid eisen ' +
        'zou een tweede poging op een half effect goedkeuren.',
    }),
  }),
  'geld-reeks': Object.freeze({
    wat: 'een handeling die N onafhankelijke geldbewegingen doet',
    verplicht: Object.freeze(['mensbewijs', 'assurance', 'mandaat', 'streefstand', 'voornemen',
      'autoriteit', 'tegenfeit', 'bewijsDraagt', 'frictie', 'tweedeMens', 'idempotentie',
      'hervatbaar', 'envelop', 'bewijsketen', 'gevolg', 'uitvoering']),
    waaromNiet: Object.freeze({
      atomair: 'alles-of-niets is hier de VERKEERDE garantie: een incassoronde int bij honderd ' +
        'leden van honderd eigen rekeningen, en dat een van hen te weinig saldo heeft mag de inning ' +
        'bij de andere negenennegentig niet tegenhouden. Wat er in de plaats komt is `hervatbaar`: ' +
        'elke post draagt zijn eigen sleutel en een mislukte post blijft staan in plaats van de ' +
        'ronde om te gooien.',
    }),
  }),
});

/* ---------------------------------------------------------------------------
   DE KETENS -- welke handelingen lopen de baan werkelijk, en over welke routes.

   Een keten is hier met opzet MEER dan een route: de baan van een geldhandeling
   loopt over drie menselijke stappen (klaarzetten, tekenen, uitvoeren) en dus over
   drie routes. Een keten-teller die per route meet, zou daarom nooit iets kunnen
   vinden -- en dat is precies waarom `VOLLEDIGE_KETENS` over deze declaratie
   rekent en niet over een enkele handler.

   `bewijs` noemt per as de plek waar hij wordt aangeroepen. De meter gebruikt dat
   niet als bewering maar als ADRES: hij kijkt zelf of die as op die route
   voorkomt. Een declaratie die niet klopt, laat de meter dus zakken.
   ------------------------------------------------------------------------- */
const KETENS = Object.freeze([
  Object.freeze({
    naam: 'incassoronde',
    klasse: 'geld-reeks',
    wat: 'de vaste betalingen innen die aan de beurt zijn',
    handeling: 'GELD_INNEN',
    routes: Object.freeze([
      '/api/office/bank/incasso',                  // klaarzetten: de hele baan tot het besluit
      '/api/office/bank/handtekening/bevestig',    // de tweede mens, en daarna de uitvoering
      '/api/office/bank/incasso/dossier',          // wat er per as gebeurde, te lezen door een mens
    ]),
  }),
]);

module.exports = { KLASSEN, KETENS };
