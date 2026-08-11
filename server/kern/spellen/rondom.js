/* Spellen (deelmodule): DE BEDRADING RONDOM EEN POTJE.

   Afgesplitst van ../spellen.js, op de naad die daar al lag. Dat bestand is de
   bedrading en zegt over zichzelf: "hangt de deellagen aan elkaar en bevat
   verder niets; wat hier WEL staat is de volgorde". Die volgorde valt uiteen in
   twee helften, en dit is de tweede.

   De eerste helft is alles wat een POTJE nodig heeft om te bestaan: de gedeelde
   spelregels, de klok, het register, de lobby en de partij. Die moeten in een
   strikte volgorde, want ze lezen elkaar.

   Deze helft is alles wat om zo'n potje HEEN hangt en er pas na komt: Rahul (in
   het potje en na afloop), het terugkijken, het praten, de teams en de arcade.
   Ze delen een eigenschap die de eerste helft niet heeft -- ze worden allemaal
   gebouwd nadat `spelStaat`/`spelZet` bestaan, en geen van hen wordt door de
   partijlaag gelezen. Ze kunnen dus samen weg zonder dat de volgorde iets
   merkt, en dat is precies wat een naad is.

   De aanleiding was dat ../spellen.js door de 10 kB-grens ging die
   `scripts/keuring.js` bewaakt en die NORM.json als meter bijhoudt. Die grens
   is geen smaak maar een rem op een bestand dat twee onderwerpen gaat dragen.

   WAT HIER NIET GEBEURT: er wordt niets bedacht. Elke regel is een aanroep, en
   elke reden staat in de kop van de module die wordt aangeroepen. Staat hier
   ooit een spelregel, dan hoort die ergens anders. */
module.exports = (ctx) => {
  const { anthropic, spelReplay, SPEL, SOORTEN, db, save, rid, nu, S,
    codenaamVan, isGeblokkeerd, zijnVrienden, klasgenotenVan, sociaalRate,
    comm, ARCADE, ruw, progressieMag, GEEN_PROGRESSIE, opruimHaken, spelCtx } = ctx;

  // Rahul als spelmaatje: in elk potje op te roepen voor hints, regels of een
  // peptalk. Krijgt het bord NIET te zien; zie spellen/rahul.js.
  const { spelRahul, _KENNIS } = require('./rahul')(Object.assign({ anthropic }, spelCtx));

  /* Rahul als NABESPREKER, en dat is bewust een TWEEDE deur: die leest het hele
     verloop en weigert daarom een lopend potje. Zie spellen/nabespreking.js. */
  const { spelNabespreking } = require('./nabespreking')(
    Object.assign({ anthropic, spelReplay, _KENNIS }, spelCtx));

  /* Een partij zet voor zet terugkijken, met de motor die hem ook echt speelde
     -- de client krijgt geen tweede exemplaar van de schaakregels. Zie
     spellen/naspelen.js voor waarom daar een tweede, STIL register staat. */
  const { spelNaspelen } = require('./naspelen')({ SPEL, SOORTEN, spelReplay, codenaamVan });

  /* Teams: een vaste club om mee te spelen, bewust ZONDER ranglijst -- die zou
     onder de progressiegrens vallen en dan staat de helft van een schoolteam er
     niet op. Zie spellen/teams.js. */
  const { teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams, teamVergeet } =
    require('./teams')({ db, save, rid, nu, codenaamVan, isGeblokkeerd, zijnVrienden,
      klasgenotenVan, schoon: require('../util').schoon, sociaalRate });
  opruimHaken.deel.push(teamVergeet);

  /* Praten in het potje: geen zevende berichtenvoorraad maar een gewoon gesprek
     in kern/comm. `comm` komt als FUNCTIE binnen omdat de spellen in laag 1
     worden opgebouwd en die kern pas in laag 4. Zie spellen/praat.js. */
  const { spelPraat, spelPraatStuur } = require('./praat')(Object.assign({
    comm: () => (typeof comm === 'function' ? comm() : comm) || null
  }, spelCtx));

  /* De arcade: spelen zonder tegenstander, waar alleen een getal van overblijft.
     Zie spellen/arcade.js voor waarom de twee soorten score niet naast elkaar
     mogen bestaan zonder dat de ene de andere dichtzet. */
  const { arcadeScore, arcadeBord, sneekScore, sneekBord, sudokuNieuw, sudokuKlaar, arcadeVergeet, sudokuOpschonen } =
    require('./arcade')({ S, save, nu, codenaamVan, ARCADE, ruw, progressieMag, GEEN_PROGRESSIE });
  opruimHaken.deel.push(arcadeVergeet);
  opruimHaken.sudoku = sudokuOpschonen;

  return { spelRahul, spelNabespreking, spelNaspelen,
    teamNieuw, teamNodig, teamAntwoord, teamVerlaat, mijnTeams,
    spelPraat, spelPraatStuur,
    arcadeScore, arcadeBord, sneekScore, sneekBord, sudokuNieuw, sudokuKlaar };
};
