/* DE KERN SAMENSTELLEN -- deel 3c van 7: de vier samenhanglagen.

   Afgesplitst van ./kernlaag3.js toen die bij het samenvoegen met main over de
   tienkilobyte-grens ging. De knip loopt langs een echte naad en niet langs een
   willekeurige regel: dit zijn de vier lagen van PLATFORM.md die NIETS bezitten
   en NOOIT schrijven. Ze halen bij elkaar wat de domeinen al weten -- de reis
   die eraan komt, de werkdag, wat er in uw kring speelt, hoe u er financieel
   voor staat -- en werken doet u in de specialist eronder.

   Ze lezen de kern allemaal LAAT (in hun functies), want ze hangen aan lagen
   die in dezelfde ronde worden samengesteld. Daarom mogen ze samen achteraan,
   en daarom doet hun onderlinge volgorde er niet toe.

   Gemount vanaf de laatste regel van ./kernlaag3.js, dus op exact de plek waar
   ze eerst zelf stonden. Wie hem verplaatst, verplaatst gedrag: geldbeleid en
   geldgraaf komen er in ./kernlaag3b.js direct achteraan. */
'use strict';

module.exports = (kern) => {
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
