/* Foundation OS: waar een geoormerkte gift heen KAN.

   DIT BESTAAT OMDAT HET OORMERK NERGENS OP SLOEG. Gemeten tegen een echte
   server: een lid kon 25 euro geven aan het project "Bestaat Helemaal Niet",
   met een zelfverzonnen `projectId`, en dat kwam er met status 200 doorheen.
   De bron kwam in de boekhouding van de stichting terecht met
   `herbestemming: 'met_toestemming'` -- een belofte aan de gever -- terwijl er
   geen project was om aan toe te wijzen. Het scherm zei ondertussen "Een
   geoormerkte gift wijst een project aan".

   Twee dingen gingen daar mis en ze versterkten elkaar. De projectNAAM was vrije
   tekst uit de browser, en de projectID kwam OOK uit de browser, zonder dat een
   van beide werd nagekeken of ze bij elkaar hoorden.

   DE OMKERING: de gever kiest een ID uit deze lijst, en de NAAM wordt er hier
   bij gezocht. Wat de browser als naam meestuurt, doet niet meer mee. Dat is
   dezelfde regel als bij het voornemen zelf (./gift-betalen.js: wat de browser
   meestuurt is invoer en geen uitkomst).

   WAAROM HIER WEL EEN ID EN IN ./publiek.js NIET. Dat deel toont projecten aan
   de BUURT, zonder inlog, en houdt met opzet ids en bedragen achter -- wie geen
   account heeft, hoeft niets aan te kunnen wijzen. Hier is de lezer een lid met
   een eigen account dat geld wil oormerken; zonder een aanwijsbaar project kan
   dat niet. Wat hier uitgaat is verder net zo karig: naam, stad, soort. Geen
   budget, geen bestedingen, geen mensen.

   DRIE GRENDELS:

   1. ALLEEN ACTIEVE PROJECTEN IN OPEN STEDEN. Geld oormerken op een idee dat nog
      niet is goedgekeurd, is geld vastzetten voor iets dat er misschien nooit
      komt.

   2. GEEN GRENS OP DE SOORT. Het filter (bijvoorbeeld duurzaamheid voor het
      Klimaatfonds) is een BEELD en geen grens: wie de hele lijst opvraagt,
      krijgt alles wat openstaat. Een filter dat stiekem ook bepaalt wat mag,
      is een grens die niemand heeft opgeschreven.

   3. DE NAAM KOMT HIERVANDAAN. `naamVan(id)` is de enige weg van een id naar
      een naam in de giftlaag; er is geen tak die een meegestuurde naam
      overneemt. */
'use strict';

module.exports = (ctx) => {
  const { S, schoon, stadVan } = ctx;

  /* Staat de stad open voor de buitenwereld? Dezelfde vraag als ./publiek.js
     stelt, en met opzet niet strenger: een project dat de buurt mag zien, mag
     een lid ook steunen. */
  const stadOpen = s => !!s && s.status === 'actief';

  function bruikbaar(p) {
    if (!p || p.status !== 'actief') return false;
    return stadOpen(stadVan(p.stad));
  }

  /* De lijst waaruit een gever kiest. `soort` is een beeld -- zie grendel 2. */
  function lijst(b) {
    b = b || {};
    const soort = schoon(b.soort, 30) || null;
    const rijen = S().projecten.filter(bruikbaar)
      .filter(p => !soort || p.soort === soort)
      .slice(0, 200)
      .map(p => ({ id: p.id, naam: p.naam, soort: p.soort,
        stad: (stadVan(p.stad) || {}).naam || null, doelgroep: p.doelgroep || null }));
    return { ok: true, aantal: rijen.length, soort, projecten: rijen,
      uitleg: rijen.length
        ? 'Kies waar je gift heen gaat. Een geoormerkte gift wordt alleen met jouw toestemming herbestemd.'
        : 'Er loopt op dit moment geen project waar een gift aan kan worden vastgezet. Een gift zonder oormerk komt bij het werk in de steden terecht.' };
  }

  /* Van id naar project. Geeft null als hij niet bestaat of niet bruikbaar is --
     de aanroeper hoort dat als een weigering te behandelen en niet als een
     lege naam. */
  function vindBruikbaar(id) {
    const p = S().projecten.find(x => x.id === String(id || '')) || null;
    return bruikbaar(p) ? p : null;
  }

  return { lijst, vindBruikbaar };
};
