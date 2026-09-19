/* WELKE BALK IS VAN DE EDGE -- en dat is een andere vraag dan wat er in het
   Edge-blad komt te staan (dat is rtg-adaptive-edge-controls.js). Ze staan
   apart omdat ze los van elkaar fout kunnen gaan: een balk verkeerd claimen
   haalt inhoud van het scherm, een knop verkeerd oogsten levert een dode knop
   in het blad. */
(function (w, d) {
  'use strict';
  if (w.RTGAdaptiveEdgeClaim) return;

  /* DE EDGE NEEMT EEN BALK OVER, EN MEET DAT HIJ ER EEN IS.

     Deze schermen droegen naast de Edge nog hun eigen vaste balk -- gemeten in
     een echte browser over 291 schermen, wachtend op `data-rtg-adaptive-ready`
     en niet op een klok: `.ios-nav` op 108 schermen, de suitebalk en
     suitenavigatie op tien, de ops-navigatie op vier, de sociale commandobalk
     op drie, de statusstrook op een. Die staan hier bij naam.

     MAAR EEN NAAM IS NIET GENOEG, en dat is de grendel die deze lijst eerlijk
     houdt. `.ios-nav` is in dit huis niet altijd een balk: rtg-aankomst-2026.css
     maakt van `header.ritkop.ios-nav` een hero van 430px met een foto erin. Wie
     op de klassenaam afgaat, haalt daar de inhoud weg in plaats van de
     bediening. Daarom claimt de Edge alleen wat op dit moment ook werkelijk een
     balk IS: vast of plakkend, over de breedte, en niet hoger dan een balk.
     Een hero zakt op de eerste voorwaarde en blijft dus gewoon staan.

     Wat geclaimd is, krijgt `rtg-edge-owned-bar` -- en die klasse stond al in
     twee dingen: rtg-adaptive-edge.css verbergt hem zodra de Edge klaar is, en
     de ROOTS van rtg-adaptive-edge-controls.js oogsten zijn knoppen naar het
     Edge-blad. Een klasse, twee gevolgen, geen tweede lijst die uit de pas gaat
     lopen. De bron blijft in de DOM staan met zijn eigen handlers en rechten;
     de Edge klikt hem aan. */
  var CLAIM = '.rtg-suitebar,.rtg-suitenav,.tos-opsnav,.rtg-social-commandbar,' +
    '.salon-socialnav,.rtg-intel-strip,.rtd-nav,.one-nav';

  /* `.ios-nav` STOND HIER EN IS ERUIT GEHAALD, en dat is een besluit met een
     prijs: het was 108 van de 135 schermen. De reden staat in wat de keten
     vond. Die gedeelde app-kop draagt namelijk niet alleen navigatie maar ook
     de HOOFDHANDELING van een scherm: `#bewaar` op klankwerk.html is de
     opslaan-knop, `#nieuwLijst` op notities.html maakt een lijst. Geoogst in
     het Edge-blad zijn ze bereikbaar, maar wel een tik verder -- en opslaan
     achter een blad zetten is geen opruiming, dat is een functie verplaatsen
     waar niemand om vroeg.

     Wat hier overblijft is wat onmiskenbaar DUBBELE platformbediening is:
     wereld- en suitenavigatie, een merkbalk, een statusstrook. Die vervangt de
     Edge werkelijk. Of `.ios-nav` er alsnog bij hoort, is een productbesluit
     van de eigenaar en geen bouwtaak -- en wie hem terugzet, hoort eerst te
     regelen dat de hoofdhandeling van een scherm in de Edge zelf landt en niet
     alleen in het blad. */
  var EIGEN = 'rtg-edge-owned-bar';
  /* WAT DE EDGE NIET KAN DRAGEN, NEEMT HIJ NIET OVER. Het blad oogst `button`
     en `a[href]` en klikt het origineel aan; een invoerveld kan het niet
     overnemen. browser.html heeft zijn ADRESBALK in die kop staan -- een form
     met `rtg://` en een invoerveld -- en de eerste versie claimde die, waarmee
     de browser zijn adresbalk kwijt was. Een balk met invoer blijft dus staan,
     en dat is geen uitzondering maar dezelfde regel: verbergen mag alleen als
     de bediening ergens anders terugkomt.

     BEDIENBARE invoer, en niet alle invoer: bestanden.html heeft een
     `input[type=file]` achter zijn Upload-knop. Zo'n veld bedient niemand
     rechtstreeks -- het hangt aan een knop, en die draagt de Edge wel.

     En daar hoort `hidden` bij te tellen, niet alleen de maat. Dat veld staat
     op `hidden` en wordt door een stijlregel toch als 388x36 getekend; puur
     meten liet die kop dus onterecht afvallen. De verklaring van de auteur
     weegt hier zwaarder dan wat de rekenmachine ervan maakt. */
  var ONDRAAGBAAR = 'input,select,textarea,[contenteditable=""],[contenteditable="true"]';
  function bedienbaar(veld, win) {
    if (veld.hidden || veld.getAttribute('aria-hidden') === 'true') return false;
    var stijl = win.getComputedStyle(veld);
    if (stijl.display === 'none' || stijl.visibility === 'hidden') return false;
    return veld.getClientRects().length > 0;
  }
  function draagbaar(el, win) {
    var velden = el.querySelectorAll(ONDRAAGBAAR);
    for (var i = 0; i < velden.length; i++) {
      if (bedienbaar(velden[i], win)) return false;
    }
    return true;
  }
  function isBalk(el, win) {
    var stijl = win.getComputedStyle(el);
    if (stijl.position !== 'fixed' && stijl.position !== 'sticky') return false;
    var r = el.getBoundingClientRect();
    if (r.width < win.innerWidth * 0.6) return false;
    return r.height >= 28 && r.height <= win.innerHeight * 0.4;
  }
  /* EERST ALLES METEN, DAN PAS MARKEREN -- en dat is geen nettigheid maar een
     reparatie. Claimen VERANDERT de maat: zodra `.rtg-suitebar` de klasse
     kreeg, zette de vrijgave-regel in rtg-adaptive-edge.css `--suite-nav` op
     nul, werd `.rtg-suitenav` nul hoog, en viel die in dezelfde lus af als
     "geen balk". Hij was daarna onzichtbaar EN niet geclaimd, dus zijn knoppen
     -- de hele sociale navigatie -- werden nergens geoogst. Onzichtbaar zonder
     claim is de ergste van de twee fouten: op het scherm ziet het er opgeruimd
     uit en de functie is weg. */
  function claim(doc, win) {
    var winnaars = [];
    doc.querySelectorAll(CLAIM).forEach(function (el) {
      if (el.classList.contains(EIGEN)) return;
      if (el.closest('.rtg-edge-chrome,.rtg-adaptive-edge')) return;
      if (!isBalk(el, win)) return;
      if (!draagbaar(el, win)) return;
      winnaars.push(el);
    });
    winnaars.forEach(function (el) { el.classList.add(EIGEN); });
  }

  w.RTGAdaptiveEdgeClaim = Object.freeze({ claim: function (doc, win) { claim(doc || d, win || w); } });
}(window, document));
