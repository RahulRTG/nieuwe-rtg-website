/* Horeca (kern): EEN HALF AANBOD -- welke tafels gaan er mee, en mag dat.

   WAAROM DIT EEN EIGEN BESTAND IS. ./wijk-overdracht.js gaat over de handeling
   (bieden, aanvaarden, intrekken); dit gaat over de VRAAG WELKE TAFELS. Dat is
   de rekensom die bepaalt of twee aanbiedingen elkaar in de weg zitten, en die
   hoort op een plek te staan -- niet half in bied() en half in het scherm.

   TWEE DINGEN, EN ZE HOREN BIJ ELKAAR:

   1. WELKE TAFELS DIT AANBOD DRAAGT. Ze moeten uit deze wijk komen, anders zou
      een aanbod tafels van een collega kunnen weggeven. En wie ze allemaal
      aanvinkt, biedt gewoon de hele wijk aan: alle tafels los uitlenen levert
      hetzelfde werk op met zeven keer teruggeven erachteraan.
   2. WELKE TAFELS DIT AANBOD BEZET. Een tafel staat hoogstens bij een iemand
      uit (regel 5). Botsen kan alleen BINNEN dezelfde wijk, want een tafel
      hoort bij hoogstens een wijk (wijk.js regel 3). Een bestaand HEEL aanbod
      bezet alles van zijn wijk; een nieuw heel aanbod botst daarom ook met elk
      half aanbod dat er nog uitstaat -- en dat hoort, want je kunt een wijk niet
      in zijn geheel weggeven terwijl er een stuk van uit is. */
'use strict';

module.exports = ({ schoon }) => {
  /* De keuze uit een aanbod. Geeft `deel: null` terug als het een HEEL aanbod
     is (niets gekozen, of alles), en anders de gekozen tafels. `raakt` is wat
     dit aanbod bezet -- voor een heel aanbod alle tafels van de wijk. */
  function kies(w, tafels) {
    const gekozen = (Array.isArray(tafels) ? tafels : []).slice(0, 60)
      .map((t) => schoon(t, 30).trim()).filter(Boolean);
    const uniek = [...new Set(gekozen)];
    const buiten = uniek.filter((t) => !w.tafels.includes(t));
    if (buiten.length) {
      return { status: 400, code: 'niet-uit-deze-wijk',
        error: 'Deze tafels zitten niet in ' + w.naam + ': ' + buiten.join(', ') + '.' };
    }
    const deel = (uniek.length && uniek.length < w.tafels.length) ? uniek : null;
    return { deel, raakt: deel || w.tafels };
  }

  // welk open aanbod op deze wijk raakt deze tafels al
  function bezet(openLijst, wijkId, raakt) {
    return openLijst.filter((o) => o.wijkId === String(wijkId || ''))
      .find((o) => !o.tafels || !raakt.length || o.tafels.some((t) => raakt.includes(t)));
  }

  return { kies, bezet };
};
