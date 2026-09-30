/* ============================================================================
   DE VERKLARING VAN DE UNIVERSELE BODEM -- welke functie draagt welk werkwoord.

   SAMENLEVING.md par. 2 noemt zeven werkwoorden die voor niemand volledig
   mogen verdwijnen, ongeacht pas, vermogen of positie:

       leren -> ontwikkelen -> orienteren -> verbinden -> rust ->
       hulp vinden -> opnieuw beginnen

   Deze lijst zegt welke functies uit het functieregister (of welke schermen)
   die werkwoorden DRAGEN. Dat is een VERKLARING en geen afleiding, net als
   `LEDENVELDEN` bij AI-CONTEXT-01: of Ontdekken iets met leren te maken heeft,
   staat nergens in de code en valt er ook niet uit te lezen. Een meter die dat
   raadt, meet zijn eigen gok.

   DAAROM DRAAGT HIJ EEN AFTEKENING, en die staat op `null`. Deze eerste versie
   is een VOORSTEL (27 september 2026) en is door geen mens afgetekend. Tot dat
   gebeurt zegt de meting: "zo staat de bodem ervoor ALS deze indeling klopt" --
   en niet meer dan dat. CODE.md par. 7: een gegenereerde of voorgestelde meter
   promoveert niets tot een mens hem heeft afgetekend.

   WAAROM `paden` SOMS SMALLER IS DAN DE FUNCTIE. Buurtruil hangt onder de
   functie `dom-rtfos`, waarvan de rest achter de kantoordeur staat. Zonder
   versmalling zou de meter kantoorroutes proberen en een ruilwinkel voor elk
   lid "buiten bereik" noemen. De versmalling noemt dus het deel van de functie
   dat het werkwoord draagt, en niets anders.

   WAAROM ER EEN SCHERM TUSSEN STAAT. De hulpwijzer is pure tekst, zonder API en
   zonder deur -- dat is precies waarom hij veilig is voor iemand die niet wil
   dat er iets wordt vastgelegd (HDI.md par. 7, regel 2). Een meter op deuren
   ziet hem niet; hij krijgt daarom zijn eigen, eenvoudiger vraag: laadt de
   pagina zonder sessie.

   EEN LEEG WERKWOORD IS EEN UITSLAG. `opnieuw beginnen` heeft hier geen enkele
   functie, en dat is geen vergeten regel maar de bevinding van SAMENLEVING.md
   par. 2: geen module heeft als opdracht dat iemand na een breuk opnieuw kan
   instappen. De meter noemt dat `geen-eigenaar` en zwijgt er niet over.
   ========================================================================== */
'use strict';

const WERKWOORDEN = ['leren', 'ontwikkelen', 'orienteren', 'verbinden', 'rust', 'hulp-vinden', 'opnieuw-beginnen'];

const AFGETEKEND = { door: null, op: null, stand: 'voorstel -- nog door geen mens afgetekend' };

const VERKLARING = {
  leren: [
    { functie: 'dom-leerstof', waarom: 'de gratis leerpaden' },
    { functie: 'dom-onderwijs', waarom: 'leerpaspoort en ladder' },
    { functie: 'ov-bijles', waarom: 'bijles vragen' },
    { functie: 'connect', paden: ['/api/connect'], waarom: 'Ontdekken: leren, doen, doorgeven' }
  ],
  ontwikkelen: [
    { functie: 'carriereledger', waarom: 'wat iemand heeft gedaan, als eigen dossier' },
    { functie: 'member-werk', waarom: 'vacatures bekijken en solliciteren' },
    { functie: 'doelen', waarom: 'een eigen doel bijhouden' },
    { functie: 'gewoonten', waarom: 'een gewoonte opbouwen' },
    { functie: 'dom-metier', waarom: 'vakwerk en vaardigheden' },
    { functie: 'knelpunt', paden: ['/api/knelpunt'], waarom: 'welke weg ligt open naar een doel' }
  ],
  orienteren: [
    { functie: 'knelpunt', paden: ['/api/knelpunt'], waarom: 'vondsten bij een randvoorwaarde' },
    { functie: 'connect', paden: ['/api/connect'], waarom: 'rondkijken uit nieuwsgierigheid' },
    { functie: 'kern-gids', waarom: 'uitleg over wat er is' },
    { functie: 'opvangwijzer', waarom: 'kinderopvang: het aanbod zien' },
    { scherm: '/apps/foundation/hulpwijzer.html', waarom: 'de hulpwijzer: tekst zonder deur' }
  ],
  verbinden: [
    { functie: 'kern-berichten', waarom: 'berichten en gesprekken' },
    { functie: 'salon', waarom: 'De Salon' },
    { functie: 'member-connect', waarom: 'vrienden verbinden' },
    { functie: 'socialewereld', waarom: 'de kring op een plek' },
    { functie: 'dom-rtfos', paden: ['/api/rtfos/ruil'], waarom: 'Buurtruil, zonder geld' },
    { functie: 'dom-samen', waarom: 'de stadsraad' }
  ],
  rust: [
    { functie: 'rust', paden: ['/api/veiligheid/rust'], waarom: 'niet storen, de kring komt erdoor' },
    { functie: 'gemoed', waarom: 'de dagcheck-in' },
    { functie: 'gedachten', waarom: 'het gedachtenboek' }
  ],
  'hulp-vinden': [
    { functie: 'service', waarom: 'een mens bij een probleem (SERVICE.md par. 3)' },
    { functie: 'dom-beschermdeur', waarom: 'de voordeur zonder account' },
    { functie: 'noodkaart', waarom: 'de noodkaart' },
    { functie: 'dom-overheid', waarom: 'het overheidsloket' },
    { functie: 'dom-gemeente', waarom: 'het gemeenteloket' },
    { functie: 'dom-care', waarom: 'zorg en welzijn' }
  ],
  'opnieuw-beginnen': []
};

module.exports = { WERKWOORDEN, VERKLARING, AFGETEKEND };
