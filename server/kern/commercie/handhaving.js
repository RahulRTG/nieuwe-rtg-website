/* WORDT DEZE CAPABILITY ERGENS GEVRAAGD?

   DE FOUT DIE HIERONDER LIGT. kern/commercie/capaciteiten.js beschrijft per
   trede wat een klant mag. Op 20 augustus 2026 bleek bij een handmatige telling
   dat zes van de acht capabilities NERGENS werden gevraagd. Het productprofiel
   was een folder: het stond er, en niets hield zich eraan.

   Dat is dezelfde fout als "0% commissie" naast een commissieknop op 12 procent,
   alleen stiller. Een belofte zonder beller ziet er in de code net zo degelijk
   uit als een die wordt afgedwongen -- er staat immers een tabel -- en juist
   daarom vindt niemand hem terug.

   DE REPARATIE IS NIET BETER TELLEN. Een telling met de hand is precies een keer
   goed, namelijk op de dag dat je hem doet. Deze module doet die telling
   machinaal, zodat een nieuwe stille capability op de dag van invoeren zakt in
   plaats van over een jaar.

   WAT ALS EEN AANROEPER TELT, EN WAT NIET.

     POORT          de capability staat als letterlijke tekenreeks in een
                    `mag(...)`-aanroep, in server/, buiten de eigen module. Dit
                    is de enige soort die telt: hier wordt iemand tegengehouden.
     BESCHRIJVING   `tredenMet('can_be_partner')` om een zin te bouwen ("hiervoor
                    heeft u Business Lite nodig"). Nuttig, maar het houdt niemand
                    tegen -- een scherm dat vertelt wat je nodig hebt, is geen
                    slot.
     TOETS          hetzelfde in test/. Een toets die een tabel navertelt, bewijst
                    dat de tabel klopt en niet dat er iets mee gebeurt. Dit is
                    hoe de zes stille capabilities er destijds gedekt uitzagen.
     VERMELDING     de naam staat in COMMENTAAR. Dit is de gevaarlijkste soort en
                    daarom telt hij apart: een toelichting die uitlegt hoe
                    `can_use_pos` werkt, leest als bewijs dat het werkt.

   COMMENTAAR TELT DUS NIET MEE, en daarvoor moet het eruit gestript worden
   voordat er iets geteld wordt. Dat leeswerk staat in ./handhaving/tekst.js:
   die laag kent geen capabilities, alleen aanhalingstekens.

   DE BEKENDE ONVOLKOMENHEDEN, en ze staan hier omdat een meetfout die je kent
   iets anders is dan een meetfout die je niet kent:

   1. Een reguliere expressie die `/*` of `//` bevat kan de stripper in de war
      brengen; zie ./handhaving/tekst.js.
   2. DEZE METER LEEST TEKST EN VOLGT GEEN AANROEPGRAAF. Een `beoordeel(...)` in
      een functie die zelf nergens wordt aangeroepen, telt hier mee -- dat is
      dezelfde stille belofte, een laag dieper. Dat is bij een mutatie
      aangetoond en niet weggeredeneerd: het weghalen van de aanroep in
      server/opzet/leverancierpoort.js liet deze meter groen. Wat die laatste
      schakel WEL vasthoudt is een gedragstoets op de deur zelf
      (test/leverancierpoort.test.js, "de abonnementspoort houdt een onderdeel
      tegen"), en die zakte er wel op. Twee beweringen, twee bewijzen: deze meter
      zegt dat de tabel vanuit productiecode wordt geraadpleegd, die toets zegt
      dat het raadplegen een verzoek tegenhoudt.

   EN EEN TABEL DAN? De eerste meting zei dat vijf capabilities stil waren. De
   reparatie werd een TABEL (kern/commercie/routepoort.js) die pad-voorvoegsels
   aan capabilities knoopt en er `mag()` op loslaat -- want een controle in elk
   kassabestand is de zevenenzeventigste pas-id-controle in een ander jasje.
   Daarmee stond de capability als tekenreeks in een tabel en niet in een
   `mag()`-aanroep, en de meter noemde hem nog steeds stil.

   Dat is een echte vraag en geen meetfoutje: hoe weet je dat een tabel iets DOET?
   Het antwoord is niet "de meter een uitzondering geven" -- dan meet hij zijn
   eigen oplossing goed en de volgende niet. Het antwoord is GEDRAGSBEWIJS: voor
   elke regel in die tabel zoekt deze module een trede die de capability NIET
   heeft, roept `beoordeel()` aan, en telt de regel alleen mee als hij werkelijk
   weigert. Een tabelregel die niemand tegenhoudt, telt niet -- en dat is
   dezelfde regel als voor commentaar, alleen strenger uitgevoerd.

   EN DE TABEL ZELF HEEFT EEN AANROEPER NODIG. Anders verplaatst het probleem
   zich een laag: een tabel die weigert maar nergens wordt geraadpleegd, is
   precies dezelfde stille belofte. Dus dezelfde regel, een niveau hoger:
   `beoordeel` moet buiten zijn eigen module worden aangeroepen. Beide staan in
   ./handhaving/routebewijs.js, want die laag voert code UIT en deze leest tekst.

   WAT DIT NIET IS: een dekkingsmeter voor de hele codebase. Het beantwoordt
   precies een vraag, en dat is de tweede van de vier regels uit CONTROLPLANE.md:
   GEEN CAPABILITY ZONDER CALLER. */
'use strict';

const caps = require('./capaciteiten');
const routepoort = require('./routepoort');
const { gebruiken } = require('./handhaving/tekst');
const { routebewijs, tabelHeeftAanroeper, TABEL } = require('./handhaving/routebewijs');
/* Het spiegelbeeld staat apart: deze meter telt wie er VRAAGT, die kijkt of er
   iemand kan KOPEN. Zie ./handhaving/spoken.js. */
const { maakSpoken } = require('./handhaving/spoken');

/* De eigen module telt niet mee. Een capability die alleen in capaciteiten.js
   voorkomt, is een rij in een tabel en verder niets -- dat is precies de stand
   die deze meter moet vinden. */
const EIGEN = 'kern/commercie/capaciteiten.js';

/* De meting. `bestanden` is een lijst { pad, bron }; hij komt van de aanroeper
   zodat deze module geen mappenstructuur hoeft te kennen en een toets een
   verzonnen huis kan aanleveren. */
function meet(bestanden) {
  const lijst = Array.isArray(bestanden) ? bestanden : [];
  const bewijs = routebewijs();
  const tabelLeeft = tabelHeeftAanroeper(lijst);
  const rijen = [];
  for (const cap of Object.keys(caps.CAPS)) {
    const poorten = [], beschrijvingen = [], toetsen = [], overig = [], vermeldingen = [];
    for (const b of lijst) {
      const pad = String(b.pad || '').replace(/\\/g, '/');
      if (pad.endsWith(EIGEN)) continue;
      const isToets = /(^|\/)test\//.test(pad);
      const g = gebruiken(b.bron, cap);
      for (const x of g) {
        const plek = { pad, regel: x.regel, aanroep: x.aanroep };
        if (isToets) toetsen.push(plek);
        else if (x.soort === 'poort') poorten.push(plek);
        else if (x.soort === 'beschrijving') beschrijvingen.push(plek);
        else overig.push(plek);
      }
      /* Alleen-in-commentaar: de naam staat er wel, maar niet in code. Dit is de
         soort die eruitziet als bewijs en het niet is. */
      if (!g.length && String(b.bron || '').includes(cap)) vermeldingen.push({ pad });
    }
    const routes = tabelLeeft ? (bewijs[cap] || []) : [];
    rijen.push({ cap, uitleg: caps.CAPS[cap], treden: caps.tredenMet(cap),
      poorten, routes, beschrijvingen, toetsen, overig, vermeldingen,
      stil: poorten.length === 0 && routes.length === 0 });
  }
  return { rijen, tabelLeeft, stil: rijen.filter(r => r.stil).map(r => r.cap), aantal: rijen.length };
}

/* De poort. Een capability zonder poort is een belofte zonder beller, en de zin
   die daarbij hoort zegt er meteen bij wat er WEL is -- anders gaat iemand
   zoeken naar iets dat hij al gevonden had. */
function poort(bestanden) {
  const m = meet(bestanden);
  const problemen = [];
  for (const r of m.rijen) {
    if (!r.stil) continue;
    const troost = (bewijsVanTabel(m, r.cap) && !m.tabelLeeft)
      ? ' (de routetabel weigert hem wel, maar `beoordeel` wordt nergens aangeroepen -- dan is de tabel zelf de stille belofte)'
      : r.toetsen.length
      ? ' (er zijn wel ' + r.toetsen.length + ' toetsen die de tabel navertellen, en dat is niet hetzelfde)'
      : (r.beschrijvingen.length ? ' (hij wordt wel beschreven, maar beschrijven is geen tegenhouden)'
        : (r.vermeldingen.length ? ' (hij staat wel in commentaar, en dat leest als bewijs)' : ''));
    problemen.push(r.cap + ' wordt nergens in server/ gevraagd' + troost +
      '. Een capability zonder caller is een belofte zonder beller.');
  }
  return { ok: problemen.length === 0, problemen, ...m };
}

/* Weigert de routetabel voor deze capability, los van de vraag of de tabel zelf
   wordt aangeroepen? Alleen om een nuttiger zin te kunnen schrijven. */
function bewijsVanTabel(m, cap) {
  return routepoort.KAART.some(([, c]) => c === cap);
}

/* De tekstlaag komt hier ook naar buiten. Niet omdat deze module hem doorgeeft
   uit beleefdheid, maar omdat de toets die de stripper op de proef stelt bij de
   meting hoort en niet bij een tweede deur. */
const tekst = require('./handhaving/tekst');
const spoken = maakSpoken(meet);

module.exports = { meet, poort, routebewijs, spoken, EIGEN, TABEL,
  gebruiken: tekst.gebruiken, zonderCommentaar: tekst.zonderCommentaar,
  omhullendeAanroep: tekst.omhullendeAanroep };
