/* Kern-module "spellen": verslavende potjes op de vriendenlaag, voor alle
   leden (RTF en RTG spelen tegen elkaar, op codenaam).

   Drie bordspellen en een scorebord:
   - Mens erger je niet: 2, 3 of 4 spelers vrij-voor-allen, of 2-tegen-2 in
     teams. Server-authoritatief: de server dobbelt, bewaakt de regels
     (6 = eruit en nog een keer, slaan = terug naar start, exact thuisbrengen)
     en wijst de winnaar aan.
   - Schaken: volledige zetvalidatie (rokade, en passant, promotie naar dame,
     schaak, mat en pat) op de server.
   - Woordduel (wordfeud-achtig): 15x15 met premievelden, de Nederlandse
     letterzak, kruiswoord-scoring en de 40-puntenbonus. Zonder woordenboek:
     het eer-systeem, zoals thuis aan tafel.
   - Dammen: 10x10 internationaal, slaan verplicht, meerslag met hetzelfde
     stuk, een dam vliegt over de diagonaal.
   - Rummi (rummikub-achtig): 106 stenen, eerste uitleg van 30 punten,
     daarna vrij herschikken; de server keurt de hele tafel bij elke beurt.
   - Magnaat (monopoly-achtig): 2 t/m 6 spelers, 40 velden in de RTG-wereld,
     kopen, huur, bouwen, kanskaarten en de gevangenis; wie overblijft wint.
   - Partyspellen: 30 Seconden (2 tegen 2, eer-systeem), Doen of Waarheid
     (2 t/m 6) en Proost (2 t/m 6, alleen 18+ met paspoort-geboortedatum).
   - Arcade (Sneek, Tetris, Sudoku): ieder speelt zelf; de beste scores
     vormen een ranglijst onder vrienden.

   Een potje start met uitgenodigde vrienden (die accepteren zelf), op
   codenaam (maakt geen vriendschap) of via de random wachtrij per spel en
   groepsgrootte. Beurten gaan via polling plus een SSE-duwtje. */
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen, anthropic }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  function S() {
    if (!db.data.spellen) db.data.spellen = { potjes: {}, wachtrij: {} };
    return db.data.spellen;
  }
  /* Een tabel per spel is de enige bron: naam, spelersaantal en welke app het
     potje START (meespelen op uitnodiging kan altijd over en weer). 'min'
     dwingt af dat 30 Seconden echt met vier begint; 'volwassen' is de
     18+-poort van Proost (paspoort-geboortedatum; RTF-profielen hebben geen
     geverifieerde leeftijd en doen dus nooit mee). */
  const SPEL = {
    mejn:     { naam: 'Mens erger je niet', max: 4, wereld: 'rtf' },
    schaak:   { naam: 'Schaken',            max: 2, wereld: 'rtg' },
    woord:    { naam: 'Woordduel',          max: 2, wereld: 'rtg' },
    pesten:   { naam: 'Pesten',             max: 4, wereld: 'rtf' },
    dam:      { naam: 'Dammen',             max: 2, wereld: 'rtf' },
    rummi:    { naam: 'Rummi',              max: 4, wereld: 'rtf' },
    magnaat:  { naam: 'Magnaat',            max: 6, wereld: 'rtg', buitenBeurt: ['bouw', 'verkoop'] },
    seconden: { naam: '30 Seconden',        max: 4, min: 4, wereld: 'rtg' },
    waarheid: { naam: 'Doen of Waarheid',   max: 6, wereld: 'rtf' },
    proost:   { naam: 'Proost',             max: 6, wereld: 'rtg', volwassen: true }
  };
  const SOORTEN = Object.fromEntries(Object.entries(SPEL).map(([k, v]) => [k, v.naam]));
  const TEAMS = [0, 1, 0, 1, 0, 1]; // om en om twee teams, tot zes spelers
  function wereldFout(wereld, soort) {
    if (!SPEL[soort] || SPEL[soort].wereld === wereld || (wereld !== 'rtg' && wereld !== 'rtf')) return null;
    return wereld === 'rtg' ? 'Dit spel vind je in de RTFoundation-app.' : 'Dit spel vind je in de RTG-leden-app.';
  }
  // de 18+-poort, op ELK toetredingsmoment (starten, uitnodigen, accepteren)
  function leeftijdFout(soort, handle) {
    if (SPEL[soort] && SPEL[soort].volwassen && !volwassen(handle))
      return 'Proost is 18+. Dit spel kan alleen met leden met een geverifieerde volwassen leeftijd.';
    return null;
  }
  const nudge = (naar, potje) => { try { sseToCustomer(naar, 'social', { kind: 'spel', potje: potje.id, soort: potje.soort }); } catch (e) {} };
  // eerlijk schudden (Fisher-Yates op crypto), gedeeld door alle kaart- en letterzakken
  function schud(arr) {
    for (let i = arr.length - 1; i > 0; i--) { const j = crypto.randomInt(0, i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  // beurt doorschuiven met de klok mee (of tegen, met stap -1); spel-neutraal
  function beurtDoor(potje, stap) {
    const n = potje.spelers.length;
    potje.beurt = ((potje.beurt + (stap || 1)) % n + n) % n;
  }

  /* ---------- opschonen: klare potjes na een dag weg, wachtenden na een uur.
     Hooguit een keer per minuut: de scan over alle potjes hoort niet in het
     hete pad van elke lobby-poll. ---------- */
  let opgeschoondOm = 0;
  function opschonen() {
    const t = Date.now();
    if (t - opgeschoondOm < 60000) return;
    opgeschoondOm = t;
    const s = S();
    for (const [id, p] of Object.entries(s.potjes)) {
      const leeftijd = t - new Date(p.at).getTime();
      if ((p.status === 'klaar' && leeftijd > 86400000) || (p.status === 'wacht' && leeftijd > 6 * 3600000)) delete s.potjes[id];
    }
  }

  /* ================= Mens erger je niet =================
     Ring van 40 velden; speler p start op veld p*10. Een pion: -1 = in het
     starthok, 0..39 = op de ring (absoluut), 100+i = eigen thuisrij. */

  /* ---------- de spelmotoren: elk spel een eigen module ----------
     De gedeelde context geeft ze save/crypto/schud/beurtDoor/codenaamVan; de
     dispatch-tabellen (INITS/ZETTEN/VIEWS) hieronder blijven ongewijzigd. */
  const spelCtx = { save, crypto, schud, beurtDoor, codenaamVan, nudge };
  const { mejnInit, mejnZet, mejnZetten, mejnGooi } = require('./spellen/mejn')(spelCtx);
  const { schaakInit, schaakZet } = require('./spellen/schaak')(spelCtx);
  const { woordInit, woordZet, W_PREMIE } = require('./spellen/woord')(spelCtx);
  const { pestenInit, pestenZet } = require('./spellen/pesten')(spelCtx);
  const { damInit, damZet, damZetten } = require('./spellen/dam')(spelCtx);
  const { rummiInit, rummiZet, rummiSet } = require('./spellen/rummi')(spelCtx);
  const { magnaatInit, magnaatZet, M_VELDEN } = require('./spellen/magnaat')(spelCtx);
  const { secondenInit, secondenZet } = require('./spellen/seconden')(spelCtx);
  const { waarheidInit, waarheidZet } = require('./spellen/waarheid')(spelCtx);
  const { proostInit, proostZet } = require('./spellen/proost')(spelCtx);


  /* De lobby- en partijlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen,
    mejnInit, mejnZet, mejnZetten, mejnGooi, schaakInit, schaakZet, woordInit, woordZet, W_PREMIE,
    pestenInit, pestenZet, damInit, damZet, damZetten, rummiInit, rummiZet, rummiSet,
    magnaatInit, magnaatZet, M_VELDEN, secondenInit, secondenZet, waarheidInit, waarheidZet, proostInit, proostZet };
  const { spelStart, spelGrootte, spelNieuw, spelAntwoord, spelRandom, mijnSpellen } = require('./spellen/lobby')(ctx);
  const { spelStaat, spelZet, spelOpgeven } = require('./spellen/partij')(ctx);
  // Rahul als spelmaatje: in elk potje op te roepen voor hints, regels of een peptalk
  const { spelRahul } = require('./spellen/rahul')(Object.assign({ anthropic }, ctx));

  /* ================= arcade (Sneek en Tetris): ranglijsten onder vrienden ================= */
  const ARCADE = ['sneek', 'tetris', 'sudoku'];
  function A(spel) {
    const s = S();
    if (!s.arcade) {
      s.arcade = { sneek: s.sneek || {}, tetris: {} }; // neemt oude sneek-scores mee
      delete s.sneek; // een bron: anders lopen de oude en nieuwe sleutel uiteen
    }
    if (!s.arcade[spel]) s.arcade[spel] = {};
    return s.arcade[spel];
  }
  function arcadeScore(mij, spel, punten) {
    if (!ARCADE.includes(spel)) return { status: 400, error: 'Onbekend arcadespel.' };
    const n = Math.max(0, Math.min(999999, Math.floor(Number(punten) || 0)));
    const s = A(spel);
    if (!s[mij] || n > s[mij].punten) { s[mij] = { punten: n, at: nu() }; save(); }
    return { status: 200, ok: true, beste: s[mij].punten };
  }
  function arcadeBord(mij, spel, vrienden) {
    if (!ARCADE.includes(spel)) return { status: 400, error: 'Onbekend arcadespel.' };
    const s = A(spel);
    const rij = [mij, ...vrienden].filter(h => s[h]).map(h => ({ codenaam: codenaamVan(h), ik: h === mij, punten: s[h].punten }));
    return { bord: rij.sort((a, b) => b.punten - a.punten).slice(0, 20) };
  }
  const sneekScore = (mij, punten) => arcadeScore(mij, 'sneek', punten);
  const sneekBord = (mij, vrienden) => arcadeBord(mij, 'sneek', vrienden);

  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelRahul, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet, W_PREMIE } };
};
