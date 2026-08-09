/* Het Privekantoor, deelbestand "keten": wat een verzoek in een domein raakt.

   Vakkennis in tabelvorm, en met opzet geen berekening: een diner thuis raakt
   gasten, wijn, personeel, de woning en vervoer, en dat is zo of er nu iets in
   de graaf staat of niet. Zie ./orkestratie.js voor hoe hij wordt gebruikt en
   waarom de graaf er nog naast staat.

   Elk stuk noemt het domein waaronder het VALT -- niet het domein van het
   verzoek -- want daar hangt zijn mandaat aan. */
'use strict';

/* De keten per domein. Elk stuk noemt het domein waaronder het VALT -- niet het
   domein van het verzoek -- want daar hangt zijn mandaat aan. */
// de twee kamers die nooit door een ander verzoek worden meegenomen
const NOOIT = new Set(['gezondheid', 'nalatenschap']);
const K = (domein, wat, waarom) => ({ domein, wat, waarom });
const KETEN = {
  reizen: [
    K('gezelschap', 'Reisdocumenten van uw gezelschap', 'Een paspoort dat tijdens uw reis verloopt, verloopt op de verkeerde plek.'),
    K('huishouden', 'Het huis tijdens uw afwezigheid', 'Personeel, post, toezicht en de dingen die doorlopen.'),
    /* De dieren stonden hier NIET, en dat viel op zodra de eerste proef liep:
       het huis, de wagens en de paspoorten kwamen langs en de hond niet.
       Niemand vergeet zijn eigen hond, maar iedereen vergeet hem in een lijst --
       en dat is precies waar zo'n lijst voor is. */
    K('dieren', 'Uw dieren', 'Wie er voor ze zorgt, en welke vaccinatie er in die weken verloopt.'),
    K('vervoer', 'Heen en terug, en wat er blijft staan', 'Ook een wagen die stilstaat heeft zijn keuring.'),
    K('beveiliging', 'Het huis dat leegstaat', 'Alarm, camera en wie er een sleutel heeft.'),
    K('kring', 'Wat u in die weken zou missen', 'Verjaardagen en afspraken vallen niet stil omdat u weg bent.'),
    K('gelegenheden', 'Toezeggingen in die periode', 'Wat u al had toegezegd, zegt u liever nu af dan later.'),
    K('reputatie', 'Wat er in die weken naar buiten gaat', 'Een embargo of een optreden houdt geen vakantie.')
  ],
  gelegenheden: [
    K('kring', 'Gasten en uitnodigingen', 'Wie komt er, en wat weten wij al van hen?'),
    K('gezelschap', 'Personeel voor die avond', 'Bediening, keuken en wie er blijft.'),
    K('collectie', 'Wijn uit uw kelder', 'Wat staat er klaar, en wat drinkt nu op zijn mooist?'),
    K('huishouden', 'De woning gereed', 'Schoonmaak, inrichting en wat er die dag nog moet gebeuren.'),
    K('vervoer', 'Vervoer voor uw gasten', 'Halen, brengen en waar iedereen parkeert.')
  ],
  huishouden: [
    K('gezelschap', 'Wie het uitvoert', 'Uw vaste mensen, of iemand die wij erbij halen.'),
    K('vermogen', 'Wat het aan de woning verandert', 'Verbouwing en onderhoud raken de waarde en de polis.'),
    K('beveiliging', 'Wat het aan de beveiliging raakt', 'Werk in huis betekent mensen in huis.'),
    K('dieren', 'Uw dieren tijdens het werk', 'Lawaai, open deuren en vreemden over de vloer.')
  ],
  vervoer: [
    K('vermogen', 'Verzekering en waarde', 'Een aanschaf of ingreep hoort in het register te staan.'),
    K('gezelschap', 'Wie ermee rijdt', 'Chauffeur, sleutels en de afspraken eromheen.')
  ],
  collectie: [
    K('vermogen', 'Taxatie en polis', 'Wat u toevoegt, hoort verzekerd en getaxeerd te zijn.'),
    K('huishouden', 'Waar het komt te staan', 'Klimaat, ruimte en beveiliging.'),
    K('beveiliging', 'Hoe het beveiligd wordt', 'Een stuk van waarde verandert wat er nodig is.')
  ],
  kring: [
    K('gelegenheden', 'Het moment zelf', 'Een attentie is vaak een afspraak in vermomming.')
  ],
  vermogen: [
    K('huishouden', 'Wat het in huis betekent', 'Een aankoop moet ergens staan en verzorgd worden.')
  ],
  gezelschap: [
    K('huishouden', 'Het rooster thuis', 'Wie er komt en wanneer raakt het huishouden.')
  ],
  reputatie: [
    K('kring', 'Wie het moet weten', 'Relaties horen het liever van u dan uit de krant.'),
    K('gelegenheden', 'Het moment eromheen', 'Een optreden brengt vaak een diner of een ontvangst mee.')
  ],
  beveiliging: [
    K('huishouden', 'Wat er in huis verandert', 'Nieuwe apparatuur, nieuwe mensen, nieuwe sleutels.'),
    K('gezelschap', 'Wie ervan moet weten', 'Staf die niet is ingelicht, zet het alarm af.')
  ],
  dieren: [
    K('reizen', 'Als u weg bent', 'Meenemen of laten verzorgen is een besluit met papieren eraan.'),
    K('huishouden', 'Thuis', 'Wie voert, uitlaat en let op.')
  ],
  filantropie: []
};


module.exports = { KETEN, NOOIT };
