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

  var CSS =
    ".rp{display:flex;flex-direction:column;width:100%;}" +
    ".rp-mond{display:block;margin:0.2rem auto 0.1rem;width:200px;height:91px;}" +
    ".rp-zin{font-family:'Bodoni Moda',Georgia,serif;font-weight:400;font-size:1.12rem;line-height:1.65;" +
      "color:var(--txt,#F4F1EC);text-align:center;min-height:4.4rem;display:flex;align-items:center;" +
      "justify-content:center;padding:0.8rem 0.4rem 1rem;text-wrap:balance;animation:rpZin .5s ease;}" +
    "@keyframes rpZin{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}" +
    ".rp-rij{display:flex;align-items:center;border-bottom:1px solid var(--line,rgba(255,255,255,.1));" +
      "margin:0 .6rem;transition:border-color .2s;}" +
    ".rp-rij:focus-within{border-color:var(--burgundy,#C23A5E);}" +
    /* De lange staart van :not()'s is geen sierwerk. De UI-kit geeft ELK
       invoerveld een kaartje met rand en ronde hoeken, en doet dat met precies
       deze drie uitzonderingen erbij -- dus zo zwaar weegt die regel. Deze ene
       regel moet juist een kale lijn zijn: geen doosje, alleen een streep
       eronder. Met dezelfde staart plus onze eigen twee klassen wint hij, en
       hoeft er nergens !important aan te pas te komen. */
    ".rp .rp-rij input:not([type=range]):not([type=checkbox]):not([type=radio])" +
      "{flex:1;min-width:0;background:none;border:none;border-radius:0;outline:none;box-shadow:none;" +
      "color:var(--txt,#F4F1EC);" +
      "font-family:'Inter',system-ui,sans-serif;font-size:.95rem;text-align:center;padding:.75rem .4rem;}" +
    ".rp .rp-rij input:not([type=range]):not([type=checkbox]):not([type=radio]):focus" +
      "{border:none;box-shadow:none;}" +
    ".rp-rij input::placeholder{color:var(--soft,rgba(244,241,236,.6));}" +
    ".rp .rp-rij select{flex:1;min-width:0;background:none;border:none;border-radius:0;outline:none;box-shadow:none;" +
      "color:var(--txt,#F4F1EC);font-family:'Inter',system-ui,sans-serif;font-size:.95rem;" +
      "text-align:center;text-align-last:center;padding:.75rem .4rem;}" +
    ".rp .rp-rij select[hidden],.rp .rp-rij input[hidden]{display:none;}" +
    ".rp-rij button{background:none;border:none;cursor:pointer;color:var(--gold,#A98F1C);font-size:1.15rem;" +
      "padding:.4rem .2rem;opacity:0;transition:opacity .2s;font-family:inherit;}" +
    ".rp-rij:focus-within button,.rp-rij.vol button{opacity:.85;}" +
    ".rp-paden{margin-top:1.6rem;display:flex;flex-direction:column;gap:.7rem;align-items:center;}" +
    ".rp-pad{background:none;border:none;color:var(--muted,rgba(244,241,236,.7));font:inherit;font-size:.8rem;" +
      "cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0;}" +
    ".rp-pad:hover{color:var(--gold,#A98F1C);}";

  function stijl() {
    if (d.getElementById('rpStijl')) return;
    var s = d.createElement('style'); s.id = 'rpStijl'; s.textContent = CSS;
    (d.head || d.documentElement).appendChild(s);
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

