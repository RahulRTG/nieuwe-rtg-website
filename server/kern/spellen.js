/* Kern "spellen": DE BEDRADING van het spelplatform.

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
module.exports = ({ db, save, crypto, zijnVrienden, codenaamVan, sseToCustomer, isGeblokkeerd, socialZoek, sociaalRate, volwassen, anthropic, magnaatLeren, sseClients, lidBoardUit, comm }) => {
  const fs = require('fs'), zlib = require('zlib'), path = require('path');
  const { S } = require('./spellen/opslag')({ db });
  const rid = (n) => crypto.randomBytes(n).toString('hex');
  const nu = () => new Date().toISOString();
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

  /* DE KLOK (spellen/klok.js). Staat hier hoog omdat de opruiming er meteen op
     leunt, en leest `SPEL` met dezelfde late binding als gedeeld.js. */
  const klok = require('./spellen/klok')({ get SPEL() { return SPEL; } });

  /* Wat er weggaat, vanzelf en op verzoek: spellen/opruimen.js. De HAKEN zijn
     er omdat de volgorde niet anders kan -- `opschonen` gaat als eerste de
     lobby in, terwijl de takken die opgeruimd moeten worden pas verderop
     bestaan. Ze schuiven aan zodra ze er zijn; veilig, want er wordt tijdens
     het opbouwen niets van dit alles aangeroepen. */
  const opruimHaken = { deel: [], tijd: [], opgeven: null };
  const { opschonen, spelVergeet } = require('./spellen/opruimen')({
    S, save, codenaamVan,
    noteerUitslag: (p) => noteerUitslag(p),
    deelVergeet: opruimHaken.deel,
    tijdOpschonen: opruimHaken.tijd,
    vervalMs: (p) => klok.vervalMs(p),
    /* De enige plek waar een klok uit zichzelf een partij beeindigt: een
       toernooiwedstrijd. Late binding, want `spelOpgeven` komt pas later. */
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
  const spelCtx = { db, save, crypto, schud, beurtDoor, codenaamVan, nudge, magnaatLeren };
  const { SPEL, SOORTEN, INITS, ZETTEN, ZICHT, STATISCH, ARCADE, DAG, VARIANT, ruw } = require('./spellen/register')(spelCtx);
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

  /* HET BELEID (spellen/beleid.js): alle toetredingsvragen op een plek, in
     volgorde. Neemt geen regel over -- hij roept gedeeld.js, grens.js en
     zicht.js aan. Nieuwe ingangen horen hem te gebruiken. */
  const beleid = require('./spellen/beleid')({
    wereldFout, leeftijdFout, ZICHT,
    get SPEL() { return SPEL; }, get VARIANT() { return VARIANT; }
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
  const { spelStart, spelGrootte, potjeDirect, spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelVarianten } = require('./spellen/lobby')(ctx);
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
  /* ---------- alles wat RONDOM een potje hangt ----------
     Rahul (in het potje en na afloop), het terugkijken, het praten, de teams en
     de arcade. Ze worden allemaal gebouwd nadat de partijlaag bestaat en geen
     van hen wordt door die laag gelezen -- dat is de naad waarop ze samen in
     spellen/rondom.js staan. */
  const rondom = require('./spellen/rondom')({
    anthropic, spelReplay, SPEL, SOORTEN, ZICHT, crypto, db, save, rid, nu, S,
    codenaamVan, isGeblokkeerd, zijnVrienden, klasgenotenVan, sociaalRate,
    comm, ARCADE, DAG, ruw, progressieMag, GEEN_PROGRESSIE, opruimHaken, spelCtx: ctx
  });
  const { spelRahul, spelNabespreking, spelNaspelen, projectieOpen, projectieStand,
    projectieSluit, projectieSpellen, teamNieuw, teamNodig, teamAntwoord,
    teamVerlaat, mijnTeams, spelPraat, spelPraatStuur, arcadeScore, arcadeBord,
    sneekScore, sneekBord, sudokuNieuw, sudokuKlaar, dagStand, dagStart, dagKlaar } = rondom;


  return { spelNieuw, spelAntwoord, spelRandom, mijnSpellen, spelVarianten, spelStaat, spelZet, spelOpgeven, spelToewijzen, spelKijk, spelReplay, spelNaspelen, spelRahul, spelNabespreking, projectieOpen, projectieStand, projectieSluit, spelKlasgenoten, spelOnline, spelZichtbaar, spelZichtbaarZet, spelUitslagen, spelStand, spelPrestaties, spelPraat, spelPraatStuur, spelTelemetrie, teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, sudokuNieuw, sudokuKlaar, spelVergeet, toernooiNieuw, toernooiAntwoord, mijnToernooien, toernooiStaat, sneekScore, sneekBord, arcadeScore, arcadeBord, dagStand, dagStart, dagKlaar, SPEL_SOORTEN: SOORTEN,
    // alleen voor de drift-test: de client heeft een eigen kopie van deze
    // regels (directe feedback); de test houdt beide kopieën tegen elkaar
    _spelregels: { rummiSet: ruw.rummiSet, W_PREMIE: ruw.W_PREMIE, SPEL, ARCADE } };
};
