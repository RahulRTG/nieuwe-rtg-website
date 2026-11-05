/* ============================================================================
   DE RAHUL-POORT -- inloggen als een gesprek, ook op de werkschermen.

   In de leden-app is de poort al van Rahul: geen formulier, maar een vraag per
   keer. Op de werkschermen (personeel, leverancier) stond nog het ouderwetse
   blok van twee velden onder elkaar met een knop eronder. Dit is dezelfde poort
   voor die schermen: Rahul stelt de vragen, jij geeft antwoord, en pas als hij
   alles heeft belt hij bij de server aan.

   WAT ER NIET GEBEURT. Er gaat geen letter van dit gesprek naar een taalmodel.
   De vragen staan hier vast in een lijstje; het antwoord op "uw wachtwoord?"
   gaat rechtstreeks naar dezelfde inlogroute als voorheen. Rahul is hier de
   VORM van het formulier, niet de portier: wie binnen mag beslist de server,
   precies als eerst. Dat is geen detail -- een AI die toegang uitdeelt is
   precies wat we in dit huis niet doen.

   GEBRUIK

     RTGPoort.gesprek(element, {
       groet:   'Goedemiddag.',                       // optioneel, de openingszin
       stappen: [
         { sleutel:'user', vraag:'Met wie heb ik het genoegen?', plho:'e-mail of gebruikersnaam',
           type:'text', autocomplete:'username' },
         { sleutel:'pass', vraag:'Dank u. En uw wachtwoord?', type:'password',
           autocomplete:'current-password' }
       ],
       klaar: async function (antw) { await inloggen(antw.user, antw.pass); },
       zijpaden: [ { tekst:'Aanmelden bij een bedrijf', doe: stepAanmelden } ]
     });

   Gooit `klaar` een fout, dan zegt Rahul die zin en vraagt hij de laatste stap
   opnieuw (een wachtwoordveld wordt daarbij leeggemaakt). Zo blijft het een
   gesprek in plaats van een rood blokje onder een formulier.

   TWEE SOORTEN STAPPEN, meer niet -- een poort waar je doorheen praat hoort
   simpel te blijven:

     type:'text' / 'password'   een regel om in te typen
     type:'keuze'               een keuze uit opties(antw) -> [{waarde,label}]

   Een stap mag daarnaast zelf iets OPHALEN voordat de volgende vraag komt:

     { sleutel:'code', vraag:'Van welk korps bent u?',
       doe: async (antw) => { lijst = await roster(antw.code); } }

   Gooit die `doe`, dan zegt Rahul het en staat dezelfde vraag er weer. Zo kan de
   ene vraag de opties van de volgende bepalen zonder dat de poort iets van de
   pagina hoeft te weten.

   ZINNEN MOGEN FUNCTIES ZIJN. Handig als de vertaaltabel van een pagina verderop
   in het document staat dan het script dat de poort opzet: `() => T('x','y')`
   wordt pas gelezen als de vraag in beeld komt, en opnieuw bij een taalwissel.

   De vormtaal komt uit de leden-poort: de zin groot en stil in Bodoni, daaronder
   een enkele regel met een dunne lijn eronder. Staat shared/mond.js op de
   pagina, dan beweegt Rahuls signatuurmond mee; is hij er niet, dan is er
   gewoon geen mond en verandert er verder niets.
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (w.RTGPoort) return;

  if (!d.documentElement.hasAttribute('data-ds') && !d.getElementById('rtgDsRuntimeCss')) {
    var link = d.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    d.head.appendChild(link);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
