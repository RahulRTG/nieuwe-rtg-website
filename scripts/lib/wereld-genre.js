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

async function zetGenreKlaar({ post }) {
  const stappen = [];
  const tokens = {};

  if (ZAKEN.length > ROSTER_BUDGET) {
    return { klaar: false, tokens: {}, stappen,
      reden: 'deze lijst telt ' + ZAKEN.length + ' zaken en de rem op /api/supplier/roster laat er ' +
        ROSTER_BUDGET + ' per kwartier toe; zo meet de staart van de lijst niets' };
  }

  for (const z of ZAKEN) {
    let rooster = null;
    try { rooster = await post('/api/supplier/roster', { code: z.code }, null); } catch (e) { rooster = null; }
    if (!rooster || rooster.status !== 200) {
      stappen.push({ zaak: z.code, genre: z.genre, ok: false, status: rooster ? rooster.status : 0,
        waarom: (rooster && rooster.data && rooster.data.error) || 'geen antwoord op /api/supplier/roster' });
      continue;
    }
    const mgr = ((rooster.data || {}).staff || []).find(s => s.role === 'manager');
    if (!mgr) {
      stappen.push({ zaak: z.code, genre: z.genre, ok: false, status: 200,
        waarom: 'deze zaak heeft geen manager in het rooster; zonder manager geen personeelslogin' });
      continue;
    }
    let inlog = null;
    try { inlog = await post('/api/supplier/login', { code: z.code, staffId: mgr.id, pin: '1234' }, null); }
    catch (e) { inlog = null; }
    const tok = inlog && inlog.status === 200 && inlog.data && inlog.data.token;
    if (!tok) {
      stappen.push({ zaak: z.code, genre: z.genre, ok: false, status: inlog ? inlog.status : 0,
        waarom: (inlog && inlog.data && inlog.data.error) || 'de personeelslogin gaf geen sessie' });
      continue;
    }
    /* Het GENRE nameten in plaats van aannemen: de zaak kan hernoemd zijn of
       een ander type gekregen hebben, en dan opent deze sessie niets. */
    const werkelijk = (rooster.data.supplier || {}).type;
    const klopt = werkelijk === z.genre;
    tokens[z.code] = tok;
    stappen.push({ zaak: z.code, genre: z.genre, ok: true, status: 200,
      waarom: klopt ? null : 'deze zaak draagt genre "' + werkelijk + '" en niet "' + z.genre + '"' });
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
