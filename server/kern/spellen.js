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
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen, anthropic, sseClients, lidBoardUit }) => {
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
  const { SPEL, SOORTEN, INITS, ZETTEN, VIEWS, STATISCH, ARCADE, ruw } = require('./spellen/register')(spelCtx);
  // klasgenoten: het uitnodigingspad voor beschermde tieners (De Arena)
  const { klasgenotenVan, spelKlasgenoten } = require('./spellen/klas')({ db, codenaamVan, isGeblokkeerd });
  /* ---------- onzichtbaar spelen: de eigen opt-out op aanwezigheid ----------
     De functie "spelen" uitzetten werkt ook, maar dat is grover: dan kun je
     helemaal niet meer spelen. Dit is de smalle knop -- je speelt gewoon, maar
     niemand ziet dat je er bent.

     Waarom hier en niet in de boardroom: klasgenoten zijn RTF-gezinsprofielen
     en die hebben geen boardroom. Een opt-out die alleen voor RTG-leden bestaat
     zou precies de groep overslaan waarvoor aanwezigheid het gevoeligst is.

     Onzichtbaar is EEN kant op: je bent niet te zien en je ziet anderen nog
     wel. Iemand blinderen omdat hij niet gezien wil worden is een ruil, en dat
     is precies de druk die hier niet hoort. Wie wil zien moet niet hoeven
     betalen met zichtbaarheid. */
  function V() { const s = S(); if (!s.verborgen) s.verborgen = {}; return s.verborgen; }
  const isVerborgen = (key) => !!V()[key];
  const spelZichtbaar = (mij) => ({ status: 200, zichtbaar: !isVerborgen(mij) });
  function spelZichtbaarZet(mij, aan) {
    const v = V();
    // alleen "uit" bewaren we; zichtbaar is de standaard en laat geen spoor na
    if (aan === false) v[mij] = true; else delete v[mij];
    save();
    return { status: 200, ok: true, zichtbaar: !v[mij] };
  }

  /* Wie van je vrienden er nu is. Leest de levende lijst van open
     live-verbindingen en bewaart zelf niets; zie spellen/presence.js voor de
     regels die dat begrenzen. Een toets of een stand zonder SSE-laag krijgt
     een lege lijst in plaats van een uitzondering. */
  const { spelOnline } = require('./spellen/presence')({
    sseClients: sseClients || [], isGeblokkeerd, codenaamVan, isVerborgen,
    lidBoardUit: lidBoardUit || (() => false)
  });

  /* DE PROGRESSIEGRENS. Alles wat een prestatie BUITEN het potje bewaart --
     highscores, ranglijsten, later niveaus, prestaties en toernooien -- bestaat
     alleen voor geverifieerd volwassen leden. Dat is dezelfde poort als die van
     Proost: `volwassen()` betekent "RTG heeft de paspoort-geboortedatum
     gecontroleerd EN die is 18+", dus een lid zonder gecontroleerd paspoort
     valt er ook buiten tot dat gedaan is.

     Waarom die grens er is: `CLAUDE.md` verbiedt verslavende
     engagement-patronen, De Arena belooft tieners met zoveel woorden "alles
     telt alleen binnen het potje; er bestaat geen ranglijst", en de School-lat
     zegt "leren is geen wedstrijd". Een scorebord onder vrienden in dezelfde
     RTF-app sprak dat tegen. Onder de grens blijft elk spel gewoon volledig
     speelbaar -- er wordt alleen niets van bewaard.

     Deze functie is met opzet de ENIGE plek waar die grens staat: komt er een
     tweede progressievorm bij (prestaties, toernooien, niveaus), dan hangt die
     hier aan en niet aan een eigen kopie van de regel. */
  const progressieMag = (handle) => volwassen(handle);
  const GEEN_PROGRESSIE = 'Scores en ranglijsten bestaan alleen voor leden met een geverifieerde volwassen leeftijd. Het spel zelf speel je gewoon.';

  /* Uitslagen die een potje overleven: de bron onder winrate, niveaus en
     toernooien. Deelnemers buiten de progressiegrens staan er zonder codenaam
     in; speelde niemand binnen de grens mee, dan wordt er niets bewaard. Zie
     spellen/uitslagen.js. */
  const { noteerUitslag, spelUitslagen, spelStand } = require('./spellen/uitslagen')({
    db, save, codenaamVan, nu, progressieMag
  });

  /* De lobby- en partijlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen,
    INITS, ZETTEN, VIEWS, STATISCH, klasgenotenVan, noteerUitslag };
  const { spelStart, spelGrootte, spelNieuw, spelAntwoord, spelRandom, mijnSpellen } = require('./spellen/lobby')(ctx);
  const { spelStaat, spelZet, spelOpgeven } = require('./spellen/partij')(ctx);
  // Rahul als spelmaatje: in elk potje op te roepen voor hints, regels of een peptalk
  const { spelRahul } = require('./spellen/rahul')(Object.assign({ anthropic }, ctx));

  /* ================= arcade: ranglijsten onder vrienden =================
     Welke arcadespellen er zijn staat niet hier maar in het register: elk
     heeft een eigen module met een `vorm: 'arcade'`-descriptor. Deze laag
     kent dus geen spelnamen, alleen de vorm. */

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
    if (!ARCADE[spel]) return { status: 400, error: 'Onbekend arcadespel.' };
    /* Geen 403: je mag dit spel WEL spelen, er wordt alleen niets bewaard. Een
       fout aan het eind van een potje zou zeggen dat je iets niet mocht, en dat
       is niet waar. `bewaard: false` zegt precies wat er gebeurt, zodat de
       client zijn scorebord kan verbergen in plaats van een leeg bord te tonen. */
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

  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelRahul, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet: ruw.rummiSet, W_PREMIE: ruw.W_PREMIE, SPEL, ARCADE } };
};
