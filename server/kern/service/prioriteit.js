/* ============================================================================
   DE PRIORITEIT WORDT BEREKEND, NIET GEKOZEN.

   WAAROM. In elk supportsysteem waar de melder de prioriteit kiest, is de
   prioriteit binnen een half jaar betekenisloos: wie "URGENT!!!" typt komt
   bovenaan, en wie beleefd blijft wacht. Dan meet de wachtrij welbespraaktheid
   in plaats van ernst.

   DE OPBOUW STAAT ERBIJ, ALTIJD. Een cijfer zonder opbouw is een orakel --
   dezelfde regel die kern/command/risico.js al voert. Elke uitkomst van deze
   module draagt daarom de termen die eraan bijdroegen, in gewone taal, zodat
   een medewerker kan zien waarom SUP-x boven SUP-y staat en dat kan aanvechten.

   VIJF TERMEN, EN WAT ZE BETEKENEN:

     urgentie   hoe snel wordt dit erger als niemand kijkt?
     impact     hoeveel van iemands gebruik ligt hierdoor stil?
     omvang     hoeveel mensen of zaken raakt het?
     geld       staat er geld vast dat niet van ons is?
     kwetsbaar  is de melder in een positie waarin wachten schaadt?

   DE MENSELIJKE OVERSCHRIJVING BESTAAT, EN VRAAGT EEN REDEN. Een berekening
   die niet te overrulen is, wordt omzeild met verzonnen invoer; dat is erger,
   want dan liegt de invoer in plaats van dat het oordeel zichtbaar is. Wie
   overschrijft, komt met naam en reden in de tijdlijn te staan.

   WAT DEZE MODULE NIET DOET. Ze leest niets. Geen betalingen, geen accounts,
   geen incidenten. Ze rekent op de termen die haar worden aangereikt, zodat ze
   te toetsen is zonder wereld eromheen en zodat ze nooit stilletjes de reden
   wordt dat iemands gegevens worden geopend.
   ========================================================================== */
'use strict';

/* De ladder. `P0` is met opzet niet bereikbaar via de gewone termen: dat is
   een menselijk besluit, want "veiligheid of platformbrede geldintegriteit" is
   niets wat je uit een formulier afleidt. */
const LADDER = {
  P0: { naam: 'P0 · kritiek',   wat: 'Veiligheid, of de financiele integriteit van het platform.', alleenMens: true },
  P1: { naam: 'P1 · hoog',      wat: 'Veel gebruikers of zaken kunnen hun werk niet doen.' },
  P2: { naam: 'P2 · verhoogd',  wat: 'Een zaak of organisatie ligt stil, of er staat geld vast.' },
  P3: { naam: 'P3 · normaal',   wat: 'Een individueel probleem met gevolgen voor deze melder.' },
  P4: { naam: 'P4 · laag',      wat: 'Een vraag; er ligt niets stil.' }
};

/* De termen op een schaal van 0 tot 3. Meer treden suggereren een precisie die
   er niet is -- niemand kan het verschil tussen een 6 en een 7 uitleggen. */
const SCHAAL = { geen: 0, licht: 1, flink: 2, zwaar: 3 };
const trede = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.min(3, Math.round(v)));
  return Object.prototype.hasOwnProperty.call(SCHAAL, String(v || '')) ? SCHAAL[String(v)] : 0;
};

/* De termen wegen niet even zwaar, en dat is de hele inhoud van deze module.
   Omvang telt het zwaarst: twintig zaken die niet kunnen afrekenen is een ander
   probleem dan een lid dat zijn factuur zoekt, hoe vervelend dat laatste ook is. */
const WEGING = { omvang: 3, geld: 2, impact: 2, urgentie: 1, kwetsbaar: 2 };

const TAAL = {
  urgentie:  'dit wordt erger zolang niemand kijkt',
  impact:    'de melder kan hierdoor iets niet',
  omvang:    'dit raakt meer dan een melder',
  geld:      'er staat geld vast dat niet van RTG is',
  kwetsbaar: 'wachten schaadt deze melder meer dan gemiddeld'
};

/* De grenzen. Uitgeschreven als een tabel en niet als een reeks if-regels,
   zodat verschuiven een zichtbare wijziging is en geen bijwerking. */
const GRENZEN = [
  { vanaf: 14, prio: 'P1' },
  { vanaf: 9,  prio: 'P2' },
  { vanaf: 4,  prio: 'P3' }
];

/* Vertaalt de vijf termen naar een prioriteit MET opbouw.

   `termen` is een kaart van naam naar trede (getal 0-3 of een woord uit
   SCHAAL). Wat er niet in staat telt als 0 -- en dat is geen aanname over de
   werkelijkheid maar over wat er GEMETEN is: `waarover niets gezegd is` staat
   in de opbouw, zodat de lezer ziet dat er niet gekeken is in plaats van dat
   het er niet is. */
function bereken(termen) {
  const t = termen || {};
  const gewogen = [];
  let som = 0;
  const stil = [];
  for (const naam of Object.keys(WEGING)) {
    if (!Object.prototype.hasOwnProperty.call(t, naam)) { stil.push(naam); continue; }
    const w = trede(t[naam]);
    if (w === 0) continue;
    const punten = w * WEGING[naam];
    som += punten;
    gewogen.push({ term: naam, trede: w, punten, waarom: TAAL[naam] });
  }
  gewogen.sort((a, b) => b.punten - a.punten);
  const prio = (GRENZEN.find(g => som >= g.vanaf) || { prio: 'P4' }).prio;
  return {
    prioriteit: prio,
    naam: LADDER[prio].naam,
    punten: som,
    opbouw: gewogen,
    /* Niet weglaten. Een zaak die op P4 uitkomt omdat niemand de omvang heeft
       ingeschat, is iets anders dan een zaak die aantoonbaar klein is. */
    nietGewogen: stil,
    door: 'berekend'
  };
}

/* De overschrijving. Geeft dezelfde vorm terug, met de berekening ERNAAST in
   plaats van eroverheen: wie later wil weten of het oordeel van de mens
   afweek, moet dat kunnen zien zonder de invoer opnieuw door de formule te
   halen. */
function overschrijf(basis, { naar, door, reden } = {}) {
  const p = String(naar || '').toUpperCase();
  if (!LADDER[p]) return { status: 400, error: 'Kies een prioriteit: ' + Object.keys(LADDER).join(', ') + '.' };
  const r = String(reden || '').replace(/[^\p{L}\p{N}]/gu, '').length >= 10 ? String(reden).slice(0, 300) : null;
  if (!r) {
    return { status: 400, error: 'Noteer waarom deze zaak een andere prioriteit krijgt dan de berekening geeft. ' +
      'Zonder die reden is de berekening straks niet te verbeteren.' };
  }
  return {
    prioriteit: p, naam: LADDER[p].naam,
    punten: (basis && basis.punten) || 0,
    opbouw: (basis && basis.opbouw) || [],
    nietGewogen: (basis && basis.nietGewogen) || [],
    door: 'mens', wie: String(door || 'onbekend').slice(0, 60), reden: r,
    berekendWas: (basis && basis.prioriteit) || null
  };
}

module.exports = { LADDER, SCHAAL, WEGING, GRENZEN, bereken, overschrijf, trede };
