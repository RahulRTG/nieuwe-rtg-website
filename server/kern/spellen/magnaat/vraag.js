/* Magnaat: DE VRAAG -- wie er langskomt, en of die bij jou naar binnen gaat.

   Dit is de laag waar de kaart economie wordt. Een kavel heeft passanten,
   toerisme en zakelijke vraag; een sector trekt bepaalde mensen; het seizoen en
   het dagdeel bewegen dat op en neer; prijs, reputatie en marketing bepalen wie
   er van de langslopers ook werkelijk binnenkomt.

   ER WORDT GEEN ENKELE ECHTE INWONER GEMODELLEERD, en dat is niet alleen
   privacy: aggregaten zijn hier ook gewoon beter. Een LLM per burger draaien
   zou onbetaalbaar zijn en niets toevoegen -- wat je wilt weten is hoeveel
   gezinnen er op een zomerzaterdag over de boulevard lopen, en dat is een
   verhouding.

   DE VOLGORDE IS DE UITLEG, en hij staat er in deze volgorde omdat Rahul hem
   straks moet kunnen navertellen zonder iets te verzinnen:

     1. de basis van het kavel        (passanten, toerisme, zakelijk)
     2. wie daarvan bij deze sector past   (segmentgewichten)
     3. het seizoen                   (kustplaats: de zomer is het hele verhaal)
     4. de concurrentie in de zone    (meer van hetzelfde is minder per stuk)
     5. jouw prijs                    (goedkoper trekt meer)
     6. jouw reputatie en marketing   (wat mensen van je weten)

   Elke stap is een vermenigvuldiging met een reden. Dat maakt hem uit te leggen
   EN te toetsen: zet er een op 1 en het verschil is precies wat die stap deed. */
const { SECTOREN } = require('./sectoren');
const { VRAAGFACTOR } = require('./prijsstand');
const { geschiktheid } = require('./kaart');

/* Waar een segment vandaan komt op een kavel. Toeristen volgen `toerisme`,
   zakelijk volgt `zakelijk`, de rest volgt gewoon de passanten. */
const BRON = { toeristen: 'toerisme', zakelijk: 'zakelijk' };

/* De basisvraag van een kavel voor een sector, per maand, in EENHEDEN (couverts,
   kamernachten, klanten). Nog zonder prijs, reputatie of concurrentie: dit is
   "hoeveel mensen komen hier langs die hier iets zouden kunnen willen". */
function basisvraag(kaart, kavel, sector, maand) {
  const s = SECTOREN[sector];
  const zone = kaart.zone.get(kavel.zone);
  const seizoenFactor = 1 + (kaart.seizoen[maand % 12] - 1) * s.seizoen;
  let som = 0;
  for (const [segment, aandeel] of Object.entries(kaart.bevolking)) {
    const gewicht = s.trekt[segment] || 0;
    if (!gewicht) continue;
    const bron = kavel.eigenschappen[BRON[segment] || 'passanten'];
    // toeristen bewegen met het seizoen, de rest veel minder
    const seizoen = segment === 'toeristen' ? seizoenFactor : 1 + (seizoenFactor - 1) * 0.25;
    som += (aandeel / 100) * gewicht * (bron / 100) * seizoen;
  }
  // de geschiktheid van de zone voor deze sector, en de bereikbaarheid
  const bereik = 0.75 + (kavel.eigenschappen.ov + kavel.eigenschappen.parkeren) / 800;
  /* Een INDEX en geen aantal: 1.0 is een gemiddelde plek voor deze sector. Wat
     een index in eenheden per maand betekent staat per sector in `markt` --
     een hotelkamer en een restaurantstoel zijn niet dezelfde eenheid, en een
     getal dat voor allebei geldt zou dus voor geen van beide kloppen. */
  return som * geschiktheid(zone, sector) * bereik;
}

/* De concurrentiedruk: hoeveel bedrijven van dezelfde sector staan er in deze
   zone? De eerste heeft de zone voor zich, de tiende vecht om dezelfde mensen.
   Niet lineair delen -- dan is de tweede vestiging meteen halvering en opent
   niemand er ooit een; wel duidelijk voelbaar. */
const drukFactor = (aantal) => 1 / Math.pow(Math.max(1, aantal), 0.55);

/* De vraag zoals hij werkelijk bij EEN vestiging binnenkomt. Geeft de stappen
   mee terug, want Rahul mag deze uitleg gebruiken en moet hem niet zelf
   verzinnen. */
function vraagVoor(kaart, vestiging, { maand, zoneDruk, marketing }) {
  const s = SECTOREN[vestiging.sector];
  const kavel = kaart.kavel.get(vestiging.kavel);
  const basis = basisvraag(kaart, kavel, vestiging.sector, maand);
  const druk = drukFactor(zoneDruk);
  const prijs = VRAAGFACTOR[vestiging.prijs] || 1;
  /* Reputatie werkt traag en beide kanten op: 50 is neutraal, 100 is een naam
     die mensen doelbewust opzoeken, 0 is een zaak waar niemand meer komt. */
  const reputatie = 0.6 + (vestiging.reputatie / 100) * 0.8;
  /* Marketing heeft een afnemend effect: de eerste euro's brengen je onder de
     aandacht, de laatste niet meer. Zonder die afvlakking is "alles in
     marketing" altijd het goede antwoord, en dan is er geen keuze. */
  const bereikMarketing = 1 + 0.45 * (1 - Math.exp(-(marketing || 0) / 4000));
  // van index naar eenheden per maand: dat is wat `markt` doet
  const eenheden = basis * s.markt * druk * prijs * reputatie * bereikMarketing;
  return {
    eenheden: Math.max(0, eenheden),
    stappen: { basis, druk, prijs, reputatie, marketing: bereikMarketing }
  };
}

module.exports = { basisvraag, vraagVoor, drukFactor, BRON };
