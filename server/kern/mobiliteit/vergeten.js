/* Mobility OS (deelmodule): WAT MOBILITEIT VAN EEN LID VERGEET (AVG art. 17).

   De vergeetroute (server/kern/vergeten.js) kende geen enkele collectie van dit
   domein. Na "verwijder mijn gegevens" bleven dus staan: de opgeslagen plekken
   van het lid (soms zijn huis, soms "hier"), zijn reisoverzichten, en in elke
   vervoersopdracht zijn sleutel naast het exacte ophaalpunt van een rit die nog
   liep. POSITIESTROOM.json telde het als vier stromen op een ledensleutel die
   niemand wiste.

   TWEE SOORTEN, DEZELFDE TWEE ALS IN DE VERGEETROUTE ZELF.

     WEG. mobFavorieten en mobReizen gaan alleen over dit lid: zijn eigen
     plekken en zijn eigen overzicht van een geboekte reis. De kaartjes en de
     ritten waar zo'n reis naar verwijst staan elders en hebben hun eigen weg.

     DE PERSOON ERUIT, DE REST BLIJFT. Een vervoersopdracht is ook de
     administratie van de vervoerder: afstand, duur, prijs en de plekken als
     tekst staan op zijn factuur. Die blijven. Wat eruit gaat is het lid -- zijn
     sleutel, zijn codenaam, zijn vrije notitie -- en elke coordinaat, via
     dezelfde wisRitpunten() die ook bij het afronden van een rit draait
     (./ritpunten.js, NAVIGATIE.md N16). Ook een rit die nog loopt: wie zijn
     account opheft, wordt daarna door niemand meer gevolgd.

   Hier en niet in server/kern/vergeten/: dit domein gaat door zijn eigen deur
   (./opslag.js, keuringsregel 53). De vergeetroute vraagt het; mobiliteit doet
   het. */
'use strict';
const { wisRitpunten } = require('./ritpunten');

const WEG = '(verwijderd)';

module.exports = (ctx) => {
  const { opslag, save, nu } = ctx;

  function mobVergeetLid(key) {
    if (!key) return { ritten: 0, reizen: 0, plekken: 0 };
    let ritten = 0;
    for (const o of opslag.bak('mobOpdrachten')) {
      if (!o) continue;
      const reiziger = o.reiziger === key;
      const betaler = o.betaler && o.betaler.soort === 'reiziger' && o.betaler.key === key;
      if (!reiziger && !betaler) continue;
      wisRitpunten(o, nu());
      if (reiziger) { o.reiziger = null; o.reizigerCodenaam = WEG; o.notitie = null; }
      if (betaler) o.betaler = { soort: 'reiziger', key: null };
      o.reizigerVergeten = nu();
      ritten++;
    }
    const reizen = opslag.bak('mobReizen');
    const houd = reizen.filter(r => !r || r.key !== key);
    if (houd.length !== reizen.length) opslag.zetBak('mobReizen', houd);
    const fav = opslag.bak('mobFavorieten');
    const plekken = Array.isArray(fav[key]) ? fav[key].length : 0;
    delete fav[key];
    save();
    return { ritten, reizen: reizen.length - houd.length, plekken };
  }

  return { mobVergeetLid };
};
