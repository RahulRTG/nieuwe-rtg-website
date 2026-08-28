/* HET ZEGEL: ondertekenen en nakijken, en verder niets weten.

   ../bewijstoken.js weet wat een claim BETEKENT -- een capability, een scope,
   grenzen, een bedrag. Dit bestand weet daar niets van en hoort dat ook niet te
   weten: het sluit een claim in een envelop en maakt hem weer open. Twee
   onderwerpen, en juist bij ondertekenen is dat het waard: een fout in de
   envelop is een fout in ALLE tokens, en dan wil je hem los kunnen lezen.

   DE SLEUTEL WORDT AFGELEID EN IS NIET DE SESSIESLEUTEL. Met HKDF onder een
   eigen label. Zo kan iemand die op de een of andere manier een handtekening
   onder een bewijstoken kan krijgen, daarmee geen sessietoken maken -- en
   andersom. Domeinscheiding kost hier een regel en is later niet meer in te
   bouwen.

   DE ONDERTEKENDE VORM IS EEN RIJ EN GEEN OBJECT, en de volgorde ligt vast. Twee
   objecten met dezelfde inhoud in een andere sleutelvolgorde geven anders twee
   verschillende handtekeningen, en dan verifieert een token soms wel en soms
   niet. Wat er niet in de rij staat, komt er bij het openen ook niet uit: een
   token met een extra veld erbij zou anders iets dragen dat de handtekening wel
   dekt maar niemand kent.

   ER WORDT IN CONSTANTE TIJD VERGELEKEN, en dat is geen ceremonie. Een gewone
   !== lekt via de reactietijd hoeveel tekens al kloppen, en dan raad je een
   handtekening teken voor teken. Een mutatie die alleen de eerste vier tekens
   vergeleek, overleefde de eerste toetsronde: elke toets veranderde een veld
   WILLEKEURIG, en dan verschilt het begin ook. Een forceerder doet juist niet
   willekeurig. Zie test/bewijstoken.test.js, toets 4. */
'use strict';

const crypto = require('crypto');

/* Verander dit label nooit zonder te bedenken dat alle uitstaande tokens er
   ongeldig van worden -- wat bij vijftien minuten geldigheid overwaait. */
const LABEL = 'rtg-bewijstoken-v1';

function afgeleideSleutel(basis) {
  const b = Buffer.isBuffer(basis) ? basis : Buffer.from(String(basis || ''), 'utf8');
  if (!b.length) return null;
  return Buffer.from(crypto.hkdfSync('sha256', b, Buffer.alloc(0), Buffer.from(LABEL), 32));
}

function sorteerGrenzen(g) {
  const uit = {};
  for (const k of Object.keys(g || {}).sort()) uit[k] = g[k];
  return uit;
}

function canoniek(c) {
  return JSON.stringify([c.v, c.actor, c.capability, c.scope, sorteerGrenzen(c.grenzen),
    c.waardeCenten, c.vervalt, c.beleid, c.nonce, c.eenmalig]);
}

/* De gelezen rij terug in de vorm die we tekenen. Een rij van een andere lengte
   of met een andere versie is geen token van ons. */
function herstel(rij) {
  if (!Array.isArray(rij) || rij.length !== 10 || rij[0] !== 1) return null;
  const [v, actor, capability, scope, grenzen, waardeCenten, vervalt, beleid, nonce, eenmalig] = rij;
  if (!capability || !Number.isFinite(vervalt)) return null;
  return { v, actor, capability, scope, grenzen: grenzen || {}, waardeCenten,
    vervalt, beleid, nonce, eenmalig: !!eenmalig };
}

const b64 = buf => Buffer.from(buf).toString('base64url');

function maakZegel(basisSleutel) {
  const k = afgeleideSleutel(basisSleutel);
  const teken = payload => b64(crypto.createHmac('sha256', k).update(payload).digest());

  function sluit(claim) {
    if (!k) return { error: 'Er is geen ondertekensleutel; zonder handtekening is een token een briefje.' };
    const payload = b64(Buffer.from(canoniek(claim), 'utf8'));
    return { ok: true, token: payload + '.' + teken(payload) };
  }

  function open(token) {
    if (!k) return { error: 'Er is geen ondertekensleutel om dit token mee na te kijken.' };
    const s = String(token || '');
    const punt = s.lastIndexOf('.');
    if (punt <= 0) return { error: 'Dit is geen bewijstoken.' };
    const payload = s.slice(0, punt);
    const gegeven = Buffer.from(s.slice(punt + 1));
    const verwacht = Buffer.from(teken(payload));
    if (gegeven.length !== verwacht.length || !crypto.timingSafeEqual(gegeven, verwacht))
      return { error: 'De handtekening klopt niet; dit token is onderweg veranderd of niet van ons.' };

    let claim = null;
    try { claim = herstel(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))); }
    catch (e) { return { error: 'De inhoud van dit token is niet te lezen.' }; }
    if (!claim) return { error: 'De inhoud van dit token heeft niet de vorm die wij tekenen.' };
    return { ok: true, claim };
  }

  return { sluit, open, heeftSleutel: !!k };
}

module.exports = { maakZegel, afgeleideSleutel, canoniek, herstel, LABEL };
