/* DE KERN SAMENSTELLEN -- deel 3w: de vier wereldlagen (reizen, kantoor,
   sociaal, geld). Uit deel 3 geknipt op de 10 kB-grens; dit is de naad, want
   deze vier zijn puur leeslagen -- ze bezitten niets, schrijven nooit en lezen
   de kern laat. Gemount NA kernlaag3 en VOOR kernlaag3b (zie server.js);
   geldbeleid en geldgraaf in 3b bouwen op de geldwereld hier. */
'use strict';

module.exports = (kern, hulp) => {
/* RTG Reizen (kern/reiswereld.js): de samenhanglaag over de reiswereld -- laag 2
   uit PLATFORM.md. Hij bezit niets en schrijft nooit; hij haalt uw komende reis
   op uit de domeinen zelf (verblijf, reisbureau, luchthaven). Krijgt daarom de
   hele kern mee en leest die laat, want hij hangt aan lagen die in dezelfde
   ronde worden samengesteld. */
Object.assign(kern, require('../kern/reiswereld').maakReiswereld({ kern }));
/* RTG Kantoor (kern/kantoorwereld.js): dezelfde laag, maar dan over de
   kantoorwereld -- agenda, taken, documenten en gedeelde bestanden. Ook deze
   bezit niets en schrijft nooit; werken doet u in de specialist. Dezelfde
   late lezing van de kern om dezelfde reden. */
Object.assign(kern, require('../kern/kantoorwereld').maakKantoorwereld({ kern }));
/* RTG Sociaal (kern/socialewereld.js): dezelfde laag over de sociale wereld --
   gesprekken die op antwoord wachten, aanstaande bijeenkomsten, en wat er in
   uw kring geplaatst is. Ook deze bezit niets en schrijft nooit. */
Object.assign(kern, require('../kern/socialewereld').maakSocialeWereld({ kern }));
/* RTG Geld (kern/geldwereld.js): dezelfde laag over de geldwereld -- wallet,
   verrekeningen, toezeggingen. Bezit niets, schrijft nooit, en telt vooral
   niets zelf op wat een domein al optelt. Geldbeleid en geldgraaf mounten
   direct hierna in ./kernlaag3b.js: de omvangregel hield ze hier weg. */
Object.assign(kern, require('../kern/geldwereld').maakGeldwereld({ kern }));
};
