/* Spellen (deelmodule): DE KEURING VAN EEN DESCRIPTOR.

   Afgesplitst van ./register.js, en op de naad die er al lag: dat bestand doet
   TWEE dingen die niets met elkaar te maken hebben. Het scant een map en bouwt
   dispatch-tabellen (dat is boekhouding), en het beoordeelt of een `spel`-
   descriptor deugt (dat zijn de REGELS van het vocabulaire). Het tweede groeit
   mee met elk veld dat een spel over zichzelf kan zeggen -- `vormen`,
   `naspeelbaar` en het driedelige `zicht` kwamen er in een ronde bij -- en het
   eerste niet. Ze samen laten betekent dat de boekhouding meegroeit met iets
   waar hij niets van hoeft te weten.

   De aanleiding was banaal en daarom het vermelden waard: register.js ging
   door de 10 kB-grens die `scripts/keuring.js` bewaakt. Die grens is geen
   smaak maar een rem op precies dit -- een bestand dat twee onderwerpen draagt
   valt vanzelf op.

   ALLES HIER FAALT LUID EN MET DE BESTANDSNAAM ERIN. Een spel dat zijn
   descriptor verkeerd invult mag de server niet laten opstarten; stil
   overslaan zou het spel spoorloos uit de lobby laten verdwijnen, en dat is de
   klasse fout waar het register voor bestaat. De meldingen noemen daarom altijd
   het BESTAND en WAT er mis is -- "welke had ik ook alweer" is precies het
   zoeken dat hiermee vervalt. */
const { ZONDER_SPELER } = require('./zicht');

// wat een descriptor MOET hebben, per vorm
const VERPLICHT = {
  potje: ['sleutel', 'naam', 'max', 'wereld', 'init', 'zet', 'zicht'],
  arcade: ['sleutel', 'naam', 'werelden', 'maxPunten']
};

/* De oude vorm, en waarom hij LUID wordt geweigerd in plaats van stil vertaald.
   `view` + `kijken: true` betekende "de spelerweergave zonder speler is ook de
   kijkweergave", en dat klopte bij drie van de zestien spellen niet (zie de kop
   van ./zicht.js). Een automatische vertaling zou die drie fouten meenemen naar
   de nieuwe vorm en er de schijn van een besluit aan geven. Wie migreert hoort
   per spel de vraag te beantwoorden. */
const OUD = {
  view: 'heet nu `zicht.speler`',
  kijken: 'is vervangen door `zicht.kijker` (weglaten = niet te bekijken)'
};

// de speelvormen die een potje kan dragen; 'live' is de stille standaard
const VORMEN = ['live', 'async', 'party'];

const fout = (naam, tekst) => { throw new Error(`spellen/register: ${naam} ${tekst}`); };

/* Wat elke descriptor moet doorstaan, ongeacht zijn vorm. Geeft de vorm terug. */
function keurAlgemeen(naam, s) {
  const vorm = s.vorm || 'potje';
  if (!VERPLICHT[vorm]) fout(naam, `heeft vorm '${s.vorm}'; alleen 'potje' of 'arcade'.`);
  // de oude vorm eerst, want "mist zicht" is een verwarrende melding voor een
  // spel dat gewoon nog `view` heet
  for (const [oud, wat] of Object.entries(OUD))
    if (s[oud] !== undefined) fout(naam, `gebruikt nog \`${oud}\`; dat ${wat}. Zie spellen/zicht.js.`);
  const mist = VERPLICHT[vorm].filter(k => s[k] === undefined || s[k] === null);
  if (mist.length) fout(naam, `mist in \`spel\` (vorm ${vorm}): ${mist.join(', ')}.`);
  // de sleutel MOET de bestandsnaam zijn: anders lopen de map en de tabel
  // uiteen en zoek je een spel dat er wel is en toch niet start
  const verwacht = naam.replace(/\.js$/, '');
  if (s.sleutel !== verwacht) fout(naam, `noemt zich '${s.sleutel}'; verwacht '${verwacht}'.`);
  return vorm;
}

/* Een arcadespel: geen potje, geen beurten, wel een score. */
function keurArcade(naam, s) {
  if (!Array.isArray(s.werelden) || !s.werelden.length || s.werelden.some(w => w !== 'rtg' && w !== 'rtf'))
    fout(naam, `heeft werelden ${JSON.stringify(s.werelden)}; een niet-lege lijst met alleen 'rtg' en/of 'rtf'.`);
  if (!(s.maxPunten > 0)) fout(naam, `heeft maxPunten ${s.maxPunten}; moet boven nul liggen.`);
  const uit = { naam: s.naam, werelden: s.werelden.slice(), maxPunten: s.maxPunten };
  // serverScore: de score komt van de SERVER en niet uit de client; de algemene
  // arcade-ingang weigert hem dan, want er mag geen tweede pad zijn
  if (s.serverScore) uit.serverScore = true;
  return uit;
}

/* Een potje: de rij in SPEL zoals de rest van het platform hem leest. Alleen
   wat over TOEGANG en VORM gaat komt erin -- de functies zelf blijven in hun
   eigen tabellen. */
function keurPotje(naam, s) {
  if (s.wereld !== 'rtg' && s.wereld !== 'rtf') fout(naam, `heeft wereld '${s.wereld}'; alleen 'rtg' of 'rtf'.`);
  const uit = { naam: s.naam, max: s.max, wereld: s.wereld };
  if (s.min) uit.min = s.min;
  if (s.volwassen) uit.volwassen = true;
  if (s.buitenBeurt) uit.buitenBeurt = s.buitenBeurt;
  if (s.perTaal) uit.perTaal = true;

  /* NASPEELBAAR: kan een partij uit het bewaarde verloop worden herbouwd? Dat
     kan alleen als het begin elke keer hetzelfde is EN de opgeslagen zetten de
     rest volledig bepalen -- geen schudbeker in `init`, geen worp die buiten de
     zet valt. Standaard NIET, want raden zou een bord opleveren dat er nooit zo
     heeft gestaan, en dat ziet er precies zo echt uit. Zie ./naspelen.js. */
  if (s.naspeelbaar !== undefined) {
    if (typeof s.naspeelbaar !== 'boolean')
      fout(naam, `heeft naspeelbaar ${JSON.stringify(s.naspeelbaar)}; alleen true of false.`);
    if (s.naspeelbaar) uit.naspeelbaar = true;
  }

  /* VORMEN: welke speelvormen dit spel draagt. 'live' is de stille standaard en
     dus wat elk bestaand spel houdt; 'async' zegt dat een beurt uren of dagen
     mag duren (zie ./klok.js). Een spel dat niets zegt krijgt geen klok -- de
     veilige stand, want een reactieduel met 24 uur per beurt is geen spel meer. */
  if (s.vormen !== undefined) {
    if (!Array.isArray(s.vormen) || !s.vormen.length || s.vormen.some(v => !VORMEN.includes(v)))
      fout(naam, `heeft vormen ${JSON.stringify(s.vormen)}; een niet-lege lijst uit ${JSON.stringify(VORMEN)}.`);
    uit.vormen = s.vormen.slice();
  } else uit.vormen = ['live'];

  if (s.teams) {
    if (s.teams !== 'altijd' && s.teams !== 'keuze') fout(naam, `heeft teams '${s.teams}'; alleen 'altijd' of 'keuze'.`);
    uit.teams = s.teams;
  }
  return uit;
}

/* Het zicht: drie lagen, en alleen de eerste is verplicht. `kijker` mag de
   sentinel ZONDER_SPELER zijn ("mijn spelerweergave is zonder speler veilig");
   een string of een `true` mag niet, want dan is het weer een vlag in plaats
   van een verwijzing -- en die vlag was precies wat er misging. */
function keurZicht(naam, s) {
  const z = s.zicht;
  if (typeof z !== 'object' || typeof z.speler !== 'function')
    fout(naam, 'heeft geen `zicht.speler`; dat is de weergave voor een deelnemer.');
  if (z.kijker !== undefined && z.kijker !== ZONDER_SPELER && typeof z.kijker !== 'function')
    fout(naam, 'heeft een `zicht.kijker` die geen functie is en niet ZONDER_SPELER. ' +
      'Laat hem weg als dit spel niet bekeken mag worden.');
  if (z.publiek !== undefined && typeof z.publiek !== 'function')
    fout(naam, 'heeft een `zicht.publiek` die geen functie is. ' +
      'Laat hem weg als dit spel niet op een gedeeld scherm hoort.');
  return z;
}

module.exports = { keurAlgemeen, keurArcade, keurPotje, keurZicht, VERPLICHT, VORMEN, OUD };
