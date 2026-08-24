/* DE VEILIGE NOODSTAND, los van de rest van de incidentcontrole.

   Niet omdat hij er niet bij hoort -- hij is de vijfde modus van ./incidentcontrole.js
   en wordt daar aangeroepen -- maar omdat hij als enige van de vijf NIETS OMZET.
   `beperk` en `isoleer` schrijven schakelaarstanden weg die je daarna exact moet
   terugzetten; dit is een vlag waar de schakelkast naar kijkt. Dat verschil is
   het hele idee van grens 6.10, en het verdwijnt als deze functie tussen de vier
   andere staat die wél standen wegschrijven.

   Wat hij bevriest en wat er doorloopt staat in ./beschermstand-lijst.js. */
'use strict';

const klok = require('../lib/klok');

/* Het bewijs wordt bij het omzetten VASTGEZET en niet gekopieerd: de hashketen
   van het journaal wordt nagelopen en de uitslag komt als zegel in het audit.
   Wat daarna nog aan de historie verandert, breekt tegen dat zegel. Zonder
   journaal staat er `nietTeZeggen` met de reden -- een zegel verzinnen zou het
   enige onderdeel van deze stand zijn dat liegt. */
function bewijszegel(journaal) {
  /* Lui of niet: de montage geeft hier een functie door omdat kern.command bij
     het monteren van de techniekroutes nog niet bestaat. De waarde meteen lezen
     zou het zegel voorgoed op "geen journaal" zetten. */
  const j = typeof journaal === 'function' ? journaal() : journaal;
  if (!j || typeof j.controleer !== 'function') {
    return { nietTeZeggen: 'er is hier geen journaal om na te lopen, dus het bewijs is niet vastgezet' };
  }
  /* TWEE VERSCHILLENDE ANTWOORDEN, en ze niet uit elkaar houden zou het ergste
     onderdeel van deze stand onbruikbaar maken: "er is geen keten" en "de keten
     is niet te lezen" vragen om iets heel anders van degene die het leest. */
  let c;
  try { c = j.controleer(); } catch (e) { return { nietTeZeggen: 'de hashketen kon niet worden nagelopen: ' + e.message }; }
  if (!c) return { nietTeZeggen: 'de hashketen gaf geen uitslag terug' };
  return { heel: c.heel === true, regels: c.regels || null, bij: c.bij || null,
    waarom: c.waarom || null, at: klok.datum().toISOString() };
}

/* De handeling zelf. Hij krijgt de gereedschappen van incidentcontrole mee in
   plaats van ze opnieuw te maken: één plek waar een reden wordt gekeurd, één
   plek waar het audit wordt geschreven, één plek waar wordt opgeslagen. */
function maakBescherm({ techniek, redenVan, nieuwActief, schrijfAudit, save, meld, status, fout, journaal }) {
  return function bescherm(redenIn, actor) {
    const reden = redenVan(redenIn);
    const { s } = techniek();
    if (s.modus === 'isolatie') {
      fout(409, 'Het platform staat in isolatie; beschermen is dan een stap terug. Herstel eerst.');
    }
    const actief = nieuwActief(s, reden, actor);
    actief.zegel = bewijszegel(journaal);
    s.modus = 'beschermd';
    schrijfAudit(s, 'bescherm', actor, reden, []);
    save(); meld('bescherm', reden, []);
    return status();
  };
}

module.exports = { maakBescherm, bewijszegel };
