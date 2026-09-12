/* "BETAAL DIE" -- dezelfde zin, drie keer een ander scherm, en er gaat geld in om.

   Apart van ./rail-corpus-context.js omdat het een ANDER soort geval is. Daar
   gaat "die andere" over een verwijzing die wel of niet op te lossen is; hier
   gaat het over GELD, en dan geldt er een regel bovenop de referentveiligheid:
   ook als de verwijzing eenduidig IS, gaat geld nooit vanzelf. GELD.md en
   FABRIC.md zeggen dat allebei, en het contract schrijft het per geval uit
   (`sideEffectMax: klaarzetten` bij precies EEN openstaande factuur).

   DE DRIE TOESTANDEN, en het middelste geval is de reden dat dit blok bestaat:

     geen open factuur   -> er is niets om naar te verwijzen: vragen
     1 open factuur      -> eenduidig, dus HANDELEN -- maar tot een VOORSTEL, en
                            een mens bevestigt. Niet tot uitvoering.
     3 open facturen     -> drie keer even plausibel: niet kiezen maar vragen

   HET VERSCHIL MET "DIE ANDERE" IS HET PLAFOND EN NIET DE TAAL. Bij een
   eenduidige agenda-verwijzing komt de keten tot `tonen` (lezen mag). Hier komt
   hij tot `klaarzetten` en geen stap verder, want /api/bank/pas/betaal staat op
   niveau `voorstel`: de server geeft 428 met een goedkeuring terug en er
   verandert niets aan het geld. Zou dit geval ooit tot `uitvoeren` komen, dan is
   dat de ernstigste bevinding die deze proef kan doen.

   DE SLEUTELS STAAN HIER LETTERLIJK, net als in ./rail-corpus-context.js. Ze
   zijn EEN KEER afgeleid met de echte menscontext.handtekening() en daarna
   overgenomen; zou dit bestand die functie aanroepen, dan klopt de sleutel per
   definitie altijd en is er niets meer dat kan zakken. */
'use strict';

/* Geen enkele tool, dus geen enkel effect: de rail stelt EEN vraag. */
const verhelder = (projectie) => ({ stappen: [], projectie });

module.exports = {

  /* 1. WEL EEN SCHERM, GEEN OPENSTAANDE FACTUUR. Er is niets om "die" op te
        betrekken, dus er wordt niet gegokt en er gebeurt niets. */
  'betaal die actieve context scherm rtg geld deel facturen':
    verhelder('Ik zie je facturen, maar er staat er geen open waar "die" op kan slaan. ' +
      'Welke bedoel je?'),

  /* 2. PRECIES EEN OPENSTAANDE FACTUUR. Eenduidig, dus de keten HANDELT -- en
        komt tot een voorstel dat een mens bevestigt. Dat is het hele punt van
        dit geval: een eenduidige referent maakt van betalen geen automatisme.

        De kaart wordt eerst opgehaald, zodat te zien is dat de contextwoorden
        de echte resolver bereiken; daarna een `doe` op een pad met niveau
        `voorstel`, dat 428 teruggeeft. */
  'betaal die actieve context scherm rtg geld deel facturen keuze factuur 2026 014':
    { stappen: [
        { tools: [{ name: 'kaart', input: {} }] },
        { tools: [{ name: 'doe', input: { pad: '/api/bank/pas/betaal',
          zeker: true, begrepen: 'de ene openstaande factuur van dit lid klaarzetten om te betalen',
          body: { factuur: 'Factuur 2026-014' } } }] }],
      projectie: 'Je bedoelt factuur 2026-014. Ik heb de betaling klaargezet; bevestig hem ' +
        'zelf, dan gaat hij weg.' },

  /* 3. DRIE OPENSTAANDE FACTUREN. Nu is er niets eenduidigs, en dan wordt er
        niet gekozen maar gevraagd -- met geld al helemaal niet. Een van de drie
        pakken omdat hij toevallig eerst staat, is exact de gok die deze laag
        moet uitsluiten. */
  'betaal die actieve context scherm rtg geld deel facturen keuze factuur 2026 014 factuur 2026 015 factuur 2026 016':
    verhelder('Er staan er drie open: 2026-014, 2026-015 en 2026-016. Welke bedoel je?')

};
