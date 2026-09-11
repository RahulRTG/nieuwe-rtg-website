/* ============================================================================
   EEN KANTOORVERWIJDERING IS PAS BEVESTIGD ALS DE OPSLAG HEM HEEFT.

   WAAROM DIT BESTAAT. De verse faalproefronde (FAALPROEF.json, commit 61c400cc)
   gaf tien routes als `gezakt`: 2xx terwijl de toestand niet veranderde. Zeven
   van die tien VERWIJDEREN iets, en alle zeven deden hetzelfde:

       const s = store(); s.lijst = s.lijst.filter(...); save(); return { ok: true };

   Die `save()` is write-behind: hij plant een schrijfactie en keert meteen
   terug. Voor afgeleide toestand is dat precies goed. Voor een verwijdering
   niet, want dan is `{ ok: true }` een bevestiging die de opslag nog niet heeft
   gedaan -- en na een herstart staat het weggegooide ontwerp weer in de lijst.
   Dat is precies de invariant "verwijderde data komt niet spontaan terug".

   WAAROM EEN PLEK EN GEEN ZEVEN. De zeven modules (ideeen, studio, atelier,
   hardwarelab, werkplaats, redactie, atelierweb) doen allemaal dezelfde
   belofte. Zeven kopieen van deze regels is zeven plekken die uit de pas kunnen
   lopen, en de eerste die dat doet doet het stil (LAT.md regel 4). Dus een plek.

   EN DIT IS DE EERSTE GEDEELDE GEDRAGING VAN EEN GEMETEN TYPE. Vier van die
   domeinen -- architect, atelier, hardwarelab en studio -- zijn precies de vier
   die OBJECTMODEL.json en SEMANTIEK.json ONAFHANKELIJK van elkaar aanwezen als
   de enige met een echt gedeeld type: de ontwerpopdracht. Tot nu toe was dat een
   meting zonder gevolg. Dit is het eerste gedrag dat ze werkelijk delen.

   WAT HIJ NIET IS. Geen algemene "veilige verwijderaar" die je overal neerzet.
   De reikwijdte is een KANTOORverwijdering: een medewerker gooit iets weg en
   krijgt te horen dat het weg is. Geld en werk van een lid hebben hun eigen weg
   (server/lib/duurzaam.js, GELDLAT.md), en die blijft leiden.

   DE AANROEPPLEK staat met een reden op de lijst van `npm run check` regel 47.
   De zeven modules staan daar NIET op: die kennen de duurzame commit niet, ze
   kennen deze helper -- en dat is het punt van een gedeelde plek.
   ========================================================================== */
'use strict';

module.exports = ({ save }) => {
  /* `bijeen` en `inBundel` reizen niet door de contextketen; `save` wel, zodat
     een aanroeper die zijn eigen save meegeeft niet stilletjes wordt omzeild.
     Zelfde bedrading als kern/afdelingen/integratiekamer.js. */
  const dbModule = require('../db');
  const vastleggen = require('../lib/duurzaam')({
    bijeen: dbModule.bijeen, save, inBundel: dbModule.inBundel, bron: 'kantoorwissen' });

  /* `mutatie` verandert de toestand in het geheugen; deze functie legt hem vast
     en bevestigt pas daarna.

     `antwoord` mag een FUNCTIE zijn en dat is geen stijlkeuze: een paar van deze
     routes geeft de lijst NA de verwijdering terug (atelierweb/foto-weg), en die
     moet dus worden opgebouwd nadat de mutatie is gelopen. Een vaste waarde zou
     de lijst van vóór de verwijdering vastleggen -- de gebruiker ziet dan zijn
     eigen foto nog staan terwijl hij hem net heeft weggegooid.

     Lukt de commit niet, dan komt het foutantwoord van lib/duurzaam.js terug
     (503 met een reden) en NIET `{ ok: true }`. Dat is de hele reparatie. */
  return async function wis(mutatie, antwoord) {
    const nietVastgelegd = await vastleggen(mutatie);
    if (nietVastgelegd) return nietVastgelegd;
    return typeof antwoord === 'function' ? antwoord() : (antwoord || { ok: true });
  };
};
