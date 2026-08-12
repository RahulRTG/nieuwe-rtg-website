/* MAGNAAT DAILY -- de stad van vandaag, en er valt niets te halen.

   Fase C, het laatste open stuk (GAMEHALL.md 12.9). En hij begint bij een
   verbod, want "Daily" is in deze industrie de naam van precies het patroon
   dat CLAUDE.md uitsluit: een dagelijkse opgave met een reeks eraan, een
   beloning voor wie komt en een verlies voor wie een dag oversloeg.

   ================== WAT HIJ DUS NIET IS ==================

   Geen dagelijkse opdracht. Geen reeks. Geen inlogbeloning. Geen aftellende
   klok. Geen "nog 4 uur". Niets om te claimen, niets om te missen. Wie hem een
   maand niet opent, is precies even ver als wie hem elke dag las -- dat is
   VERHAAL.md grens 4 (weg zijn mag niets kosten) en CLAUDE.md in een adem.

   ================== WAT HIJ WEL IS ==================

   EEN KRANT. Een stad die door spelers is opgebouwd (./stadsgeheugen.js) heeft
   iets te vertellen, en dat is de zin uit hoofdstuk 10 van de visie: je loopt
   na vijftien jaar door IJmuiden en je ziet wat jullie hebben neergezet. Dit is
   die wandeling, in woorden, en hij verandert doordat er GESPEELD is.

   VIER REGELS, en ze volgen alle vier uit lagen die er al staan.

   1. ER STAAT GEEN PERSOON IN. Geen naam, geen codenaam, geen bedrag, geen
      ranglijst. Dat is niet een filter maar de bouw: hij leest het
      stadsgeheugen, en daar staat per ontwerp niemand in. Daarom valt hij --
      net als dat geheugen, en om woordelijk dezelfde reden -- buiten de
      18+-poort van ./grens.js: er staat geen persoon in.

   2. HIJ WORDT NIET BEWAARD MAAR GEREKEND. Een editie is een functie van de
      stad en de datum, en verder van niets. Dus is er geen editie die je kunt
      MISSEN: die van gisteren is morgen nog precies zo terug te vragen. Dat is
      dezelfde eigenschap als de klok die bijrekent in plaats van tikt, en het
      is meteen het antwoord op "wat als ik een dag oversla".

   3. HIJ IS VOOR IEDEREEN HETZELFDE. Niet gepersonaliseerd op wat jou bindt,
      niet op wat je gisteren deed. Een krant die zich naar de lezer voegt is
      geen krant maar een haakje.

   4. DE STAD IS VAN NIEMAND. Wat erin staat is van iedereen die er speelt,
      inclusief wie er nooit was. Zie ./stadsgeheugen.js.

   DE DATUM DOET ER TOCH IETS TOE, en dat is geen tegenspraak met regel 1 en 2.
   Hij bepaalt alleen de VOLGORDE waarin de stad zijn eigen verhalen vertelt --
   welk stuk vandaag bovenaan staat. Er komt niets bij en er gaat niets af.
   Zonder die draai leest dezelfde stad dertig dagen lang dezelfde zin, en dan
   is het geen krant maar een bordje. */
'use strict';
const F = require('./magnaat/foundation');
const { kaart, stadNaam, stadSleutel } = require('./magnaat/kaart');

/* De draai van de dag. Een vaste functie van stad en datum -- geen toeval, geen
   opgeslagen teller. Dezelfde stad op dezelfde dag geeft dezelfde krant, ook na
   een herstart en ook op een tweede server. */
function draai(stad, datum) {
  let n = 0;
  for (const teken of String(stad) + '|' + String(datum)) n = (n * 31 + teken.charCodeAt(0)) % 1000003;
  return n;
}

/* De datum als YYYY-MM-DD, uit een meegegeven moment. Hij komt van BUITEN en
   niet uit `new Date()` hier: dan is deze module te toetsen zonder de klok te
   verzetten, en dat is dezelfde reden waarom de motor zijn tijd uit de server
   krijgt en niet uit een teller. */
const dagVan = (nu) => new Date(nu).toISOString().slice(0, 10);

/* WAT ER OVER EEN BUURT TE ZEGGEN VALT. De zinnen staan bij het PROJECT en niet
   in een aparte tabel: een project dat een zin krijgt die er niet bij hoort, is
   een krant die iets anders meldt dan er staat. */
function zinnen(stadId, geheugen) {
  const k = kaart(stadId);
  const naamVan = (id) => (k.zones.find(z => z.id === id) || { naam: id }).naam;
  const uit = [];
  const perZone = geheugen.perZone || {};
  for (const [zone, rij] of Object.entries(perZone)) {
    for (const p of rij) {
      const project = F.PROJECTEN.find(x => x.id === p.id);
      if (!project) continue;
      /* DRIE STANDEN EN GEEN PERCENTAGE OP HET SCHERM. "Nog 43% sterk" is een
         getal over iets wat geen getal is; een lezer wil weten of het er nog
         staat zoals het bedoeld was. */
      const staat = p.sterkte > 66 ? 'nieuw' : p.sterkte > 33 ? 'ingeburgerd' : 'verweerd';
      uit.push({ zone, zoneNaam: naamVan(zone), id: p.id, naam: project.naam, staat,
        zin: staat === 'nieuw'
          ? project.naam + ' in ' + naamVan(zone) + ' is nog nieuw; de buurt moet er nog aan wennen.'
          : staat === 'ingeburgerd'
            ? project.naam + ' hoort er in ' + naamVan(zone) + ' inmiddels gewoon bij.'
            : project.naam + ' in ' + naamVan(zone) + ' staat er al zo lang dat niemand zich de lege plek nog herinnert.' });
    }
  }
  return uit;
}

module.exports = ({ stadsgeheugen }) => {
  /* DE EDITIE VAN VANDAAG. `nu` komt van de aanroeper, `stad` is een stadsnaam
     of -sleutel. Geen argument raakt een speler. */
  return function daily(stad, nu) {
    const stadId = stadSleutel(stad) || String(stad || '').toLowerCase();
    const k = kaart(stadId);
    if (!k) return { status: 404, error: 'Die stad kennen we niet.' };
    const dag = dagVan(nu || Date.now());
    const geheugen = stadsgeheugen.beeld(stadId);
    const alles = zinnen(stadId, geheugen);
    const d = draai(stadId, dag);
    /* De volgorde draait met de dag, de INHOUD niet. Een vaste rotatie en geen
       greep uit een zak: zo is elke editie terug te rekenen en mist niemand er
       ooit een. */
    const gedraaid = alles.length ? alles.slice(d % alles.length).concat(alles.slice(0, d % alles.length)) : [];
    /* WAT ER GEBEURT ALS ER NOG NIETS GEBOUWD IS. Geen lege pagina en geen
       aansporing om te gaan spelen -- dat laatste is precies het haakje dat deze
       laag niet mag zijn. Gewoon wat er is: een stad. */
    const kop = gedraaid.length ? gedraaid[0].zin
      : 'In ' + stadNaam(stadId) + ' staat nog niets dat door spelers is neergezet.';
    return {
      status: 200,
      stad: stadNaam(stadId), stadId, dag,
      campagnes: geheugen.potjes || 0,
      kop,
      berichten: gedraaid.slice(0, 4),
      /* Wat er nog te bouwen valt: geen doel en geen opdracht, maar wel het
         antwoord op "en wat kan er nog". Zonder bedragen. */
      nogNiet: F.PROJECTEN.filter(p => !alles.some(x => x.id === p.id)).map(p => p.naam),
      uitleg: 'Deze pagina is een afdruk van de stad zoals spelers hem hebben '
        + 'achtergelaten. Er valt niets te halen en niets te missen: wie hem '
        + 'niet leest, loopt niets mis, en de editie van gisteren is morgen nog '
        + 'precies zo terug te vragen.'
    };
  };
};
module.exports.draai = draai;
module.exports.dagVan = dagVan;
