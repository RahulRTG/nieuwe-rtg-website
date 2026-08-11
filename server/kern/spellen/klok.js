/* Spellen (deelmodule): DE KLOK -- hoe lang een beurt mag duren.

   Tot nu toe had een potje geen tijd. Een partij liep tot iemand won of opgaf,
   en als er niets meer gebeurde bleef hij dertig dagen staan tot de opruiming
   hem weghaalde. Dat werkt voor twee mensen die tegelijk online zijn en voor
   niets anders: tien schaakpartijen tegelijk, of een Magnaat-campagne over drie
   weken, vraagt dat een beurt een LENGTE heeft.

   DRIE TEMPI, en ze verschillen niet in techniek maar in belofte:

     live      30s / 5m / 15m   samen aan tafel of tegelijk online
     relaxed   6u / 12u         een partij die over de dag loopt
     longplay  24u / 72u        Magnaat, en tien partijen naast elkaar

   DE TEMPOLIJST STAAT HIER EN NIET PER SPEL. Een spel zegt in `vormen` of het
   async KAN ('live' is de standaard); wélke tempi er bestaan is een eigenschap
   van het platform, want ze zijn voor elk async spel hetzelfde. Zou elk spel
   zijn eigen lijst dragen, dan hadden we zestien plekken waar '12u' kan gaan
   afwijken zonder dat iemand dat besloot. Een spel dat later een eigen set
   nodig heeft kan er een toevoegen; dan is dát de uitzondering die om uitleg
   vraagt.

   WAT ER GEBEURT ALS DE KLOK VERLOOPT -- een productbesluit en geen detail, dus
   het staat hier met de afweging erbij. Drie opties:

     1. verlies door tijd. Eerlijk in een competitie, hard in een vriendenpotje:
        je verliest een partij van drie weken omdat je een weekend weg was.
     2. niets. Dan is de klok informatie en blijft de partij liggen tot de
        opruiming; dat is de situatie van hiervoor.
     3. DE KLOK VERLOOPT NAAR EEN AANBOD. Dit is wat het geworden is.

   Bij (3) krijgt de tegenstander na afloop van de beurt de mogelijkheid om de
   partij toe te wijzen. Doet hij niets, dan gebeurt er niets. In een
   TOERNOOIWEDSTRIJD verloopt hij wél vanzelf, want daar wacht een hele ronde op
   een uitslag en hangt die uitslag aan een afspraak die vooraf is gemaakt.

   TOEWIJZEN IS GEWOON OPGEVEN, namens de speler die niet kwam. Dat loopt
   daarom langs `spelOpgeven` en niet langs een eigen pad: die functie legt de
   uitslag vast, schuift het toernooi door en seint de rest. Een tweede manier
   om een potje te beeindigen zou een tweede plek zijn waar dat vergeten kan
   worden -- dezelfde redenering waarmee `spelVergeet` weggaan als opgeven
   behandelt.

   DE VERVALTERMIJN IS EEN NAAD, EN VANDAAG GEEN GEDRAGSVERANDERING. Dat staat
   er met zoveel woorden bij, want ik had het eerst mis.

   Het plan was: "dertig dagen stilte is te kort voor Long Play, want zes
   spelers met 72 uur per beurt lopen daar tegenaan". Nagerekend klopt dat niet.
   `stil` wordt gemeten op de laatste ZET van wie dan ook en reset dus bij elke
   handeling aan tafel; de langste stilte die legitiem kan ontstaan is EEN
   speler die zijn volle beurt opmaakt, en dat is bij 72 uur precies drie dagen.
   Dertig dagen stilte betekent dat er werkelijk niemand meer speelt, bij elk
   tempo dat we hebben.

   Bovendien is `10 x 72 uur` toevallig exact dertig dagen, dus `max(30 dagen,
   10 x tempo)` geeft bij ELK bestaand tempo hetzelfde antwoord als de vaste
   maand die er stond. De formule staat er dus als NAAD -- de regel is nu
   uitgesproken en toetsbaar in plaats van een getal in een if -- en niet omdat
   er vandaag iets anders uitkomt. Komt er ooit een tempo boven 72 uur, dan
   schuift de termijn vanzelf mee.

   EEN MUTATIE HIEROP WORDT NIET GEPAKT, en dat hoort erbij te staan: wie in
   opruimen.js `vervalMs(p)` vervangt door `30 * 86400000` breekt geen enkele
   toets, want die twee zijn vandaag gelijk. Dat is dezelfde soort eerlijkheid
   als bij de redundante kleurcontrole in schaak.js. */

const MINUUT = 60000, UUR = 3600000, DAG = 24 * UUR;

// de tempi zelf: sleutel -> lengte van een beurt
const TEMPO = {
  '30s': 30000, '5m': 5 * MINUUT, '15m': 15 * MINUUT,
  '6u': 6 * UUR, '12u': 12 * UUR,
  '24u': 24 * UUR, '72u': 72 * UUR
};

// welk tempo bij welke belofte hoort; de client toont ze in deze groepen
const TEMPI = {
  live: ['30s', '5m', '15m'],
  relaxed: ['6u', '12u'],
  longplay: ['24u', '72u']
};

const VERLATEN_BODEM = 30 * DAG;   // zoals het was, voor een potje zonder klok
const GEMISTE_BEURTEN = 10;        // waarna ook een Long Play-partij verlaten heet

module.exports = (ctx) => {
  /* `SPEL` wordt bij elke aanroep uit de context gelezen en niet uitgepakt: het
     register vult die tabel pas na deze module. Zelfde late binding als in
     gedeeld.js, en om dezelfde reden. */
  const spel = (soort) => (ctx.SPEL || {})[soort];
  const nu = () => Date.now();

  // een spel is async als het dat zegt; 'live' is de stille standaard
  const kanAsync = (soort) => {
    const s = spel(soort);
    return !!(s && Array.isArray(s.vormen) && s.vormen.includes('async'));
  };

  /* Mag dit potje op dit tempo? Geen tempo is altijd goed -- dat is een gewoon
     potje zoals ze er tot nu toe waren. */
  function tempoFout(soort, tempo) {
    if (!tempo) return null;
    if (!TEMPO[tempo]) return 'Dat tempo bestaat niet.';
    if (!kanAsync(soort)) return 'Dit spel speel je live; er is geen klok per beurt.';
    return null;
  }

  /* De beurt begint NU. Aangeroepen bij het starten van een potje en na elke
     geaccepteerde zet, op dezelfde plek waar `zetAt` wordt gezet -- een klok
     die op een tweede moment wordt bijgewerkt loopt vroeg of laat uit de pas
     met de zet waar hij bij hoort. */
  function zetKlok(potje) {
    if (!potje || !potje.tempo || !TEMPO[potje.tempo]) return;
    potje.beurtTot = new Date(nu() + TEMPO[potje.tempo]).toISOString();
  }

  const verlopen = (potje) => !!(potje && potje.tempo && potje.beurtTot &&
    potje.status === 'bezig' && nu() > new Date(potje.beurtTot).getTime());

  const soortVan = (tempo) => Object.keys(TEMPI).find(k => TEMPI[k].includes(tempo)) || null;

  /* Wat de client van de klok ziet. Bewust GEEN aftellende seconden bij relaxed
     en longplay: een klok die zichtbaar wegtikt op een partij van drie dagen is
     de kunstmatige urgentie die CLAUDE.md verbiedt. De client krijgt het
     eindmoment en zegt "nog 18 uur"; hoeveel preciezer dat wordt is zijn keuze,
     en bij live is dat terecht een seconde. */
  function klokStand(potje) {
    if (!potje || !potje.tempo) return null;
    return { tempo: potje.tempo, soort: soortVan(potje.tempo),
      beurtTot: potje.beurtTot || null, verlopen: verlopen(potje) };
  }

  /* Hoe lang een lopend potje stil mag liggen voordat de opruiming hem verlaten
     noemt. Zonder klok: precies zoals het was. */
  const vervalMs = (potje) => {
    const ms = potje && potje.tempo && TEMPO[potje.tempo];
    return Math.max(VERLATEN_BODEM, ms ? ms * GEMISTE_BEURTEN : 0);
  };

  /* MAG IK DEZE PARTIJ TOEWIJZEN? Geeft de speler terug die niet kwam, of een
     reden waarom het niet kan. De aanroeper (partij.js) doet er `spelOpgeven`
     mee namens die speler -- hier wordt niets veranderd, zodat er maar EEN plek
     is die een potje beeindigt.

     Wie aan zet is kan zijn eigen klok niet laten verlopen en dan de partij
     opeisen; dat is de enige controle die hier echt iets tegenhoudt. */
  function magToewijzen(mij, potje) {
    if (!potje || potje.status !== 'bezig') return { error: 'Dit potje loopt niet (meer).' };
    if (!potje.tempo) return { error: 'Dit potje heeft geen klok.' };
    if (!potje.spelers.includes(mij)) return { error: 'Je speelt niet mee in dit potje.' };
    const afwezig = potje.spelers[potje.beurt];
    if (afwezig === mij) return { error: 'Jij bent aan zet.' };
    if (!verlopen(potje)) return { error: 'De klok loopt nog.' };
    return { afwezig };
  }

  /* Een toernooiwedstrijd wacht niet op een knop: daar houdt een hele ronde
     stil terwijl iemand niet komt opdagen, en de uitslag hangt aan een afspraak
     die bij het aanmaken van het toernooi is gemaakt. Dit is de enige plek waar
     de klok uit zichzelf iets beeindigt, en de opruiming roept hem aan. */
  const verlooptVanzelf = (potje) => !!(potje && potje.toernooi && verlopen(potje));

  return { TEMPO, TEMPI, tempoFout, zetKlok, verlopen, klokStand, vervalMs, magToewijzen, verlooptVanzelf,
    _VERLATEN_BODEM: VERLATEN_BODEM, _GEMISTE_BEURTEN: GEMISTE_BEURTEN };
};

module.exports.TEMPO = TEMPO;
module.exports.TEMPI = TEMPI;
