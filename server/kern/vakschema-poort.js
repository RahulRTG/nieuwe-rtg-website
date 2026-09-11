/* ============================================================================
   DE POORT VAN HET VAKSCHEMA -- mag DEZE zaak, en mag DEZE mens?

   Het zijn twee vragen en ze hebben allebei een eigen antwoord nodig. Dat klinkt
   vanzelfsprekend en was het niet: de eerste versie stelde alleen de tweede, en
   de toets vond dat een restaurant met een BIG-houder in dienst er zo doorheen
   kwam.

   `persoonseis.magHandeling` weegt het VAKBEWIJS van de mens achter de sessie,
   en een genre dat niet in kern/persoonseis-lijst.js staat vraagt met opzet
   niets extra's -- dat is juist, want een restaurant hoort geen papieren te
   vragen aan zijn afwasser. Het gevolg is wel dat die functie in haar eentje
   GEEN genrepoort is.

   Daarom de lijst hieronder, in dezelfde vorm als `SPREEKKAMERS` in
   kern/zorgketen/index.js: de handeling hoort bij een soort zaak, en dat staat
   NAAST de persoonseis en niet erin. Kort: de persoonseis zegt of deze MENS het
   mag, deze lijst of het bij dit WERK hoort. Allebei nodig, en de volgorde is
   niet willekeurig -- eerst het genre, want dat antwoord verraadt niets over een
   persoon.

   En de laag is laat gebonden en fail-closed, net als in de zorgketen: ontbreekt
   de persoonscontrole, dan gaat deze handeling NIET door. Stil doorlaten zou
   precies de fout herhalen die zij oplost.
   ========================================================================== */
'use strict';

const GENRES = ['fysiotherapie', 'sportarts'];

module.exports = ({ findSupplier, persoonseis }) =>
  function persoonMag(code, actor) {
    const genre = (findSupplier(code) || {}).type || null;
    if (!GENRES.includes(genre)) {
      return { ok: false, missend: null, reden: 'genre',
        error: 'Een trainings- of herstelschema voor iemand anders hoort bij een fysiotherapie- of ' +
          'sportgeneeskundepraktijk. Een bevoegde mens in een andere zaak is hier niet genoeg.' };
    }
    if (!persoonseis) {
      return { ok: false, missend: null,
        error: 'De persoonscontrole is niet beschikbaar; deze handeling gaat dan niet door.' };
    }
    return persoonseis.magHandeling(genre, 'schemaGeven', persoonseis.persoonVanActor(actor));
  };

module.exports.GENRES = GENRES;
