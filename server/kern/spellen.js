/* Kern-module "spellen": potjes op de vriendenlaag, voor alle leden (RTF
   en RTG spelen tegen elkaar, op codenaam). Elk spel is server-
   authoritatief en leeft in een eigen deelmodule onder ./spellen/:
   bordspellen (mens erger je niet, schaken, dammen, Rummi, Magnaat),
   Woordduel (eer-systeem, zonder woordenboek), partyspellen (30 Seconden,
   Doen of Waarheid, Proost 18+ op paspoort-geboortedatum), de RTF-duels
   van De Arena en De Societeit (flits, reactie, quiz, schat: dezelfde
   opgaven voor iedereen, zetten buiten de beurt) en de arcade met een
   ranglijst onder vrienden (Sneek, Tetris, Sudoku).

   Een potje start met uitgenodigde vrienden (die accepteren zelf), op
   codenaam (maakt geen vriendschap), via het door de server bevestigde
   klasgenoten-pad, of via de random wachtrij per spel en groepsgrootte.
   Beurten gaan via polling plus een SSE-duwtje. */
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen, anthropic }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  function S() {
    if (!db.data.spellen) db.data.spellen = { potjes: {}, wachtrij: {} };
    return db.data.spellen;
  }
  /* De spellen beschrijven zichzelf in een `spel`-descriptor in hun eigen
     module onder ./spellen/; `spellen/register.js` bouwt daar SPEL, SOORTEN en
     de dispatch-tabellen uit. Wat zo'n descriptor allemaal kan zeggen (de
     18+-poort, het minimum, teams, taal) staat daar en met opzet niet ook hier.

     Het register draait verderop, zodra nudge/schud/beurtDoor bestaan die het
     aan de spellen doorgeeft. De functies hieronder lezen SPEL pas als er een
     verzoek binnenkomt, dus die volgorde klopt. */
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

  /* ---------- de spelmotoren: elk spel een eigen module ----------
     De gedeelde context geeft ze save/crypto/schud/beurtDoor/codenaamVan; het
     register haalt ze op en levert de dispatch-tabellen. Dit blok groeit niet
     meer mee met het aantal spellen -- dat was het hele punt. */
  const spelCtx = { save, crypto, schud, beurtDoor, codenaamVan, nudge };
  const { SPEL, SOORTEN, INITS, ZETTEN, VIEWS, STATISCH, ruw } = require('./spellen/register')(spelCtx);
  // klasgenoten: het uitnodigingspad voor beschermde tieners (De Arena)
  const { klasgenotenVan, spelKlasgenoten } = require('./spellen/klas')({ db, codenaamVan, isGeblokkeerd });

  /* De lobby- en partijlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen,
    INITS, ZETTEN, VIEWS, STATISCH, klasgenotenVan };
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

  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelRahul, spelKlasgenoten, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet: ruw.rummiSet, W_PREMIE: ruw.W_PREMIE, SPEL } };
};
