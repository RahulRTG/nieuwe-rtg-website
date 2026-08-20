/* GEDRAGSBEWIJS: HOUDT DIE TABEL WERKELIJK IEMAND TEGEN?

   ../handhaving.js telt aanroepen door TEKST te lezen. Deze laag doet het
   omgekeerde en het is met opzet een ander onderwerp: zij VOERT UIT. Voor elke
   regel in kern/commercie/routepoort.js zoekt zij een trede die de capability
   niet heeft, roept `beoordeel()` aan, en telt de regel alleen mee als hij
   werkelijk weigert.

   WAAROM DIT MOEST BESTAAN. De eerste meting zei dat vijf capabilities stil
   waren. De reparatie werd een tabel -- want een controle in elk kassabestand is
   de zevenenzeventigste pas-id-controle in een ander jasje -- en daarmee stond
   de capability in een tabel en niet in een `mag()`-aanroep. De meter noemde hem
   nog steeds stil, en dat was een terechte vraag: hoe weet je dat een tabel iets
   DOET? Het antwoord was niet de meter een uitzondering geven -- dan meet hij
   zijn eigen oplossing goed en de volgende niet. Het antwoord staat hier. */
'use strict';

const caps = require('../capaciteiten');
const routepoort = require('../routepoort');
const { zonderCommentaar } = require('./tekst');

const TABEL = 'kern/commercie/routepoort.js';

/* GEDRAGSBEWIJS VOOR DE ROUTETABEL. Niet "staat de naam erin" maar "houdt hij
   iemand tegen": voor elke regel zoeken we een trede die de capability niet
   heeft en kijken we of `beoordeel` dan werkelijk weigert. Een tabelregel die
   niemand tegenhoudt, telt niet mee -- ook niet als hij er keurig uitziet.

   Kan een capability niet weerlegd worden omdat ELKE trede hem heeft, dan valt
   er niets te bewijzen en telt de regel ook niet. Dat is geen strengheid om de
   strengheid: een grens die niemand raakt, is geen grens. */
function routebewijs() {
  const uit = {};
  const alleTreden = Object.keys(caps.PROFIEL);
  /* De treden waar een ZAAK werkelijk op kan staan. kern/commercie/
     zaakabonnement.js weigert een zaak op een consumententrede te zetten, dus
     "weigert voor gratis" bewijst wel dat de bedrading werkt maar niet dat er
     ooit iemand tegenaan loopt. Dat onderscheid staat apart in `raakt`, want een
     grens die vandaag niemand raakt is geen fout -- POS zit nu eenmaal in beide
     zakelijke treden -- maar het is wel iets anders dan een grens die bijt. */
  const zakelijk = alleTreden.filter(t => caps.mag(t, 'can_be_partner'));
  for (const [voorvoegsel, cap] of routepoort.KAART) {
    const zonder = alleTreden.find(t => !caps.mag(t, cap));
    if (!zonder) continue;                    // niets te weerleggen, dus niets bewezen
    let r = null;
    try { r = routepoort.beoordeel(voorvoegsel, zonder); } catch (e) { r = null; }
    if (!r || r.ok !== false || r.cap !== cap) continue;   // de regel weigert niet: telt niet
    (uit[cap] = uit[cap] || []).push({ pad: voorvoegsel, weigertVoor: zonder,
      raakt: zakelijk.filter(t => !caps.mag(t, cap)) });
  }
  return uit;
}

/* En de tabel zelf moet een aanroeper hebben, anders verplaatst de stille
   belofte zich een laag omhoog. Dezelfde regel, een niveau hoger.

   DE TWEE INGANGEN STAAN MET NAAM. Niet "elke geexporteerde functie": de tabel
   exporteert ook `capabilityVoor`, en dat is een opzoeking en geen oordeel. Wie
   die zou meetellen, laat een module die alleen wil WETEN welke capability bij
   een pad hoort, doorgaan voor een module die iemand tegenhoudt.

   Dit was bijna misgegaan. Toen de zaak-opzoeking van de leverancierspoort naar
   `voorZaak` verhuisde, riep de poort geen `beoordeel` meer aan -- en de meter
   bleef groen op een aanroep die er toevallig ook nog stond, in een route die
   alleen de terugvaltrede wilde weten. Groen om de verkeerde reden is erger dan
   rood. */
const INGANGEN = ['beoordeel', 'voorZaak'];
const AANROEP = new RegExp('\\b(?:' + INGANGEN.join('|') + ')\\s*\\(');

function tabelHeeftAanroeper(lijst) {
  return (lijst || []).some(b => {
    const pad = String(b.pad || '').replace(/\\/g, '/');
    if (pad.endsWith(TABEL) || /(^|\/)test\//.test(pad)) return false;
    return AANROEP.test(zonderCommentaar(b.bron));
  });
}

module.exports = { routebewijs, tabelHeeftAanroeper, INGANGEN, TABEL };
