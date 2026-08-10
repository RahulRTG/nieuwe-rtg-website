/* Kern-module "spellen": DE BEDRADING van het spelplatform.

   Dit bestand hangt de deellagen aan elkaar en bevat verder niets: elk spel
   beschrijft zichzelf in ./spellen/ en het register bouwt daar de tabellen uit;
   de lobby, de partij, de uitslagen, de stand, de prestaties, de toernooien,
   het meekijken, de replays, het praten, de teams, de telling, de arcade en het
   opruimen hebben elk hun eigen bestand met hun eigen kop.

   Wat hier WEL staat is de volgorde, en die is de inhoud: een laag die een
   andere leest moet erna komen. Waar dat niet kan, staat er een late binding
   met de reden erbij (`comm`, de opruimhaken, `SPEL` in gedeeld.js).

   Een potje start met uitgenodigde vrienden (die accepteren zelf), op codenaam
   (maakt geen vriendschap), via het door de server bevestigde klasgenoten-pad,
   of via de random wachtrij per spel en groepsgrootte. Beurten gaan via polling
   plus een SSE-duwtje. */
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen, anthropic, sseClients, lidBoardUit, comm }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
  function S() {
    if (!db.data.spellen) db.data.spellen = { potjes: {}, wachtrij: {} };
    return db.data.spellen;
  }
  /* Wat een descriptor kan zeggen staat in spellen/register.js en met opzet
     niet ook hier. Het register draait verderop, zodra de gedeelde spelregels
     bestaan die het aan de spellen doorgeeft. */
  const TEAMS = [0, 1, 0, 1, 0, 1]; // om en om twee teams, tot zes spelers
  /* De vijf dingen die elk spel van het platform krijgt -- twee poorten, de
     schudbeker, de beurtvolgorde en het duwtje naar de andere kant -- staan in
     spellen/gedeeld.js. Ze lezen de descriptor en kennen geen spelnaam.

     Ze hangen HIER en niet lager: het register en de lobby krijgen ze mee, en
     `SPEL` bestaat pas na het register. Dat is dezelfde late binding als
     hieronder: de functies worden pas bij een verzoek aangeroepen. */
  const { wereldFout, leeftijdFout, nudge, schud, beurtDoor } =
    require('./spellen/gedeeld')({ crypto, sseToCustomer, volwassen, get SPEL() { return SPEL; } });

  /* DE KLOK: hoe lang een beurt mag duren, en wat er gebeurt als hij verloopt.
     Staat hier hoog omdat de opruiming er meteen op leunt (een Long Play-partij
     is pas verlaten na tien gemiste beurten, niet na een vaste maand), en hij
     leest `SPEL` net als gedeeld.js met een late binding. */
  const klok = require('./spellen/klok')({ get SPEL() { return SPEL; } });

  /* Wat er weggaat, vanzelf en op verzoek: spellen/opruimen.js. De HAKEN zijn
     er omdat de volgorde niet anders kan -- `opschonen` gaat als eerste de
     lobby in, terwijl de takken die opgeruimd moeten worden pas verderop
     bestaan. Ze schuiven aan zodra ze er zijn; veilig, want er wordt tijdens
     het opbouwen niets van dit alles aangeroepen. */
  const opruimHaken = { deel: [], sudoku: null, opgeven: null };
  const { opschonen, spelVergeet } = require('./spellen/opruimen')({
    S, save, codenaamVan,
    noteerUitslag: (p) => noteerUitslag(p),
    deelVergeet: opruimHaken.deel,
    sudokuOpschonen: (t) => { if (opruimHaken.sudoku) opruimHaken.sudoku(t); },
    vervalMs: (p) => klok.vervalMs(p),
    /* De enige plek waar een klok uit zichzelf een partij beeindigt: een
       toernooiwedstrijd. Geeft terug of er iets gebeurd is, zodat de opruiming
       weet dat ze dit potje verder met rust moet laten. Late binding, want
       `spelOpgeven` bestaat pas na de partijlaag. */
    geefOp: (p) => {
      if (!klok.verlooptVanzelf(p) || !opruimHaken.opgeven) return false;
      opruimHaken.opgeven(p.spelers[p.beurt], p.id);
      return true;
    }
  });

  /* ---------- de spelmotoren: elk spel een eigen module ----------
     De gedeelde context geeft ze save/crypto/schud/beurtDoor/codenaamVan; het
     register haalt ze op en levert de dispatch-tabellen. Dit blok groeit niet
     meer mee met het aantal spellen -- dat was het hele punt. */
  const spelCtx = { save, crypto, schud, beurtDoor, codenaamVan, nudge };
  const { SPEL, SOORTEN, INITS, ZETTEN, ZICHT, STATISCH, ARCADE, ruw } = require('./spellen/register')(spelCtx);
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

  /* DE PROGRESSIEGRENS staat in spellen/grens.js: de enige regel waar deze hele
     laag aan hangt, en daarom een eigen bestand met een eigen naam. */
  const { progressieMag, GEEN_PROGRESSIE } = require('./spellen/grens')({ volwassen });

  /* HET BELEID: alle toetredingsvragen op een plek, in volgorde. Neemt geen
     enkele regel over -- hij roept gedeeld.js, grens.js en zicht.js aan. Staat
     hier omdat alles wat hij aanroept nu bestaat; de lobby en de partij kennen
     hem via `ctx` en nieuwe ingangen (chat, projectie, Game Night) horen hem te
     gebruiken in plaats van de losse poorten opnieuw te bevragen. */
  const beleid = require('./spellen/beleid')({
    wereldFout, leeftijdFout, progressieMag, GEEN_PROGRESSIE, ZICHT,
    get SPEL() { return SPEL; }
  });

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
    rid, nu, S, SPEL, SOORTEN, TEAMS, wereldFout, leeftijdFout, nudge, schud, beurtDoor, opschonen, klok, beleid,
    INITS, ZETTEN, ZICHT, STATISCH, klasgenotenVan, noteerUitslag, noteerZet };
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
  const { spelStaat, spelZet, spelOpgeven, spelKijk, spelToewijzen } = require('./spellen/partij')(ctx);
  // de opruiming kan nu een verlopen toernooiwedstrijd afmaken (zie hierboven)
  opruimHaken.opgeven = spelOpgeven;
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


  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelStaat, spelZet, spelOpgeven, spelToewijzen, spelKijk, spelReplay, spelRahul, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, spelPrestaties, spelPraat, spelPraatStuur, spelTelemetrie, teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, sudokuNieuw, sudokuKlaar, spelVergeet, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet: ruw.rummiSet, W_PREMIE: ruw.W_PREMIE, SPEL, ARCADE } };
};
