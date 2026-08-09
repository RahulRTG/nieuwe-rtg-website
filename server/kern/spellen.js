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
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen, anthropic, sseClients, lidBoardUit, comm }) => {
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

  /* ---------- wat er weggaat: vanzelf, en op verzoek ----------
     Het opruimen van oude potjes en het uitwissen van een vertrokken lid staan
     in spellen/opruimen.js; hier hangt alleen de bedrading.

     De HAKEN zijn er omdat de volgorde niet anders kan: `opschonen` gaat als
     eerste de lobby in (die draait hem bij elke poll), maar de takken die
     opgeruimd moeten worden -- toernooien, replays, teams, de arcade -- bestaan
     pas verderop. Ze schuiven daarom aan zodra ze er zijn. Dat is dezelfde
     late binding als bij `comm` hierboven, en hij is veilig omdat er niets van
     dit alles tijdens het OPBOUWEN wordt aangeroepen: pas als er een verzoek
     binnenkomt. */
  const opruimHaken = { deel: [], sudoku: null };
  const { opschonen, spelVergeet } = require('./spellen/opruimen')({
    S, save, codenaamVan,
    noteerUitslag: (p) => noteerUitslag(p),
    deelVergeet: opruimHaken.deel,
    sudokuOpschonen: (t) => { if (opruimHaken.sudoku) opruimHaken.sudoku(t); }
  });

  /* ---------- de spelmotoren: elk spel een eigen module ----------
     De gedeelde context geeft ze save/crypto/schud/beurtDoor/codenaamVan; het
     register haalt ze op en levert de dispatch-tabellen. Dit blok groeit niet
     meer mee met het aantal spellen -- dat was het hele punt. */
  const spelCtx = { save, crypto, schud, beurtDoor, codenaamVan, nudge };
  const { SPEL, SOORTEN, INITS, ZETTEN, VIEWS, STATISCH, ARCADE, ruw } = require('./spellen/register')(spelCtx);
  // klasgenoten: het uitnodigingspad voor beschermde tieners (De Arena)
  const { klasgenotenVan, spelKlasgenoten } = require('./spellen/klas')({ db, codenaamVan, isGeblokkeerd });
  /* Wie van je vrienden er nu is. Leest de levende lijst van open
     live-verbindingen en bewaart zelf niets; zie spellen/presence.js voor de
     regels die dat begrenzen. Een toets of een stand zonder SSE-laag krijgt
     een lege lijst in plaats van een uitzondering. */
  const { spelOnline, spelZichtbaar, spelZichtbaarZet } = require('./spellen/presence')({
    S, save, sseClients: sseClients || [], isGeblokkeerd, codenaamVan,
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
  /* Telemetrie: geaggregeerd, zonder personen. Hangt aan `noteerUitslag` en
     niet aan de twee einden van een potje -- een plek, en meteen dezelfde
     idempotentie. Zie spellen/telling.js voor waarom dit NAAST de uitslagen
     staat en er niet uit wordt afgeleid. */
  const { telPotje, spelTelemetrie } = require('./spellen/telling')({ db, save, nu, SOORTEN });

  const { noteerUitslag, spelUitslagen, spelStand } = require('./spellen/uitslagen')({
    db, save, codenaamVan, nu, progressieMag, telPotje
  });


  /* Prestaties, ook afgeleid uit de uitslagen: alleen wat behaald is, geen
     voortgang naar wat je "nog moet", en geen reeksen. Zie de kop van
     spellen/prestaties.js voor waarom dat drie bewuste keuzes zijn. */
  const { spelPrestaties } = require('./spellen/prestaties')({
    spelStand, naamVanSpel: (soort) => SOORTEN[soort] || null
  });

  /* Het verloop van een partij, voor de replay. Aparte tak en aparte termijn:
     een uitslag zegt WIE won en gaat een jaar mee, een verloop zegt HOE en is
     na een maand geen geheugen meer. Zie spellen/zetten.js. */
  const { noteerZet, spelReplay, zettenVergeet } = require('./spellen/zetten')({ db, save, nu, codenaamVan });
  opruimHaken.deel.push(zettenVergeet);

  /* De lobby- en partijlaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const ctx = { db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen,
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen,
    INITS, ZETTEN, VIEWS, STATISCH, klasgenotenVan, noteerUitslag, noteerZet };
  const { spelStart, spelGrootte, potjeDirect, spelNieuw, spelAntwoord, spelRandom, mijnSpellen } = require('./spellen/lobby')(ctx);
  /* Toernooien: een knockout waarvan elke wedstrijd een GEWOON potje is. Staat
     bewust NIET achter de progressiegrens -- een toernooi is een begrensd
     evenement en geen blijvende stand; zie de kop van spellen/toernooi.js. */
  const { toernooiNieuw, toernooiAntwoord, toernooiPotjeKlaar, mijnToernooien, toernooiStaat, toernooiVergeet } =
    require('./spellen/toernooi')({ db, save, rid, nu, codenaamVan, isGeblokkeerd, SPEL, SOORTEN, schud,
      potjeDirect, leeftijdFout, nudge });
  opruimHaken.deel.push(toernooiVergeet);
  ctx.toernooiPotjeKlaar = toernooiPotjeKlaar;
  ctx.toernooiHeeftSpeler = (id, key) => { const b = toernooiStaat(key, id); return !!(b && b.toernooi && b.toernooi.ikDoeMee); };
  const { spelStaat, spelZet, spelOpgeven, spelKijk } = require('./spellen/partij')(ctx);
  // Rahul als spelmaatje: in elk potje op te roepen voor hints, regels of een peptalk
  const { spelRahul } = require('./spellen/rahul')(Object.assign({ anthropic }, ctx));

  /* Praten in het potje. Geen eigen berichtenvoorraad: dit gaat de
     communicatiekern in als een gesprek van soort 'group', met alles wat daar
     al aan hangt (bewaartermijn, wisrecht, leesstand, sein). `comm` komt als
     FUNCTIE binnen omdat de spellen in laag 1 worden opgebouwd en die kern pas
     in laag 4 -- op het moment van aanroepen bestaat hij wel. Zonder comm (een
     toets die alleen potjes speelt) blijft praten gewoon dicht. */
  /* Teams: een vaste club om mee te spelen. Iedereen mag er een maken; wat dat
     begrensd houdt staat in spellen/teams.js (niet openbaar, uitnodigen alleen
     binnen je eigen kring, en pas lid als je ja zegt). Bewust ZONDER ranglijst
     -- een teamstand zou onder de progressiegrens vallen en dan staat de helft
     van een schoolteam er niet op. */
  const { teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, teamVergeet } =
    require('./spellen/teams')({ db, save, rid, nu, codenaamVan, isGeblokkeerd, zijnVrienden,
      klasgenotenVan, schoon: require('./util').schoon, sociaalRate });
  opruimHaken.deel.push(teamVergeet);

  const { spelPraat, spelPraatStuur } = require('./spellen/praat')(Object.assign({
    comm: () => (typeof comm === 'function' ? comm() : comm) || null
  }, ctx));

  /* De arcade: spelen zonder tegenstander, waar alleen een getal van overblijft.
     Inclusief Sudoku, het enige arcadespel waarvan de SERVER de score rekent.
     Zie spellen/arcade.js voor waarom die twee soorten score niet naast elkaar
     mogen bestaan zonder dat de ene de andere dichtzet. */
  const { arcadeScore, arcadeBord, sneekScore, sneekBord, sudokuNieuw, sudokuKlaar, arcadeVergeet, sudokuOpschonen } =
    require('./spellen/arcade')({ S, save, nu, codenaamVan, ARCADE, ruw, progressieMag, GEEN_PROGRESSIE });
  opruimHaken.deel.push(arcadeVergeet);
  opruimHaken.sudoku = sudokuOpschonen;


  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelKijk, spelReplay, spelRahul, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, spelPrestaties, spelPraat, spelPraatStuur, spelTelemetrie, teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, sudokuNieuw, sudokuKlaar, spelVergeet, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet: ruw.rummiSet, W_PREMIE: ruw.W_PREMIE, SPEL, ARCADE } };
};
