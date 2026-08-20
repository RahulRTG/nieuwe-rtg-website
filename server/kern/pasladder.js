/* DE LADDER: welke abonnementen bestaan er, en wat is de BODEM van elk.

   Tot nu toe stonden de bedragen los van elkaar: een standaard in pasprijs.js,
   dezelfde standaard nog eens in geldregie.js, en "Business is op maat" als een
   losse `if` op drie plekken. Dat werkte zolang er drie passen waren en er niets
   tussen consument en enterprise zat. Het besluit van 20 augustus 2026 zet er een
   MKB-laag tussen (Business Lite), en dan is een lijstje `if`-regels niet meer
   genoeg: er komt een trede bij, elke trede krijgt een bodem, en de vraag "mag
   dit bedrag?" moet op EEN plek beantwoord worden.

   DE PRIJSFORMULE, en waarom de ladder er zo uitziet:

       prijs = toegang + verbruik + verantwoordelijkheid

   - TOEGANG is het abonnement. Dat staat hieronder.
   - VERBRUIK is AI, betaaldienst en echte doorbelaste kosten (sms, post,
     hardware). Dat hoort NIET in dit bestand: verbruik is een meting en geen
     tarief, en een bedrag dat je hier zou neerzetten zou een schatting zijn.
   - VERANTWOORDELIJKHEID is wat een mens op zich neemt (enterprise-relatie,
     menselijke concierge). Dat is de reden dat de bovenste twee treden
     CONTRACTUEEL zijn en geen prijskaartje dragen.

   EEN BODEM IS GEEN PRIJS. Dat is de scherpste regel hier en hij komt uit een
   fout die in dit huis echt is gemaakt: lid.js had { business: 7500 } hard
   staan en zette 7500 x 1,21 = 9.075 euro op de factuur van een lid -- een
   bedrag dat nergens was afgesproken (zie de kop van ./pasprijs.js). Een bodem
   heeft precies twee taken: een ingevoerd bedrag WEIGEREN als het eronder ligt,
   en op een prijslijst als "vanaf" getoond worden. Hij mag nooit op een factuur
   belanden. Daarom geeft `maandCentenVan` voor een contractuele trede null en
   niet de bodem: null betekent "hier is nog niets afgesproken", en dat is een
   antwoord. Nul zou "gratis" betekenen en de bodem zou "we hebben 5.000
   afgesproken" betekenen -- allebei een leugen op een rekening.

   DE ZES REGELS die de eigenaar hard wilde hebben, en waar ze staan:

     1. Er is precies EEN gratis abonnement          -> `enigeGratis()`, toets 1
     2. Business Lite kost minimaal 150 euro         -> bodemCenten, toets 3
     3. Business kost minimaal 5.000 euro            -> bodemCenten, toets 3
     4. Lifestyle kost minimaal 20.000 euro          -> bodemCenten, toets 3
     5. AI boven de inbegrepen capaciteit vraagt een bundel, toestemming of een
        vooraf ingestelde aanvulling                 -> NIET hier; zie PRIJZEN.md
     6. Geen abonnement veroorzaakt ooit ONGEMERKT variabele kosten
                                                     -> NIET hier; zie PRIJZEN.md

   Regel 5 en 6 gaan over verbruik en staan er bewust niet in. Ze zijn niet
   vergeten: ze vragen een tegoedlaag die nog niet bestaat, en een regel die
   nergens wordt afgedwongen is een belofte en geen regel (LAT.md). PRIJZEN.md
   zegt per regel wat er eerst nodig is.

   BESCHIKBAAR IS IETS ANDERS DAN BESLOTEN. Business Lite staat hieronder met
   `beschikbaar: false`: de prijs is besloten, de pas zelf bestaat nog niet (die
   raakt de toegangsregels, de stem per pas en de functieschakelaars -- 77
   bestanden noemen een pas-id). Zo staat het besluit vast zonder dat er een
   prijslijst verschijnt voor iets wat je niet kunt kopen. */
'use strict';

/* De treden, in de volgorde waarin ze aan een mens getoond worden: van gratis
   naar zwaarst. `bodemCenten` is de ondergrens, `standaardCenten` de prijs die
   geldt zolang de boardroom niets anders zet.

   vast          -- het bedrag staat en is niet instelbaar (alleen de gratis app)
   contractueel  -- de hoogte spreek je per klant af; de bodem is de "vanaf"
   beschikbaar   -- bestaat de pas al als product? */
const LADDER = [
  { id: 'gratis', naam: 'Gratis app',
    bodemCenten: 0, standaardCenten: 0,
    vast: true, contractueel: false, beschikbaar: true,
    voor: 'de maatschappelijke laag: de minimale ingang tot het RTG OS' },

  { id: 'rtg', naam: 'RTG Pass',
    bodemCenten: 6500, standaardCenten: 6500,
    vast: false, contractueel: false, beschikbaar: true,
    voor: 'de consument' },

  { id: 'business-lite', naam: 'RTG Business Lite',
    bodemCenten: 15000, standaardCenten: 15000,
    vast: false, contractueel: false, beschikbaar: false,
    voor: 'zzp en klein MKB: software-as-a-service, geen omzetcommissie' },

  { id: 'business', naam: 'RTG Business Pass',
    bodemCenten: 500000, standaardCenten: null,
    vast: false, contractueel: true, beschikbaar: true,
    voor: 'grotere organisaties: een enterprise-relatie' },

  { id: 'lifestyle', naam: 'RTG Lifestyle Pass',
    bodemCenten: 2000000, standaardCenten: null,
    vast: false, contractueel: true, beschikbaar: true,
    voor: 'high-touch: concierge en volledige regie, met een mens erachter' }
];

const OP_ID = new Map(LADDER.map(t => [t.id, t]));

function trede(pas) { return OP_ID.get(String(pas || '')) || null; }
function treden() { return LADDER.map(t => ({ ...t })); }

/* Het enige gratis abonnement (regel 1). Geen constante 'gratis' maar een
   afleiding uit de ladder zelf: zou iemand een tweede trede op bodem nul zetten,
   dan valt de toets om in plaats van dat de regel stil verdwijnt. */
function gratisTreden() { return LADDER.filter(t => t.bodemCenten === 0); }
function enigeGratis() {
  const g = gratisTreden();
  return g.length === 1 ? g[0].id : null;
}

/* De bodem van een trede, in centen. Een onbekende pas heeft geen bodem, en dat
   is null en geen nul -- nul zou betekenen dat alles mag. */
function bodemCentenVan(pas) {
  const t = trede(pas);
  return t ? t.bodemCenten : null;
}

/* Mag dit maandbedrag? Geeft null als het mag, en anders de zin die de invoerder
   te zien krijgt. De tekst hoort hier en niet bij de aanroeper: dan zeggen de
   boardroom, de API en een latere zelfbedieningspagina alle drie hetzelfde. */
function keurCenten(pas, centen) {
  const t = trede(pas);
  if (!t) return 'Deze pas bestaat niet.';
  if (t.vast) return t.naam + ' is en blijft kosteloos; dat bedrag staat vast.';
  if (t.contractueel)
    return t.naam + ' spreekt u per klant af (vanaf ' + euro(t.bodemCenten) + ' per maand); die legt u vast op het contract, niet in de prijslijst.';
  if (!Number.isFinite(centen)) return 'Geef een bedrag in euro per maand.';
  if (centen < t.bodemCenten)
    return t.naam + ' kost minimaal ' + euro(t.bodemCenten) + ' per maand.';
  return null;
}

// een centenbedrag als nette euro-zin, voor de foutmeldingen hierboven
function euro(centen) {
  return '€ ' + (centen / 100).toLocaleString('nl-NL',
    { minimumFractionDigits: centen % 100 ? 2 : 0, maximumFractionDigits: 2 });
}

/* De standaardbedragen als plat object, voor wie alleen de terugvalwaarden wil
   (./pasprijs.js). Contractuele treden staan er met null in: geen bedrag is hier
   een antwoord. */
function standaarden() {
  const uit = {};
  for (const t of LADDER) uit[t.id] = t.standaardCenten;
  return uit;
}

module.exports = { LADDER, treden, trede, bodemCentenVan, keurCenten, standaarden, enigeGratis, gratisTreden, euro };
