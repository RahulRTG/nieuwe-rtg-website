/* Spellen (deelmodule): de arcade -- spelen zonder tegenstander.

   Een potje heeft beurten, een tegenstander en een server die elke zet keurt.
   Een arcadespel heeft niets van dat alles: je speelt alleen, en het enige wat
   overblijft is een getal. Dat is een ander onderwerp dan de partijlaag, en het
   staat daarom apart.

   WELKE SPELLEN DAT ZIJN STAAT HIER NIET. Elk arcadespel heeft een eigen module
   met een `vorm: 'arcade'`-descriptor; het register bouwt daar de tabel uit. Deze
   laag kent dus geen spelnamen, alleen de vorm -- op de twee oude Sneek-aliassen
   na, en die noemen het spel omdat de ROUTE dat doet.

   TWEE SOORTEN SCORE, en het verschil is de hele reden dat `serverScore`
   bestaat:

   1. DE CLIENT REKENT (Sneek, Tetris). De regels draaien in de browser en er
      komt een getal binnen. De server kan daar niets van narekenen; de enige rem
      is de puntengrens uit de descriptor. Te dragen voor een vriendenbord, en
      niet meer zodra er een prijs aan hangt.
   2. DE SERVER REKENT (Sudoku). De server geeft de puzzel uit, houdt de
      oplossing voor zichzelf, klokt op zijn eigen klok en rekent de punten. Dan
      MOET de gewone ingang dicht: `arcadeScore` weigert een ingestuurd getal
      voor zo'n spel, want anders staat er gewoon een tweede deur naast.

   DE PROGRESSIEGRENS geldt hier net zo hard als overal: onder de grens speel je
   gewoon, er wordt alleen niets bewaard. Geen 403 -- een fout aan het eind van
   een potje zou zeggen dat je iets niet mocht, en dat is niet waar. */
module.exports = (ctx) => {
  const { S, save, nu, codenaamVan, ARCADE, ruw, progressieMag, GEEN_PROGRESSIE } = ctx;

  /* De borden. De oude losse `sneek`-tak verhuist bij de eerste aanraking naar
     `arcade.sneek`: een bron, anders lopen de oude en de nieuwe sleutel uiteen. */
  function A(spel) {
    const s = S();
    if (!s.arcade) {
      s.arcade = { sneek: s.sneek || {}, tetris: {} };
      delete s.sneek;
    }
    if (!s.arcade[spel]) s.arcade[spel] = {};
    return s.arcade[spel];
  }

  function arcadeScore(mij, spel, punten) {
    if (!ARCADE[spel]) return { status: 400, error: 'Onbekend arcadespel.' };
    /* Een spel waarvan de server de score berekent kent geen tweede pad. Zou
       deze ingang hem toch aannemen, dan was alle narekening voor niets: je
       stuurt gewoon een getal langs de motor heen. */
    if (ARCADE[spel].serverScore)
      return { status: 400, error: 'De score van dit spel wordt door de server bepaald.' };
    /* `bewaard: false` zegt precies wat er gebeurt, zodat de client zijn
       scorebord kan verbergen in plaats van een leeg bord te tonen. */
    if (!progressieMag(mij)) return { status: 200, ok: true, bewaard: false, ranglijst: false, reden: GEEN_PROGRESSIE };
    const n = Math.max(0, Math.min(ARCADE[spel].maxPunten, Math.floor(Number(punten) || 0)));
    const s = A(spel);
    if (!s[mij] || n > s[mij].punten) { s[mij] = { punten: n, at: nu() }; save(); }
    return { status: 200, ok: true, bewaard: true, ranglijst: true, beste: s[mij].punten };
  }

  function arcadeBord(mij, spel, vrienden) {
    if (!ARCADE[spel]) return { status: 400, error: 'Onbekend arcadespel.' };
    if (!progressieMag(mij)) return { bord: [], ranglijst: false, reden: GEEN_PROGRESSIE };
    const s = A(spel);
    const rij = [mij, ...vrienden].filter(h => s[h]).map(h => ({ codenaam: codenaamVan(h), ik: h === mij, punten: s[h].punten }));
    return { bord: rij.sort((a, b) => b.punten - a.punten).slice(0, 20), ranglijst: true };
  }

  /* De twee oude Sneek-routes (`/spel/sneek-score` en `/spel/sneek-bord`)
     bestonden voordat er een arcade was en staan nog in oudere clients. Ze
     noemen het spel bij naam omdat de ROUTE dat doet -- dat is een alias, geen
     tweede dispatch: er valt hier niets te vergeten als er een arcadespel
     bijkomt. */
  const sneekScore = (mij, punten) => arcadeScore(mij, 'sneek', punten);
  const sneekBord = (mij, vrienden) => arcadeBord(mij, 'sneek', vrienden);

  /* ---------- Sudoku: de server maakt de puzzel en rekent de score ----------
     De motor (puzzel maken, oplossing tellen, punten) staat bij het spel zelf
     in ./sudoku.js en komt via het register mee als `ruw`. Hier staat alleen
     wat de SERVER ermee doet: uitgeven, bewaren, narekenen. */
  function SU() { const s = S(); if (!s.sudoku) s.sudoku = {}; return s.sudoku; }

  function sudokuNieuw(mij, niveau) {
    const n = ruw.NIVEAUS[niveau] ? niveau : 'normaal';
    const { op, puzzel } = ruw.maakPuzzel(n);
    SU()[mij] = { op, puzzel, niveau: n, start: Date.now() };
    save();
    // alleen de PUZZEL gaat mee terug, nooit de oplossing
    return { status: 200, ok: true, niveau: n, puzzel };
  }

  function sudokuKlaar(mij, rooster) {
    const lopend = SU()[mij];
    if (!lopend) return { status: 409, error: 'Er loopt geen puzzel. Begin er een.' };
    if (!ruw.isRooster(rooster)) return { status: 400, error: 'Stuur een volledig rooster van 81 cijfers mee.' };
    /* Eerst de GEGEVEN cijfers, helemaal rond, en pas daarna vergelijken. Die
       volgorde is niet vrijblijvend: wie een gegeven cijfer wegveegt levert een
       ander rooster in dan de puzzel die hij kreeg, en dat is een andere fout
       dan "niet goed opgelost". Door elkaar heen lopend zou de eerste
       afwijkende cel bepalen welke van de twee je te horen krijgt. */
    for (let i = 0; i < 81; i++)
      if (lopend.puzzel[i] && rooster[i] !== lopend.puzzel[i])
        return { status: 400, error: 'De gegeven cijfers van de puzzel horen te blijven staan.' };
    /* Fout ingevuld is geen fout van de client: de puzzel blijft staan en de
       klok loopt door, dus je kunt gewoon verder puzzelen. */
    for (let i = 0; i < 81; i++)
      if (rooster[i] !== lopend.op[i]) return { status: 200, ok: true, goed: false };

    const seconden = Math.max(0, (Date.now() - lopend.start) / 1000);
    delete SU()[mij];
    const p = ruw.punten(lopend.niveau, seconden);
    save();
    /* Opgelost is opgelost, ook onder de progressiegrens: je hoort hoe snel je
       was. Wat er onder die grens NIET gebeurt is bewaren -- geen bord, geen
       record, precies zoals `arcadeScore` het voor Sneek en Tetris doet.
       Anders zou de server-berekening een tweede weg naar het scorebord zijn. */
    const uit = { status: 200, ok: true, goed: true, seconden: Math.round(seconden), punten: p };
    if (!progressieMag(mij)) return Object.assign(uit, { bewaard: false, ranglijst: false, reden: GEEN_PROGRESSIE });
    const bord = A('sudoku');
    if (!bord[mij] || p > bord[mij].punten) { bord[mij] = { punten: p, at: nu() }; save(); }
    return Object.assign(uit, { bewaard: true, ranglijst: true, beste: bord[mij].punten });
  }

  /* Een lid dat zich laat verwijderen, en de opruiming van puzzels die zijn
     blijven staan. Allebei horen ze bij deze tak en niet bij de opruimlaag: wie
     hier de vorm van de opslag kent, hoort hem ook op te ruimen. */
  function arcadeVergeet(key) {
    const s = S();
    for (const bord of Object.values(s.arcade || {})) delete bord[key];
    if (s.sudoku) delete s.sudoku[key];
  }
  function sudokuOpschonen(t) {
    const s = S();
    for (const [k, v] of Object.entries(s.sudoku || {}))
      if (t - (v.start || 0) > (ruw.OUD_MS || 6 * 3600000)) delete s.sudoku[k];
  }

  return { arcadeScore, arcadeBord, sneekScore, sneekBord, sudokuNieuw, sudokuKlaar, arcadeVergeet, sudokuOpschonen };
};
