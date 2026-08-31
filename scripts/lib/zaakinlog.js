/* ============================================================================
   INLOGGEN BIJ EEN ZAAK -- op een plek, en met een teller die klopt.

   HET PROBLEEM WAS EEN MUUR DIE NIEMAND HAD GEBOUWD. /api/supplier/roster
   laat dertig opvragingen per kwartier per IP toe (routes/supplier/toegang.js,
   rosterMag), en dat is een echte poort met een reden erachter: zonder hem is
   het complete personeelsbestand van elke partner in een paar minuten uit te
   lezen. De proef zat op 29 van die 30 -- 28 genrezaken plus een losse
   opvraging voor de demo-zaak -- en dus paste er nog precies een genre bij.

   Die 29e was er een te veel, en niet omdat de rem te krap is: er stonden
   TWEE implementaties van dezelfde handeling. ./wereld-genre.js deed rooster +
   login voor de genrezaken, ./proefsleutels.js deed hetzelfde nog eens voor de
   demo-zaak. Twee kopieen van dezelfde waarheid (LAT.md regel 4), en de tweede
   kostte een schaars slot.

   Deze module is die ene plek, met een CACHE per code: wie twee keer om
   dezelfde zaak vraagt, betaalt een keer. De demo-zaak staat gewoon in de
   genrelijst en `zaak-persoonlijk` vraagt hem hier op -- dezelfde sessie,
   nul extra opvragingen.

   DE TELLER IS GEEN AANNAME. `verbruikt()` telt de opvragingen die deze module
   werkelijk heeft gedaan, zodat de toets op het budget kijkt naar wat er
   gebeurt en niet naar wat er in een lijst staat. Een tweede plek die alsnog
   zelf gaat aankloppen, valt daarmee op. */
'use strict';

/* De PIN van elke geseede manager (server/kern/staffseed.js, eerste regel van
   dat bestand). Een demogegeven, geen achterdeur: zonder RTG_DEMO=1 bestaan
   deze zaken niet, en de login gaat langs dezelfde verifyStaffPin, hetzelfde
   pinslot en hetzelfde werkvenster als in de leverancier-app. */
const MANAGER_PIN = '1234';

function maakZaakinlog({ post }) {
  const cache = new Map();      // code -> { token, genre, waarom }
  let opvragingen = 0;

  /* Geeft { token, genre } of { token: null, waarom }. Nooit een throw: een
     zaak die niet opengaat is een UITSLAG en geen storing -- de aanroeper
     hoort hem met reden te kunnen melden. */
  async function inlog(code) {
    const sleutel = String(code || '').toUpperCase();
    if (cache.has(sleutel)) return cache.get(sleutel);

    let uit;
    let rooster = null;
    try { rooster = await post('/api/supplier/roster', { code: sleutel }, null); } catch (e) { rooster = null; }
    opvragingen++;

    if (!rooster || rooster.status !== 200) {
      uit = { token: null, genre: null, status: rooster ? rooster.status : 0,
        waarom: (rooster && rooster.data && rooster.data.error) || 'geen antwoord op /api/supplier/roster' };
    } else {
      const mgr = ((rooster.data || {}).staff || []).find(s => s.role === 'manager');
      if (!mgr) {
        uit = { token: null, genre: (rooster.data.supplier || {}).type || null, status: 200,
          waarom: 'deze zaak heeft geen manager in het rooster; zonder manager geen personeelslogin' };
      } else {
        let l = null;
        try { l = await post('/api/supplier/login', { code: sleutel, staffId: mgr.id, pin: MANAGER_PIN }); }
        catch (e) { l = null; }
        const token = l && l.status === 200 && l.data && l.data.token;
        uit = token
          ? { token, genre: (rooster.data.supplier || {}).type || null, status: 200, waarom: null }
          : { token: null, genre: (rooster.data.supplier || {}).type || null,
              status: l ? l.status : 0,
              waarom: (l && l.data && l.data.error) || 'de personeelslogin gaf geen sessie' };
      }
    }
    cache.set(sleutel, uit);
    return uit;
  }

  return { inlog, verbruikt: () => opvragingen, gekend: () => [...cache.keys()] };
}

module.exports = { maakZaakinlog, MANAGER_PIN };
