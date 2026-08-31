/* ============================================================================
   DE GENREWERELD -- twintig zaaksessies, elk bij de juiste soort bedrijf.

   Het waarom staat in scripts/lib/genrezaken.js; hier staat alleen de weg.
   Twee oproepen per zaak, allebei de gewone weg van de leverancier-app:

     /api/supplier/roster   wie werkt hier (de personeelskiezer van het
                            inlogscherm) -- hier alleen om de manager te vinden
     /api/supplier/login    de personeelslogin met PIN, precies zoals een
                            medewerker hem doet

   De PIN is 1234 voor elke geseede manager (kern/staffseed.js, eerste regel
   van het bestand). Dat is een DEMOGEGEVEN en geen achterdeur: zonder
   RTG_DEMO=1 bestaan deze zaken niet, en de login gaat langs dezelfde
   verifyStaffPin, hetzelfde pinslot en hetzelfde werkvenster als altijd.

   WAT ER GEBEURT ALS EEN ZAAK NIET OPENGAAT. Dan komt zij MET REDEN terug in
   `stappen` en levert zij geen sessie -- de routes van dat genre blijven dus
   gewoon in FIXTURE_403 staan. Een wereld die half lukt mag nooit stil half
   lukken: dan zou de proef minder meten en er even groen uitzien. */
'use strict';

const { ZAKEN, ROSTER_BUDGET } = require('./genrezaken');
const { maakZaakinlog } = require('./zaakinlog');

async function zetGenreKlaar({ post, zaakinlog }) {
  /* De inlog woont in ./zaakinlog.js -- op EEN plek, met een cache per code.
     Krijgt deze wereld er een mee, dan deelt hij hem met de proefsleutels en
     kost de demo-zaak geen tweede opvraging. */
  const bureau = zaakinlog || maakZaakinlog({ post });
  const stappen = [];
  const tokens = {};

  if (ZAKEN.length > ROSTER_BUDGET) {
    return { klaar: false, tokens: {}, stappen,
      reden: 'deze lijst telt ' + ZAKEN.length + ' zaken en de rem op /api/supplier/roster laat er ' +
        ROSTER_BUDGET + ' per kwartier toe; zo meet de staart van de lijst niets' };
  }

  for (const z of ZAKEN) {
    const uit = await bureau.inlog(z.code);
    if (!uit.token) {
      stappen.push({ zaak: z.code, genre: z.genre, ok: false, status: uit.status, waarom: uit.waarom });
      continue;
    }
    tokens[z.code] = uit.token;
    /* Het GENRE nameten in plaats van aannemen: de zaak kan hernoemd zijn of
       een ander type gekregen hebben, en dan opent deze sessie niets. */
    const klopt = uit.genre === z.genre;
    stappen.push({ zaak: z.code, genre: z.genre, ok: true, status: 200,
      waarom: klopt ? null : 'deze zaak draagt genre "' + uit.genre + '" en niet "' + z.genre + '"' });
  }

  const gelukt = Object.keys(tokens).length;
  return {
    klaar: gelukt === ZAKEN.length,
    tokens, stappen,
    reden: gelukt === ZAKEN.length ? null
      : (gelukt + ' van de ' + ZAKEN.length + ' zaken gaf een sessie; de rest staat met reden in stappen')
  };
}

module.exports = { zetGenreKlaar };
